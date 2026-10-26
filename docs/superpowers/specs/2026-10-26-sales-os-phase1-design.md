# Sales OS — Phase 1 Design (Lead Core + Pipeline + Meta Ads MCP)

**Date:** 2026-10-26
**Status:** Approved for implementation
**Owner:** Akshay Kingar (Space Crafter Studio)
**Vision canvas:** https://claude.ai/artifact/1dwFEhNJGWV7N6puFiqVjK

## 1. Purpose

A real-estate sales CRM that consolidates every lead source into one record,
pushes agents to act on the right lead today, tracks each lead through a
fixed pipeline, and reads live Meta Ads data through Meta's MCP server.
Phase 1 is the first shippable increment of the four-phase operating
system shown on the vision canvas. Calling desk, agents runtime, creative
studio and Meta ad *management* (writes) are later plans and are out of
scope here.

## 2. Users

- **Agent** — works leads, moves stages, logs calls, schedules follow-ups.
  Primarily on a phone.
- **Sales head / admin** — sees pipeline and ad spend, assigns leads,
  manages projects, team and integrations. Primarily on a laptop.

Single tenant. One organisation per deployment. No per-org tables.

## 3. Global constraints

- Language/runtime: TypeScript 5 strict, Node.js 22, pnpm.
- Framework: Next.js 16.4 App Router, React 19, Turbopack. Use `proxy.ts`
  (not `middleware.ts`). `params`/`searchParams`/`cookies()` are async.
- Styling: Tailwind CSS 4 with design tokens as CSS custom properties on
  `:root` and `.dark`. No UI kit dependency beyond Radix primitives
  (`@radix-ui/react-*`) and `lucide-react` icons.
- Data: PostgreSQL 16, Prisma 7.10 with `@prisma/adapter-pg`.
- Validation: Zod 4 at every boundary (API input, env, webhook payloads).
- Tests: Vitest 5. Unit tests for all `src/lib/**`. Integration tests for
  every route handler against a real Postgres test database
  (`DATABASE_URL_TEST`). Component tests with Testing Library for the
  five screens' primary interactions.
- Auth: email + password, argon2id hashes, signed `HttpOnly` session
  cookie (`sales_os_session`), 30-day expiry. Roles: `ADMIN`, `AGENT`.
- Phone numbers stored E.164. Default region `IN` when no country code.
- Money stored as integer rupees (`Int`, max ₹214 Cr). Ad spend (not persisted) may be fractional rupees. Display in ₹ with Indian grouping (`12,50,000`).
- Timezone for display: `Asia/Kolkata`. Storage: UTC.
- Every write to a Lead produces a `LeadEvent` row. The timeline is the
  audit log.
- Mobile first: every screen is usable at 360 px wide with 44 px minimum
  touch targets; no horizontal page scroll. Breakpoints: `sm 640`,
  `md 768`, `lg 1024`. Navigation is a bottom tab bar below `md`, a
  collapsible left sidebar at `lg` and above.
- Dark mode via `prefers-color-scheme` plus a manual toggle persisted in
  `localStorage`.
- No external font downloads at runtime: `next/font` with Inter, self
  hosted at build.
- Secrets only from environment. `.env.example` lists every variable.

## 4. Domain model

```
Project        id, name, slug, city, priceMinRupees, priceMaxRupees, isActive
User           id, email, name, passwordHash, role, phone?, isActive
Lead           id, projectId?, ownerId?, name, phone (E.164, unique),
               email?, source, stage, score (0-100), budgetRupees?,
               configuration? ("2BHK"), locality?, notes?,
               lastContactedAt?, nextFollowUpAt?, lostReason?,
               createdAt, updatedAt
LeadEvent      id, leadId, actorId? (null = system), type, payload (json),
               createdAt
FollowUp       id, leadId, ownerId, dueAt, channel (CALL|WHATSAPP|VISIT|EMAIL),
               note?, completedAt?
IngestKey      id, name, source, keyHash, lastUsedAt?, isActive
WebhookEvent   id, provider ("meta"), externalId (unique per provider),
               receivedAt, processedAt?, status (RECEIVED|PROCESSED|FAILED),
               error?, raw (json)
MetaConnection id (singleton row id=1), pageId, adAccountId,
               accessTokenEnc, leadFormIds (string[]), mcpUrl, updatedAt
```

Enums:

- `LeadSource`: `META_LEAD_AD`, `WEBSITE`, `GOOGLE_ADS`, `PORTAL_99ACRES`,
  `PORTAL_MAGICBRICKS`, `PORTAL_HOUSING`, `WALK_IN`, `REFERRAL`, `CSV_IMPORT`.
