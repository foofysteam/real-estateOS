export type Campaign = { id: string; name: string; status: string; objective: string; dailyBudgetRupees?: number };
export type Insights = { spendRupees: number; impressions: number; clicks: number; leads: number; costPerLeadRupees?: number };
export type LeadForm = { id: string; name: string; status: string; leadsCount: number };
export type DateRange = { since: string; until: string }; // YYYY-MM-DD

export interface MetaAdsGateway {
  listCampaigns(adAccountId: string): Promise<Campaign[]>;
  getInsights(adAccountId: string, range: DateRange): Promise<Insights>;
  listLeadForms(pageId: string): Promise<LeadForm[]>;
}

export type ToolMap = Record<keyof MetaAdsGateway, string>;

export const DEFAULT_TOOL_MAP: ToolMap = {
  listCampaigns: "ads_get_campaigns",
  getInsights: "ads_get_insights",
  listLeadForms: "ads_get_lead_forms",
};

export class MetaToolUnavailableError extends Error {
  constructor(
    public operation: keyof MetaAdsGateway,
    public available: string[],
    toolName: string = DEFAULT_TOOL_MAP[operation],
  ) {
    super(
      `Meta MCP tool "${toolName}" for ${operation} is not available; server offers: ${available.length ? available.join(", ") : "(none)"}`,
    );
    this.name = "MetaToolUnavailableError";
  }
}

export class MetaNotConfiguredError extends Error {
  constructor(message = "Meta is not connected: no access token is configured") {
    super(message);
    this.name = "MetaNotConfiguredError";
  }
}

// ---- Normalisation of raw Meta (Graph-shaped) payloads, shared by both gateways ----

type Raw = Record<string, unknown>;

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

/** Accepts `{ data: [...] }` or a bare array. */
export function rows(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  const data = (payload as Raw | null)?.data;
  return Array.isArray(data) ? (data as Raw[]) : [];
}

export function toCampaign(raw: Raw): Campaign {
  const campaign: Campaign = { id: str(raw.id), name: str(raw.name), status: str(raw.status), objective: str(raw.objective) };
  // Graph daily_budget is in minor units (paise for INR).
  if (raw.daily_budget !== undefined && raw.daily_budget !== null && raw.daily_budget !== "") {
    campaign.dailyBudgetRupees = num(raw.daily_budget) / 100;
  }
  return campaign;
}

export function toLeadForm(raw: Raw): LeadForm {
  return { id: str(raw.id), name: str(raw.name), status: str(raw.status), leadsCount: num(raw.leads_count) };
}

/** Accepts a single insights row, `{ data: [row] }` or `[row]`; an empty result is all zeros. */
export function toInsights(payload: unknown): Insights {
  const list = rows(payload);
  const row: Raw = list.length ? list[0] : Array.isArray(payload) ? {} : ((payload as Raw | null) ?? {});
  const actions = Array.isArray(row.actions) ? (row.actions as Raw[]) : [];
  const leads = actions.filter((a) => a.action_type === "lead").reduce((sum, a) => sum + num(a.value), 0);
  const spendRupees = num(row.spend);
  const insights: Insights = { spendRupees, impressions: num(row.impressions), clicks: num(row.clicks), leads };
  if (leads > 0) insights.costPerLeadRupees = Math.round((spendRupees / leads) * 100) / 100;
  return insights;
}
