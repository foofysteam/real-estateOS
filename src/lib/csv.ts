import type { LeadSource } from "@/generated/prisma/client";
import { ingestLead, InvalidPhoneError } from "@/lib/leads/ingest";
import { normalizedLeadSchema, type NormalizedLead } from "@/lib/leads/types";
import { MAX_RUPEES, parseRupees } from "@/lib/money";

export type CsvError = { line: number; message: string };
export type CsvImportResult = { created: number; deduplicated: number; errors: CsvError[] };

type CsvRecord = { line: number; fields: string[] };

/** CSV header → NormalizedLead field. Headers match case-insensitively; unknown columns are ignored. */
const COLUMNS: Record<string, keyof NormalizedLead | "budget"> = {
  name: "name",
  phone: "phone",
  email: "email",
  project: "projectSlug",
  budget: "budget",
  configuration: "configuration",
  locality: "locality",
  notes: "notes",
};
const REQUIRED = ["name", "phone"];

/** RFC 4180-style records: quoted fields may hold commas, quotes ("") and newlines. Line numbers are 1-based. */
function readRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  const src = text.replace(/^﻿/, "");

  const endRecord = () => {
    fields.push(field);
    if (fields.some((f) => f.trim() !== "")) records.push({ line: recordLine, fields });
    fields = [];
    field = "";
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== "" || fields.length > 0) endRecord();
  return records;
}

type ParsedRow = { line: number; lead: NormalizedLead };

function parseRows(text: string, source: LeadSource): { rows: ParsedRow[]; errors: CsvError[] } {
  const [header, ...data] = readRecords(text);
  if (!header) return { rows: [], errors: [{ line: 1, message: "CSV is empty" }] };

  const keys = header.fields.map((h) => COLUMNS[h.trim().toLowerCase()]);
  const missing = REQUIRED.filter((r) => !keys.includes(COLUMNS[r]));
  if (missing.length) {
    return { rows: [], errors: [{ line: header.line, message: `Missing required column(s): ${missing.join(", ")}` }] };
  }

  const rows: ParsedRow[] = [];
  const errors: CsvError[] = [];
  const receivedAt = new Date();
  for (const { line, fields } of data) {
    const raw: Record<string, string> = {};
    keys.forEach((key, i) => {
      const value = fields[i]?.trim();
      if (key && value) raw[key] = value;
    });

    const { budget, ...rest } = raw;
    let budgetRupees: number | undefined;
    if (budget !== undefined) {
      const parsed = parseRupees(budget);
      if (parsed === null) {
        errors.push({ line, message: `Invalid budget "${budget}"` });
        continue;
      }
      if (parsed > MAX_RUPEES) {
        errors.push({ line, message: "Budget too large" });
        continue;
      }
      budgetRupees = parsed;
    }

    const result = normalizedLeadSchema.safeParse({
      name: "",
      phone: "",
      ...rest,
      budgetRupees,
      source,
      receivedAt,
    });
    if (!result.success) {
      const message = result.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ");
      errors.push({ line, message });
      continue;
    }
    rows.push({ line, lead: result.data });
  }
  return { rows, errors };
}

/** Parse a leads CSV (header row is line 1) into validated leads plus per-line errors. */
export function parseLeadsCsv(text: string, source: LeadSource): { rows: NormalizedLead[]; errors: CsvError[] } {
  const { rows, errors } = parseRows(text, source);
  return { rows: rows.map((r) => r.lead), errors };
}

/** Parse and ingest a leads CSV row by row; any per-row failure is reported against its line and the import continues. */
export async function importLeadsCsv(text: string, source: LeadSource, actorId?: string): Promise<CsvImportResult> {
  const { rows, errors } = parseRows(text, source);
  let created = 0;
  let deduplicated = 0;
  for (const { line, lead } of rows) {
    try {
      const result = await ingestLead(lead, actorId);
      if (result.deduplicated) deduplicated++;
      else created++;
    } catch (err) {
      const message =
        err instanceof InvalidPhoneError
          ? "Invalid phone number"
          : "Import failed: " + (err instanceof Error ? err.message : "unknown error");
      errors.push({ line, message });
    }
  }
  errors.sort((a, b) => a.line - b.line);
  return { created, deduplicated, errors };
}