- `LeadStage` (ordered): `NEW`, `CONTACTED`, `QUALIFIED`,
  `SITE_VISIT_SCHEDULED`, `SITE_VISIT_DONE`, `NEGOTIATION`, `BOOKED`, `LOST`.
- `LeadEventType`: `CREATED`, `DUPLICATE_INBOUND`, `STAGE_CHANGED`,
  `ASSIGNED`, `NOTE_ADDED`, `FOLLOW_UP_SCHEDULED`, `FOLLOW_UP_COMPLETED`,
  `CONTACT_LOGGED`, `SCORE_CHANGED`, `FIELD_UPDATED`.

### 4.1 Stage transitions

Any stage may move to `LOST` (requires `lostReason`). From `LOST` only
`NEW` is allowed (reopen). Otherwise a lead may move forward by any number
of stages or back by exactly one. `BOOKED` is terminal except to `LOST`.

### 4.2 Lead score

Deterministic, recomputed on create and on every field update:

```
base by source:  META_LEAD_AD 40, WEBSITE 45, GOOGLE_ADS 45,
                 PORTAL_* 35, WALK_IN 60, REFERRAL 65, CSV_IMPORT 20
+20 if budgetRupees within the project's [priceMin, priceMax]
+10 if configuration present
+10 if locality present
+5  if email present
clamp 0..100
```

### 4.3 Deduplication

Inbound lead with a phone that already exists (after E.164 normalisation)
does **not** create a new Lead. It appends a `DUPLICATE_INBOUND` event
with the full normalised payload, sets `nextFollowUpAt = now` if the lead
is not `BOOKED`/`LOST`, and returns the existing lead id with
`deduplicated: true`. Email is never used for dedup (shared family
emails are common).

## 5. Ingestion

### 5.1 Normalised lead

Every source maps into:

```ts
type NormalizedLead = {
  source: LeadSource;
  name: string;               // trimmed, 1..120
  phone: string;              // raw, normalised downstream
  email?: string;
  projectSlug?: string;
  budgetRupees?: number;
  configuration?: string;
  locality?: string;
  notes?: string;
  externalId?: string;        // provider's id, for idempotency
  receivedAt: Date;
};
```

### 5.2 Generic ingest endpoint

`POST /api/ingest` with header `Authorization: Bearer <ingest key>`.
The key resolves an `IngestKey` whose `source` is stamped on the lead.
Body is a flat JSON object validated by the generic schema
(`name`, `phone` required; the rest optional). Returns
`201 { leadId, deduplicated }` or `202` when deduplicated. Invalid key
`401`. Invalid body `422` with Zod issues.

### 5.3 CSV import

`POST /api/ingest/csv` (ADMIN only, session auth) with `multipart/form-data`
field `file` and `source`. Columns: `name,phone,email,project,budget,
configuration,locality,notes`. Budget accepted as rupees (`45L`, `1.2Cr`,
`4500000`) and stored as whole rupees. Returns per-row result list.

### 5.4 Meta Lead Ads webhook

- `GET /api/webhooks/meta` answers the subscription challenge when
  `hub.verify_token === META_WEBHOOK_VERIFY_TOKEN`, else `403`.
- `POST /api/webhooks/meta` verifies `X-Hub-Signature-256` (HMAC SHA-256
  of raw body with `META_APP_SECRET`); mismatch `401`. Each
  `entry[].changes[]` with `field === "leadgen"` is stored as a
  `WebhookEvent` keyed by `leadgen_id` (idempotent on retry), then the
  lead is fetched from Graph API
  `GET /{leadgen_id}?fields=field_data,created_time,ad_id,form_id` with the
  page token (`MetaConnection.accessTokenEnc` decrypted, else
  `META_ACCESS_TOKEN`), mapped to `NormalizedLead`, and ingested. The
  endpoint always returns `200` within the request; fetching runs
  after the response is queued (`after()` from `next/server`).
- `field_data` mapping: `full_name`→name, `phone_number`→phone,
  `email`→email, any question whose key contains `budget`→budgetRupees,
  `configuration`/`bhk`→configuration, `location`/`locality`→locality.
  Unknown fields are kept in `notes` as `key: value` lines.

## 6. Meta Ads via MCP

The app is an MCP **client** of Meta's hosted Ads MCP server.

- Config: `META_MCP_URL` (default `https://mcp.facebook.com/ads`),
  `META_ACCESS_TOKEN` (bearer, user/system-user token with
  `ads_read`, `leads_retrieval`, `pages_read_engagement`).
