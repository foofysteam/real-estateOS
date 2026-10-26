import { getEnv } from "@/lib/env";
import { MAX_RUPEES, parseRupees } from "@/lib/money";
import type { NormalizedLead } from "@/lib/leads/types";

export type MetaLead = {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
  form_id?: string;
  ad_id?: string;
};

/** A budget answer we can store; anything unparseable or beyond MAX_RUPEES stays in notes instead. */
function storableBudget(value: string): number | undefined {
  const rupees = parseRupees(value);
  return rupees !== null && rupees <= MAX_RUPEES ? rupees : undefined;
}

/** Spec §5.4: map Lead Ads field_data into a NormalizedLead; unmatched fields become `key: value` note lines. */
export function mapFieldData(lead: MetaLead): NormalizedLead {
  const fields: Record<string, string | undefined> = {};
  const notes: string[] = [];
  let fullName: string | undefined;
  let firstName: string | undefined;
  let lastName: string | undefined;

  for (const field of lead.field_data) {
    const key = field.name.toLowerCase();
    const value = field.values.join(", ").trim();
    if (!value) continue;
    if (key === "full_name") fullName = value;
    else if (key === "first_name") firstName = value;
    else if (key === "last_name") lastName = value;
    else if (key === "phone_number") fields.phone = value;
    else if (key === "email") fields.email = value;
    else if (key.includes("budget") && fields.budget === undefined && storableBudget(value) !== undefined) fields.budget = value;
    else if ((key.includes("configuration") || key.includes("bhk")) && fields.configuration === undefined) fields.configuration = value;
    else if ((key.includes("location") || key.includes("locality")) && fields.locality === undefined) fields.locality = value;
    else notes.push(`${field.name}: ${value}`);
  }

  const name = fullName ?? [firstName, lastName].filter(Boolean).join(" ");
  return {
    source: "META_LEAD_AD",
    name: name || "Unknown",
    phone: fields.phone ?? "",
    email: fields.email,
    budgetRupees: fields.budget === undefined ? undefined : storableBudget(fields.budget),
    configuration: fields.configuration,
    locality: fields.locality,
    notes: notes.length ? notes.join("\n") : undefined,
    externalId: lead.id,
    receivedAt: new Date(lead.created_time),
  };
}

/** Fetch one lead from the Graph API and map it. Throws on a non-2xx response. */
export async function fetchLeadgen(leadgenId: string, token: string, fetchImpl: typeof fetch = fetch): Promise<NormalizedLead> {
  const url = `https://graph.facebook.com/${getEnv().META_GRAPH_VERSION}/${encodeURIComponent(leadgenId)}?fields=field_data,created_time,ad_id,form_id`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph API request failed with status ${res.status}`);
  return mapFieldData((await res.json()) as MetaLead);
}
