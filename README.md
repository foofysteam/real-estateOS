# Sales OS

Sales OS is a mobile-first CRM for a real-estate sales team selling Bengaluru projects. Leads arrive from Meta Lead Ads (webhook), website forms and property portals (a bearer-key ingest API), and CSV uploads; each lead is de-duplicated by phone number, scored, and moved through an eight-stage pipeline (New → Contacted → Qualified → Site visit scheduled → Site visit done → Negotiation → Booked / Lost). Agents work from a Today list of overdue and due follow-ups, admins manage projects, the team and integrations, and an Ads screen shows Meta spend and lead-form performance. It is built with Next.js 16, Prisma 7 and PostgreSQL 16.

## Prerequisites

- Node.js 22
- pnpm 10 (`corepack enable` picks up the version pinned in `package.json`)
- PostgreSQL 16

## Setup

1. Create the environment file and fill in the two secrets:

   ```bash
   cp .env.example .env
   openssl rand -hex 32   # paste as SESSION_SECRET
   openssl rand -hex 32   # paste as ENCRYPTION_KEY (must be exactly 64 hex characters)
   ```

   `DATABASE_URL` and `DATABASE_URL_TEST` in `.env.example` already point at the role and databases below.

2. Create the database role and the two databases (app and test):

   ```bash
   sudo -u postgres psql -c "CREATE ROLE salesos LOGIN PASSWORD 'salesos' CREATEDB;"
   sudo -u postgres createdb -O salesos salesos
   sudo -u postgres createdb -O salesos salesos_test
   ```

3. Install dependencies. `postinstall` runs `prisma generate`, which writes the client to `src/generated/prisma`.

   ```bash
   pnpm install
   ```

4. Apply the migrations and load the demo data:

   ```bash
   pnpm db:deploy   # prisma migrate deploy
   pnpm db:seed     # wipes every table, then seeds demo data
   ```

   Use `pnpm db:deploy`, not `pnpm db:migrate`: `db:migrate` runs `prisma migrate dev`, which is interactive (it can prompt to reset the database) and is unsuitable for CI or scripted setups.

   The seed is idempotent and deterministic. It creates 4 users, 3 projects (price bands in whole rupees), 200 leads across every source and stage (70 % assigned to agents), 60 open follow-ups (20 overdue, 20 due today in IST, 20 upcoming) and 2 ingest keys, `website` and `99acres`. **The ingest keys' plaintext is printed once by `pnpm db:seed`; only their hashes are stored, so copy them then.** Running the seed again replaces everything, including the keys. Because it wipes every table, the seed refuses to run when `NODE_ENV=production` and prints "Refusing to wipe a production database. Pass --force to override."; to seed a production database deliberately, run `pnpm db:seed --force`.

5. Start the app:

   ```bash
   pnpm dev          # http://localhost:3000
   ```

   For a production build: `pnpm build && pnpm start`.

### Demo logins

| Role  | Email                                    | Password    |
| ----- | ---------------------------------------- | ----------- |
| Admin | `admin@sc.studio`                        | `admin1234` |
| Agent | `agent1@sc.studio` … `agent3@sc.studio`  | `agent1234` |

Change these before exposing the app anywhere (Settings → Team).

## Screens

| Route          | Screen                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| `/login`       | Sign in                                                                             |
| `/today`       | Today: overdue follow-ups, follow-ups due today (IST) and new leads                 |
| `/leads`       | Lead list with search and filters (stage, source, owner, project)                   |
| `/leads/[id]`  | Lead detail: contact actions, stage changes, follow-ups, notes and timeline         |
| `/pipeline`    | Kanban board by stage                                                               |
| `/ads`         | Meta Ads overview: spend, leads and campaigns (needs a Meta connection)             |
| `/settings`    | Admin only. Tabs: Projects, Team, Integrations (Meta, ingest keys), Import (CSV)    |

`/` redirects to `/today`; every screen except `/login` redirects to `/login` when signed out.

## Tests

```bash
pnpm db:test:prepare   # apply migrations to DATABASE_URL_TEST (run once, and after each new migration)
pnpm test              # all tests once (unit + integration in Node, UI in jsdom)
pnpm test:watch        # watch mode
pnpm lint
pnpm build
```

Integration tests run against `DATABASE_URL_TEST` and truncate its tables between tests; they never touch `DATABASE_URL`.

## Money