- Transport: Streamable HTTP from `@modelcontextprotocol/sdk`.
- On connect the client calls `tools/list` and caches the catalog for the
  process lifetime. Tool names are **not** hard coded: a `MetaAdsGateway`
  interface declares the three operations Phase 1 needs, and the MCP
  implementation resolves each operation to a tool name through
  `META_MCP_TOOL_MAP` (JSON, optional) with defaults
  `{"listCampaigns":"ads_get_campaigns","getInsights":"ads_get_insights",
  "listLeadForms":"ads_get_lead_forms"}`. If a mapped tool is missing from
  the catalog the gateway throws `MetaToolUnavailableError` naming the
  operation and listing the available tool names, and the UI shows that
  message verbatim in the Ads screen.
- A second implementation, `GraphMetaAdsGateway`, performs the same three
  operations against Graph API `v24.0` directly, selected by
  `META_GATEWAY=graph`. Default is `mcp`.
- Operations:
  - `listCampaigns(adAccountId)` → `{ id, name, status, objective,
    dailyBudgetRupees? }[]`
  - `getInsights(adAccountId, range: { since, until })` →
    `{ spendRupees, impressions, clicks, leads, costPerLeadRupees? }`
  - `listLeadForms(pageId)` → `{ id, name, status, leadsCount }[]`
- Ads screen caches gateway responses for 5 minutes via `unstable_cache`
  with `revalidate: 300`, keyed by account id and range.

## 7. Screens

All screens require a session except Login. Route group `(app)` carries
the shell (sidebar / bottom tabs, theme toggle, user menu).

1. **Login** `/login` — email, password, error state, redirects to `/today`.
2. **Today** `/today` — three sections: *Overdue follow-ups*, *Due today*,
   *New unassigned* (ADMIN) or *New assigned to me* (AGENT). Each row has
   one-tap `Call` (`tel:`) and `WhatsApp` (`https://wa.me/<E.164 without
   +>`) actions and a `Done` button that completes the follow-up.
3. **Leads** `/leads` — search (name/phone), filters (source, stage,
   owner, project), sort by score or created. Table at `lg`, card list
   below. Infinite scroll in pages of 30. Row tap opens detail.
4. **Lead detail** `/leads/[id]` — header (name, score ring, stage
   chip, owner), quick actions (Call, WhatsApp, Schedule follow-up,
   Change stage, Assign), editable fields, timeline (all `LeadEvent`s
   newest first). Stage change dialog enforces §4.1 and asks for
   `lostReason` when moving to `LOST`.
5. **Pipeline** `/pipeline` — one column per stage except `LOST`, count
   and total budget per column, drag-and-drop at `lg`; below `lg`
   horizontal snap-scroll columns with a stage selector and a `Move`
   action on each card. `LOST` reachable via a filter chip.
6. **Ads** `/ads` — ad account summary for last 7 and 30 days, campaign
   table, lead forms table with a `Sync forms` button that stores
   `leadFormIds` on `MetaConnection`. Connection error surface per §6.
7. **Settings** `/settings` (ADMIN) — tabs: Projects (CRUD), Team
   (invite by email with temporary password, deactivate), Integrations
   (Meta: page id, ad account id, token, gateway mode, webhook URL and
   verify token shown read only; Ingest keys: create/revoke, key shown
   once), Import (CSV upload per §5.3).

### 7.1 Design language

- Tokens: `--bg`, `--surface`, `--surface-2`, `--border`, `--fg`,
  `--fg-muted`, `--accent` (`#2563eb` light / `#60a5fa` dark),
  `--success`, `--warning`, `--danger`, radius `--r-sm 6px`, `--r-md 10px`,
  `--r-lg 16px`. Stage colours are a fixed map in `src/lib/stages.ts`.
- Type scale: 12/14/16/20/24/32 px. Body 14 px on mobile, 14 px desktop.
- Density: list rows 56 px on mobile, 44 px on desktop.
- Motion: 150 ms ease-out for state changes; respect
  `prefers-reduced-motion`.
- Empty states carry one sentence and one primary action.
- Loading uses skeletons, never spinners, for lists.

## 8. Non-functional

- `pnpm test` runs in under 90 s on a laptop.
- `pnpm build` produces zero TypeScript or ESLint errors.
- Lighthouse mobile performance ≥ 85 on `/leads` with 200 leads seeded.
- Webhook handler responds in < 500 ms (fetch deferred).
- Seed script creates 1 admin, 3 agents, 3 projects, 200 leads spread
  across sources and stages, 60 follow-ups.

## 9. Out of scope (later plans)

Calling desk and telephony, AI agents runtime, creative studio (Monid),
Meta campaign *writes*, portal email parsing, multi-tenant, WhatsApp
Business API messaging, notifications/push, reporting beyond the Ads
screen.
