import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_TOOL_MAP,
  MetaToolUnavailableError,
  rows,
  toCampaign,
  toInsights,
  toLeadForm,
  type Campaign,
  type DateRange,
  type Insights,
  type LeadForm,
  type MetaAdsGateway,
  type ToolMap,
} from "./gateway";

type Session = { client: Client; tools: Set<string>; names: string[] };

/** MetaAdsGateway backed by Meta's hosted Ads MCP server. */
export class McpMetaAdsGateway implements MetaAdsGateway {
  private readonly connect: () => Promise<Client>;
  private readonly toolMap: ToolMap;
  private session?: Promise<Session>;

  constructor(opts: { connect: () => Promise<Client>; toolMap?: Partial<ToolMap> }) {
    this.connect = opts.connect;
    this.toolMap = { ...DEFAULT_TOOL_MAP, ...opts.toolMap };
  }

  async listCampaigns(adAccountId: string): Promise<Campaign[]> {
    return rows(await this.call("listCampaigns", { ad_account_id: adAccountId })).map(toCampaign);
  }

  async getInsights(adAccountId: string, range: DateRange): Promise<Insights> {
    return toInsights(await this.call("getInsights", { ad_account_id: adAccountId, time_range: { since: range.since, until: range.until } }));
  }

  async listLeadForms(pageId: string): Promise<LeadForm[]> {
    return rows(await this.call("listLeadForms", { page_id: pageId })).map(toLeadForm);
  }

  /**
   * Connects and lists tools once; concurrent first calls share the same promise.
   * A failed connect, a closed transport or a rejected tool call clears the session so the next call reconnects.
   */
  private getSession(): Promise<Session> {
    if (this.session) return this.session;
    const session: Promise<Session> = (async () => {
      const client = await this.connect();
      client.onclose = () => {
        if (this.session === session) this.session = undefined;
      };
      const names: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined);
        names.push(...page.tools.map((t) => t.name));
        cursor = page.nextCursor;
      } while (cursor);
      return { client, tools: new Set(names), names };
    })().catch((err: unknown) => {
      if (this.session === session) this.session = undefined;
      throw err;
    });
    this.session = session;
    return session;
  }

  /** Drops a broken session (closing its client best-effort) so the next call reconnects and re-lists tools. */
  private async invalidate(session: Promise<Session>, client: Client): Promise<void> {
    if (this.session === session) this.session = undefined;
    try {
      await client.close();
    } catch {
      // The transport is already broken; nothing more to do.
    }
  }

  private async call(operation: keyof MetaAdsGateway, args: Record<string, unknown>): Promise<unknown> {
    const session = this.getSession();
    const { client, tools, names } = await session;
    const name = this.toolMap[operation];
    if (!tools.has(name)) throw new MetaToolUnavailableError(operation, names, name);
    let result: Awaited<ReturnType<Client["callTool"]>>;
    try {
      result = await client.callTool({ name, arguments: args });
    } catch (err) {
      // Tool-level failures arrive as isError results; a rejection means the transport/session is unusable.
      await this.invalidate(session, client);
      throw err;
    }
    const content = Array.isArray(result.content) ? (result.content as { type: string; text?: string }[]) : [];
    const text = content.find((c) => c.type === "text")?.text;
    if (result.isError) {
      const detail = text?.trim().slice(0, 300);
      throw new Error(`Meta MCP tool "${name}" returned an error${detail ? `: ${detail}` : ""}`);
    }
    if (result.structuredContent !== undefined) return result.structuredContent;
    if (text === undefined) throw new Error(`Meta MCP tool "${name}" returned no text content`);
    return JSON.parse(text);
  }
}

/** Builds a connect function for the hosted Meta Ads MCP server over Streamable HTTP. */
export function createMcpClientFactory(url: string, token: string): () => Promise<Client> {
  return async () => {
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers: { Authorization: "Bearer " + token } },
    });
    const client = new Client({ name: "sales-os", version: "0.1.0" });
    await client.connect(transport);
    return client;
  };
}
