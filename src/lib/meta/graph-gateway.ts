import {
  rows,
  toCampaign,
  toInsights,
  toLeadForm,
  type Campaign,
  type DateRange,
  type Insights,
  type LeadForm,
  type MetaAdsGateway,
} from "./gateway";

/** MetaAdsGateway backed directly by the Graph Marketing API (fallback when MCP is unavailable). */
export class GraphMetaAdsGateway implements MetaAdsGateway {
  private readonly token: string;
  private readonly version: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: { token: string; version: string; fetchImpl?: typeof fetch }) {
    this.token = opts.token;
    this.version = opts.version;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async listCampaigns(adAccountId: string): Promise<Campaign[]> {
    const path = `/${actId(adAccountId)}/campaigns?fields=id,name,status,objective,daily_budget&limit=100`;
    return rows(await this.get(path)).map(toCampaign);
  }

  async getInsights(adAccountId: string, range: DateRange): Promise<Insights> {
    const timeRange = encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }));
    const path = `/${actId(adAccountId)}/insights?fields=spend,impressions,clicks,actions&time_range=${timeRange}`;
    return toInsights(await this.get(path));
  }

  async listLeadForms(pageId: string): Promise<LeadForm[]> {
    const path = `/${encodeURIComponent(pageId)}/leadgen_forms?fields=id,name,status,leads_count&limit=100`;
    return rows(await this.get(path)).map(toLeadForm);
  }

  private async get(path: string): Promise<unknown> {
    const res = await this.fetchImpl(`https://graph.facebook.com/${this.version}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`Graph API ${res.status}: ${path.split("?")[0]}`);
    return res.json();
  }
}

function actId(adAccountId: string): string {
  const id = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;
  return `act_${encodeURIComponent(id)}`;
}