All amounts (project price bands, lead budgets) are stored as integers in **whole rupees**: no paise, no lakhs. The UI formats them in Indian units (for example ₹80L, ₹1.6Cr), and the ingest API and CSV import accept either a number of rupees or strings like `"45L"`, `"1.2 crore"` or `"45,00,000"`.

## Lead ingest API

Website forms and portals post leads with a bearer key. Create a key in Settings → Integrations (or use one printed by `pnpm db:seed`). The key decides the lead's source.

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
        "name": "Priya Sharma",
        "phone": "98450 12345",
        "email": "priya@example.com",
        "projectSlug": "aurum-heights",
        "budget": "1.2Cr",
        "configuration": "3 BHK",
        "locality": "Whitefield",
        "notes": "Call after 6 pm"
      }'
```

Only `name` and `phone` are required; Indian numbers without `+91` are accepted. Responses: `201` new lead, `202` duplicate (the existing lead with that phone gets a timeline entry and a call-back follow-up), `401` bad or revoked key, `422` validation errors.

Admins can also upload a CSV at Settings → Import (or `POST /api/ingest/csv` as multipart form data with `file` and an optional `source`).

## Meta Lead Ads webhook

Set these in `.env`:

- `META_APP_SECRET`: your Meta app's secret, used to verify the `X-Hub-Signature-256` header on every delivery.
- `META_WEBHOOK_VERIFY_TOKEN`: any random string you choose; Meta echoes it back during subscription.
- `APP_URL`: the public HTTPS base URL of this app (Settings → Integrations shows the resulting callback URL).

Then, in the Meta App Dashboard:

1. Open your app → **Webhooks**, and pick the **Page** object.
2. Click **Subscribe to this object** and enter:
   - Callback URL: `<APP_URL>/api/webhooks/meta`
   - Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`
3. Subscribe to the **`leadgen`** field.
4. Make sure the app is installed on your Facebook Page (with the `leads_retrieval` permission) so lead-form submissions are delivered.

Meta sends only a lead ID; the app fetches the lead with the stored page token (or `META_ACCESS_TOKEN`) and ingests it as source `META_LEAD_AD`. Deliveries are recorded once per lead ID, so Meta's redeliveries of a lead that was already received are ignored rather than ingested twice. A delivery that fails (for example no token yet, or a Graph API error) is not retried automatically: it shows under **Settings → Integrations → Webhook events**, where an admin can retry it, or all of them, once the cause is fixed. Deliveries stuck in processing for over 15 minutes show there too.

## Meta Ads (MCP)

The Ads screen and the lead-form sync talk to Meta through its Ads MCP server by default.

- `META_ACCESS_TOKEN`: a long-lived token with the scopes **`ads_read`**, **`leads_retrieval`** and **`pages_read_engagement`**. Alternatively save a page token in Settings → Integrations; a saved token wins over the env var and is stored encrypted with `ENCRYPTION_KEY`. With neither, `/ads` shows "Meta isn't connected".
- `META_MCP_URL`: the MCP server URL; default `https://mcp.facebook.com/ads`. An MCP URL saved in Settings → Integrations wins over this.
- `META_GATEWAY=graph`: skip MCP and call the Graph API directly (`META_GRAPH_VERSION`, default `v24.0`). Use this as the fallback if the MCP server is unavailable to you.
- `META_MCP_TOOL_MAP`: overrides the MCP tool name used for each operation, as a JSON object with any of the keys `listCampaigns`, `getInsights`, `listLeadForms`:

  ```bash
  META_MCP_TOOL_MAP='{"listCampaigns":"get_campaigns","getInsights":"get_insights","listLeadForms":"get_lead_forms"}'
  ```

  The defaults (`ads_get_campaigns`, `ads_get_insights`, `ads_get_lead_forms`) have **not been verified against Meta's live MCP server**. If one is wrong, the Ads screen shows a "Meta MCP tool unavailable" panel that lists the tool names the server actually offers; copy the right names from it into `META_MCP_TOOL_MAP` and restart.

## Changing the database schema

Migrations are written by hand and applied with `migrate deploy`; do not use `prisma migrate dev`, `migrate reset` or `db push`.

1. Edit `prisma/schema.prisma`.
2. Add a new folder `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` containing the SQL for the change (`pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` prints it against your current database).
3. Run `pnpm db:deploy`, `pnpm db:test:prepare` and `pnpm prisma generate`.
4. If you added a table, add it to `src/lib/db-tables.ts` so the test reset and the seed wipe include it.
