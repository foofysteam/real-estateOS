import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listLeads, parseLeadFilters } from "@/lib/leads/queries";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const filters = parseLeadFilters(searchParams);
  const cursor = searchParams.get("cursor")?.trim().slice(0, 64) || undefined;

  // Dates serialise to ISO strings, matching LeadListItemDTO on the client.
  return NextResponse.json(await listLeads(filters, cursor));
}
