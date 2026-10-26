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

  /** Connects and lists tools once; concurrent first calls share the same promise. A failed connect is retried next call. */
  private getSession(): Promise<Session> {
    this.session ??= (async () => {
      const client = await this.connect();
      const names: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined);
        names.push(...page.tools.map((t) => t.name));
        cursor = page.nextCursor;
      } while (cursor);
      return { client, tools: new Set(names), names };
    })().catch((err: unknown) => {
      this.session = undefined;
      throw err;
    });
    return this.session;
  }

  private async call(operation: keyof MetaAdsGateway, args: Record<string, unknown>): Promise<unknown> {
    const { client, tools, names } = await this.getSession();
    const name = this.toolMap[operation];
    if (!tools.has(name)) throw new MetaToolUnavailableError(operation, names, name);
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`Meta MCP tool "${name}" returned an error`);
    if (result.structuredContent !== undefined) return result.structuredContent;
    const content = Array.isArray(result.content) ? (result.content as { type: string; text?: string }[]) : [];
    const text = content.find((c) => c.type === "text")?.text;
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
