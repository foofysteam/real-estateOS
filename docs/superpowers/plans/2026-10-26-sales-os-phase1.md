# Sales OS Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first real-estate sales CRM that ingests leads from every source into one deduplicated record, drives agents through a fixed pipeline, and reads live Meta Ads data through Meta's MCP server.

**Architecture:** Next.js 16 App Router monolith. All domain logic lives in `src/lib/**` as pure or Prisma-backed functions with unit/integration tests; route handlers and server actions are thin adapters. Meta is reached two ways: Lead Ads webhooks (Graph API fetch) for ingestion, and an MCP client (`@modelcontextprotocol/sdk`) behind a `MetaAdsGateway` interface for campaign/insight/lead-form reads.

**Tech Stack:** TypeScript 5 strict · Node 22 · pnpm · Next.js 16.4 · React 19 · Tailwind CSS 4 · Radix UI · lucide-react · @dnd-kit · Prisma 7.10 + @prisma/adapter-pg · PostgreSQL 16 · Zod 4 · Vitest 5 + Testing Library · @node-rs/argon2 · @modelcontextprotocol/sdk 1.32

**Spec:** `docs/superpowers/specs/2026-10-26-sales-os-phase1-design.md`

## Global Constraints

- TypeScript `strict: true`; `pnpm build` and `pnpm lint` must exit 0.
- Next.js 16: use `proxy.ts`, never `middleware.ts`; `await params`, `await searchParams`, `await cookies()`.
- Tailwind 4 tokens on `:root` / `.dark` exactly as listed in spec §7.1; accent `#2563eb` light, `#60a5fa` dark.
- Prisma 7: `prisma.config.ts` holds the datasource URL; generator `prisma-client` outputs to `src/generated/prisma`; client built with `new PrismaPg({ connectionString })`.
- Phone stored E.164, default region `IN`. Money stored as integer paise, displayed with Indian grouping.
- Every Lead mutation writes a `LeadEvent`.
- Session cookie name `sales_os_session`, `HttpOnly`, `SameSite=Lax`, 30-day expiry.
- Every screen usable at 360 px; touch targets ≥ 44 px; bottom tab bar `< md`, sidebar `≥ lg`.
- Tests: `pnpm test` runs both Vitest projects (`unit` node env, `ui` jsdom) in < 90 s. DB tests use `DATABASE_URL_TEST`.
- Commit after every task with a conventional-commit message.

## Review Focus

1. **Messy phone input** (`"098450 12345"`, `"+91-98450-12345"`, `"9845012345"`) must all normalise to `+919845012345`; `"12"` must be rejected with `422`, never create a Lead. → test added in Task 3 (`normalizePhone`) and Task 6 (ingest route 422).
2. **Meta webhook retry** delivering the same `leadgen_id` twice must yield one Lead, one `CREATED` event, one `WebhookEvent`. → test added in Task 7.
3. **Meta MCP catalog missing a mapped tool** must render the `MetaToolUnavailableError` message on `/ads`, not a 500. → tests in Task 8 (error shape) and Task 15 (page renders message).
4. **Stage change to `LOST` without `lostReason`** must be rejected by `changeStage` server-side regardless of UI. → test added in Task 5.
5. **CSV row with unparsable budget** (`"ask"`) must fail that row only; rows before and after still import. → test added in Task 6.

---

### Task 1: Project scaffold, tooling, env schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `.env.example`, `.env`, `README.md`
- Create: `src/app/layout.tsx`, `src/app/page.tsx` (redirects to `/today`), `src/app/globals.css` (tokens only, components come in Task 9)
- Create: `src/lib/env.ts`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Produces: `getEnv(): Env` from `src/lib/env.ts`, memoised, throws `EnvError` listing missing keys. `Env` fields: `DATABASE_URL`, `DATABASE_URL_TEST?`, `SESSION_SECRET` (≥32 chars), `ENCRYPTION_KEY` (64 hex), `META_APP_SECRET?`, `META_WEBHOOK_VERIFY_TOKEN?`, `META_ACCESS_TOKEN?`, `META_MCP_URL` (default `https://mcp.facebook.com/ads`), `META_MCP_TOOL_MAP?` (JSON string), `META_GATEWAY` (`"mcp" | "graph"`, default `mcp`), `META_GRAPH_VERSION` (default `v24.0`). Also `resetEnvForTests(): void`.

- [ ] **Step 1: Scaffold Next.js 16 with pnpm**

Run: `cd /home/user/sales-os && pnpm dlx create-next-app@16.4.3 . --ts --app --tailwind --eslint --src-dir --turbopack --import-alias "@/*" --use-pnpm --yes --skip-install` then `pnpm install`. If create-next-app refuses a non-empty directory, scaffold into `/tmp/scaffold`, copy everything except `.git` over, and keep `docs/`.

- [ ] **Step 2: Add dependencies**

Run:
```bash
pnpm add zod@4 @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg @node-rs/argon2 @modelcontextprotocol/sdk@1.32.2 lucide-react @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-slot @dnd-kit/core @dnd-kit/sortable libphonenumber-js clsx
pnpm add -D prisma@7.10.1 vitest@5 @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/pg tsx
```

- [ ] **Step 3: Configure Vitest with two projects**

`vitest.config.ts`: `projects: [{ name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"], setupFiles: ["./vitest.setup.ts"], fileParallelism: false }, { name: "ui", environment: "jsdom", include: ["tests/ui/**/*.test.tsx"], setupFiles: ["./vitest.setup.ts"], plugins: [react()] }]`. Alias `@` → `./src`. `vitest.setup.ts` imports `@testing-library/jest-dom/vitest` and sets `process.env.NODE_ENV = "test"`.

Scripts in `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"db:migrate": "prisma migrate dev"`, `"db:deploy": "prisma migrate deploy"`, `"db:seed": "tsx prisma/seed.ts"`, `"db:test:prepare": "DATABASE_URL=$DATABASE_URL_TEST prisma migrate deploy"`.

- [ ] **Step 4: Write the failing env test**

```ts
// tests/unit/env.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getEnv, resetEnvForTests, EnvError } from "@/lib/env";

const good = {
  DATABASE_URL: "postgresql://salesos:salesos@localhost:5432/salesos",
  SESSION_SECRET: "x".repeat(32),
  ENCRYPTION_KEY: "a".repeat(64),
};

describe("getEnv", () => {
  beforeEach(() => { resetEnvForTests(); for (const k of Object.keys(process.env)) if (k.startsWith("META_") || k in good) delete process.env[k]; });

  it("applies defaults for META_MCP_URL, META_GATEWAY, META_GRAPH_VERSION", () => {
    Object.assign(process.env, good);
    const env = getEnv();
    expect(env.META_MCP_URL).toBe("https://mcp.facebook.com/ads");
    expect(env.META_GATEWAY).toBe("mcp");
    expect(env.META_GRAPH_VERSION).toBe("v24.0");
  });

  it("throws EnvError naming every missing required key", () => {
    process.env.DATABASE_URL = good.DATABASE_URL;
    expect(() => getEnv()).toThrow(EnvError);
    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
    expect(() => getEnv()).toThrow(/ENCRYPTION_KEY/);
  });

  it("rejects a SESSION_SECRET shorter than 32 chars", () => {
    Object.assign(process.env, good, { SESSION_SECRET: "short" });
    expect(() => getEnv()).toThrow(EnvError);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/env.test.ts`
Expected: FAIL, cannot resolve `@/lib/env`.

- [ ] **Step 6: Implement `src/lib/env.ts`**

Zod schema per the Interfaces block; `getEnv()` memoises the parsed object; `EnvError extends Error` whose message is `"Invalid environment: " + issues.map(i => i.path.join(".")).join(", ")`.

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Write `.env.example` and `.env`**

`.env.example` lists every key from the Interfaces block with a comment each. `.env` (git-ignored) holds the local values: `DATABASE_URL=postgresql://salesos:salesos@localhost:5432/salesos`, `DATABASE_URL_TEST=postgresql://salesos:salesos@localhost:5432/salesos_test`, a generated `SESSION_SECRET` (`openssl rand -hex 32`), a generated `ENCRYPTION_KEY` (`openssl rand -hex 32`).

- [ ] **Step 9: Verify build and lint pass on the empty app**

Run: `pnpm lint && pnpm build`
Expected: both exit 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with Vitest, Tailwind 4 and env schema"
```

---

### Task 2: Prisma schema, migration, DB client, test helpers

**Files:**
- Create: `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/*` (generated)
- Create: `src/lib/db.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/integration/db.test.ts`

**Interfaces:**
- Produces: `db: PrismaClient` from `src/lib/db.ts` (singleton; uses `DATABASE_URL_TEST` when `NODE_ENV === "test"`). Enums `LeadSource`, `LeadStage`, `LeadEventType`, `FollowUpChannel`, `Role`, `WebhookStatus` exported from `src/generated/prisma/client`. `resetDb(): Promise<void>` from `tests/helpers/db.ts` truncates every table with `TRUNCATE ... RESTART IDENTITY CASCADE`.

- [ ] **Step 1: Write the schema**

Models and fields exactly per spec §4. Additional constraints: `Lead.phone @unique`; `WebhookEvent @@unique([provider, externalId])`; `MetaConnection.id Int @id @default(1)`; `Lead` indexes on `[stage]`, `[ownerId]`, `[nextFollowUpAt]`, `[createdAt]`; `LeadEvent @@index([leadId, createdAt])`; `FollowUp @@index([ownerId, dueAt])`. All ids `String @id @default(cuid())` except `MetaConnection`. `payload`/`raw` are `Json`. `MetaConnection.leadFormIds String[]`.

`prisma.config.ts`:
```ts
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DATABASE_URL! },
});
```
Generator: `provider = "prisma-client"`, `output = "../src/generated/prisma"`. Add `src/generated` to `.gitignore` and `eslint` ignores.

- [ ] **Step 2: Create and apply the migration to dev and test DBs**

Run: `set -a && . ./.env && set +a && pnpm prisma migrate dev --name init && pnpm db:test:prepare`
Expected: migration folder created; both databases report "already in sync" / applied.

- [ ] **Step 3: Write the failing DB test**

```ts
// tests/integration/db.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "../helpers/db";

describe("db", () => {
  beforeEach(resetDb);
  it("connects to the test database and round-trips a Project", async () => {
    const p = await db.project.create({ data: { name: "Krishvi Triple One", slug: "krishvi-111", city: "Bengaluru", priceMinPaise: 850000000, priceMaxPaise: 1600000000 } });
    expect((await db.project.findUnique({ where: { id: p.id } }))?.slug).toBe("krishvi-111");
    expect(process.env.DATABASE_URL_TEST).toBeDefined();
  });
  it("starts every test empty", async () => {
    expect(await db.project.count()).toBe(0);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run tests/integration/db.test.ts`
Expected: FAIL, cannot resolve `@/lib/db`.

- [ ] **Step 5: Implement `src/lib/db.ts` and `tests/helpers/db.ts`**

`db.ts` picks the URL from `getEnv()` per `NODE_ENV`, builds `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`, caches on `globalThis` in development. `resetDb` runs one `TRUNCATE` over the table list read from `Prisma.dmmf`-free constant array of the 8 table names.

Also load `.env` in tests: in `vitest.setup.ts` call `loadEnvConfig(process.cwd())` from `@next/env` before anything else.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/integration/db.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema, initial migration and db client"
```

---

### Task 3: Domain utilities — phone, money, stages, score

**Files:**
- Create: `src/lib/phone.ts`, `src/lib/money.ts`, `src/lib/stages.ts`, `src/lib/score.ts`
- Test: `tests/unit/phone.test.ts`, `tests/unit/money.test.ts`, `tests/unit/stages.test.ts`, `tests/unit/score.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(raw: string, defaultRegion = "IN"): string | null` (E.164 or null when invalid), `toWaLink(e164: string): string` → `https://wa.me/919845012345`, `toTelLink(e164: string): string`.
  - `parseRupeesToPaise(input: string | number): number | null` (accepts `"45L"`, `"45 lakh"`, `"1.2Cr"`, `"1.2 crore"`, `"45,00,000"`, `4500000`), `formatPaise(paise: number): string` → `"₹45,00,000"`, `formatPaiseShort(paise: number): string` → `"₹45L"` / `"₹1.2Cr"`.
  - `STAGE_ORDER: readonly LeadStage[]`, `STAGE_LABELS: Record<LeadStage,string>`, `STAGE_COLORS: Record<LeadStage,{bg:string;fg:string}>`, `canTransition(from: LeadStage, to: LeadStage): boolean`, `isTerminal(stage: LeadStage): boolean`.
  - `computeScore(input: { source: LeadSource; budgetPaise?: number|null; configuration?: string|null; locality?: string|null; email?: string|null; project?: { priceMinPaise: number; priceMaxPaise: number } | null }): number`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/phone.test.ts
it.each([
  ["098450 12345", "+919845012345"],
  ["+91-98450-12345", "+919845012345"],
  ["9845012345", "+919845012345"],
  ["+1 (415) 555-2671", "+14155552671"],
])("normalizePhone(%s) -> %s", (raw, e164) => expect(normalizePhone(raw)).toBe(e164));
it("returns null for junk", () => { expect(normalizePhone("12")).toBeNull(); expect(normalizePhone("call me")).toBeNull(); });
it("builds wa.me and tel links", () => { expect(toWaLink("+919845012345")).toBe("https://wa.me/919845012345"); expect(toTelLink("+919845012345")).toBe("tel:+919845012345"); });

// tests/unit/money.test.ts
it.each([["45L", 450000000], ["45 lakh", 450000000], ["1.2Cr", 1200000000], ["1.2 crore", 1200000000], ["45,00,000", 450000000], [4500000, 450000000], ["ask", null], ["", null]])
  ("parseRupeesToPaise(%s) -> %s", (i, o) => expect(parseRupeesToPaise(i)).toBe(o));
it("formats with Indian grouping", () => { expect(formatPaise(450000000)).toBe("₹45,00,000"); expect(formatPaise(1200000000)).toBe("₹1,20,00,000"); });
it("formats short", () => { expect(formatPaiseShort(450000000)).toBe("₹45L"); expect(formatPaiseShort(1200000000)).toBe("₹1.2Cr"); expect(formatPaiseShort(5000000)).toBe("₹50K"); });

// tests/unit/stages.test.ts
it("allows forward jumps of any size", () => expect(canTransition("NEW", "NEGOTIATION")).toBe(true));
it("allows exactly one step back", () => { expect(canTransition("QUALIFIED", "CONTACTED")).toBe(true); expect(canTransition("QUALIFIED", "NEW")).toBe(false); });
it("allows LOST from anywhere and only NEW from LOST", () => { expect(canTransition("BOOKED", "LOST")).toBe(true); expect(canTransition("LOST", "NEW")).toBe(true); expect(canTransition("LOST", "QUALIFIED")).toBe(false); });
it("BOOKED is terminal except LOST", () => { expect(canTransition("BOOKED", "NEGOTIATION")).toBe(false); expect(isTerminal("BOOKED")).toBe(true); expect(isTerminal("LOST")).toBe(true); expect(isTerminal("NEW")).toBe(false); });
it("STAGE_ORDER has 8 stages ending in BOOKED, LOST", () => expect(STAGE_ORDER.slice(-2)).toEqual(["BOOKED", "LOST"]));

// tests/unit/score.test.ts
const project = { priceMinPaise: 800000000, priceMaxPaise: 1600000000 };
it("scores a bare Meta lead at 40", () => expect(computeScore({ source: "META_LEAD_AD" })).toBe(40));
it("adds budget-in-range, configuration, locality, email", () => expect(computeScore({ source: "REFERRAL", budgetPaise: 1000000000, configuration: "3BHK", locality: "Whitefield", email: "a@b.c", project })).toBe(100));
it("ignores budget when out of range or no project", () => { expect(computeScore({ source: "WEBSITE", budgetPaise: 100, project })).toBe(45); expect(computeScore({ source: "WEBSITE", budgetPaise: 1000000000 })).toBe(45); });
it("clamps to 100", () => expect(computeScore({ source: "REFERRAL", budgetPaise: 900000000, configuration: "x", locality: "y", email: "z", project })).toBeLessThanOrEqual(100));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/phone.test.ts tests/unit/money.test.ts tests/unit/stages.test.ts tests/unit/score.test.ts`
Expected: FAIL on unresolved imports.

- [ ] **Step 3: Implement the four modules**

`phone.ts` uses `libphonenumber-js` `parsePhoneNumberFromString(raw, defaultRegion)` and returns `.number` only when `.isValid()`. `money.ts`: regex `^\s*([\d.,]+)\s*(l|lakh|lac|cr|crore|k)?\s*$` case-insensitive, strip commas, multiply (`L`=1e5, `Cr`=1e7, `K`=1e3), return `Math.round(rupees * 100)`; `formatPaise` uses `Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })`; `formatPaiseShort` picks Cr ≥ 1e7 rupees, L ≥ 1e5, K ≥ 1e3, one decimal trimmed of trailing `.0`. `stages.ts` colours: NEW slate, CONTACTED sky, QUALIFIED indigo, SITE_VISIT_SCHEDULED violet, SITE_VISIT_DONE purple, NEGOTIATION amber, BOOKED emerald, LOST rose (Tailwind 500 for `fg`, 100/900 for `bg` light/dark via CSS vars `--stage-<name>`). `score.ts` per spec §4.2.

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/phone.ts src/lib/money.ts src/lib/stages.ts src/lib/score.ts tests/unit
git commit -m "feat: add phone, money, stage and score domain utilities"
```

---

### Task 4: Auth — passwords, sessions, crypto, proxy, login API

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/auth/current-user.ts`, `src/lib/crypto.ts`
- Create: `src/proxy.ts`
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
- Test: `tests/unit/password.test.ts`, `tests/unit/session.test.ts`, `tests/unit/crypto.test.ts`, `tests/integration/auth-route.test.ts`

**Interfaces:**
- Consumes: `db`, `getEnv`.
- Produces:
  - `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`.
  - `signSession(payload: { userId: string; exp: number }): string`, `verifySession(token: string): { userId: string; exp: number } | null`, `SESSION_COOKIE = "sales_os_session"`, `sessionCookieOptions(exp: Date)`.
  - `getCurrentUser(): Promise<{ id: string; email: string; name: string; role: Role } | null>` (reads `await cookies()`), `requireUser(role?: Role)` throws `redirect("/login")` or `403`.
  - `encrypt(plain: string): string` (`iv.ciphertext.tag` base64url, AES-256-GCM, key = `ENCRYPTION_KEY`), `decrypt(token: string): string`.
  - `POST /api/auth/login` body `{ email, password }` → `200 { user }` + cookie, `401 { error: "Invalid credentials" }`. `POST /api/auth/logout` clears cookie → `204`.

- [ ] **Step 1: Write the failing unit tests**

```ts
// tests/unit/password.test.ts
it("hashes and verifies", async () => { const h = await hashPassword("pass1234"); expect(h.startsWith("$argon2id$")).toBe(true); expect(await verifyPassword("pass1234", h)).toBe(true); expect(await verifyPassword("nope", h)).toBe(false); });

// tests/unit/session.test.ts
it("round-trips a payload", () => { const t = signSession({ userId: "u1", exp: Date.now() + 1000 }); expect(verifySession(t)?.userId).toBe("u1"); });
it("rejects tampered tokens", () => { const t = signSession({ userId: "u1", exp: Date.now() + 1000 }); expect(verifySession(t.slice(0, -2) + "zz")).toBeNull(); });
it("rejects expired tokens", () => { expect(verifySession(signSession({ userId: "u1", exp: Date.now() - 1 }))).toBeNull(); });

// tests/unit/crypto.test.ts
it("encrypts to a different string each time and decrypts", () => { const a = encrypt("EAAB..."); const b = encrypt("EAAB..."); expect(a).not.toBe(b); expect(decrypt(a)).toBe("EAAB..."); });
it("throws on tampered ciphertext", () => { const a = encrypt("x"); expect(() => decrypt(a.replace(/.$/, "A"))).toThrow(); });
```

- [ ] **Step 2: Write the failing integration test**

```ts
// tests/integration/auth-route.test.ts
beforeEach(async () => { await resetDb(); await db.user.create({ data: { email: "admin@sc.studio", name: "Admin", role: "ADMIN", passwordHash: await hashPassword("pass1234") } }); });
it("logs in and sets the session cookie", async () => {
  const res = await POST(new Request("http://x/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@sc.studio", password: "pass1234" }), headers: { "content-type": "application/json" } }));
  expect(res.status).toBe(200);
  expect(res.headers.get("set-cookie")).toMatch(/sales_os_session=.+HttpOnly/);
});
it("returns 401 on wrong password", async () => { /* same request with password "bad" */ expect(res.status).toBe(401); });
it("returns 401 for inactive user", async () => { await db.user.updateMany({ data: { isActive: false } }); /* login */ expect(res.status).toBe(401); });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/password.test.ts tests/unit/session.test.ts tests/unit/crypto.test.ts tests/integration/auth-route.test.ts`
Expected: FAIL on unresolved imports.

- [ ] **Step 4: Implement**

`session.ts`: token = `base64url(JSON) + "." + base64url(HMAC-SHA256(SESSION_SECRET, base64url(JSON)))`; constant-time compare with `timingSafeEqual`. `proxy.ts`: `config.matcher = ["/((?!api|_next|login|favicon.ico).*)"]`; redirect to `/login` when cookie missing or `verifySession` null (import only `session.ts`, no Prisma, so it stays light). `login/route.ts` normalises email to lower-case and uses `cookies().set(SESSION_COOKIE, token, sessionCookieOptions(exp))`.

- [ ] **Step 5: Run tests to verify they pass**

Run: same command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add password hashing, signed sessions, token encryption and login API"
```

---

### Task 5: Lead service — ingest, dedupe, stage, assign, notes, follow-ups

**Files:**
- Create: `src/lib/leads/types.ts`, `src/lib/leads/ingest.ts`, `src/lib/leads/service.ts`
- Test: `tests/integration/lead-ingest.test.ts`, `tests/integration/lead-service.test.ts`

**Interfaces:**
- Consumes: `db`, `normalizePhone`, `computeScore`, `canTransition`.
- Produces:
  - `NormalizedLead` type (spec §5.1) and `normalizedLeadSchema: z.ZodType<NormalizedLead>` in `types.ts`.
  - `ingestLead(input: NormalizedLead, actorId?: string): Promise<{ leadId: string; deduplicated: boolean }>`; throws `InvalidPhoneError` when `normalizePhone` returns null.
  - `changeStage(leadId: string, to: LeadStage, actorId: string, opts?: { lostReason?: string }): Promise<Lead>`; throws `InvalidTransitionError`, `LostReasonRequiredError`.
  - `assignLead(leadId, ownerId: string | null, actorId): Promise<Lead>`
  - `addNote(leadId, text: string, actorId): Promise<LeadEvent>`
  - `updateLeadFields(leadId, patch: Partial<Pick<Lead,"name"|"email"|"budgetPaise"|"configuration"|"locality"|"projectId">>, actorId): Promise<Lead>` (recomputes score, emits `FIELD_UPDATED` and `SCORE_CHANGED` when score differs)
  - `logContact(leadId, channel: FollowUpChannel, note: string | undefined, actorId): Promise<Lead>` (sets `lastContactedAt`, emits `CONTACT_LOGGED`; moves `NEW`→`CONTACTED`)
  - `scheduleFollowUp(leadId, input: { dueAt: Date; channel: FollowUpChannel; note?: string; ownerId: string }, actorId): Promise<FollowUp>` (sets `lead.nextFollowUpAt` to the earliest open follow-up)
  - `completeFollowUp(followUpId, actorId): Promise<FollowUp>` (recomputes `nextFollowUpAt`)

- [ ] **Step 1: Write the failing ingest tests**

```ts
// tests/integration/lead-ingest.test.ts
const base: NormalizedLead = { source: "WEBSITE", name: "Rohan Mehta", phone: "98450 12345", receivedAt: new Date() };
it("creates a lead with E.164 phone, score and CREATED event", async () => {
  const r = await ingestLead(base);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: r.leadId }, include: { events: true } });
  expect(r.deduplicated).toBe(false); expect(lead.phone).toBe("+919845012345"); expect(lead.score).toBe(45); expect(lead.stage).toBe("NEW");
  expect(lead.events.map(e => e.type)).toEqual(["CREATED"]);
});
it("deduplicates on phone and appends DUPLICATE_INBOUND", async () => {
  const a = await ingestLead(base); const b = await ingestLead({ ...base, phone: "+91-98450-12345", source: "META_LEAD_AD" });
  expect(b).toEqual({ leadId: a.leadId, deduplicated: true });
  expect(await db.lead.count()).toBe(1);
  const ev = await db.leadEvent.findMany({ where: { leadId: a.leadId }, orderBy: { createdAt: "asc" } });
  expect(ev.map(e => e.type)).toEqual(["CREATED", "DUPLICATE_INBOUND"]);
  expect((await db.lead.findUniqueOrThrow({ where: { id: a.leadId } })).nextFollowUpAt).not.toBeNull();
});
it("does not set nextFollowUpAt on a duplicate for a LOST lead", async () => { /* create, changeStage LOST, re-ingest */ expect(lead.nextFollowUpAt).toBeNull(); });
it("resolves projectSlug and scores budget in range", async () => { /* create project 80L-1.6Cr; ingest with projectSlug and budgetPaise 1e9 */ expect(lead.projectId).toBe(project.id); expect(lead.score).toBe(65); });
it("throws InvalidPhoneError for junk phone", async () => { await expect(ingestLead({ ...base, phone: "12" })).rejects.toBeInstanceOf(InvalidPhoneError); expect(await db.lead.count()).toBe(0); });
```

- [ ] **Step 2: Write the failing service tests**

```ts
// tests/integration/lead-service.test.ts
it("moves forward and records STAGE_CHANGED with from/to", async () => { const l = await changeStage(leadId, "QUALIFIED", actor.id); expect(l.stage).toBe("QUALIFIED"); const ev = await lastEvent(leadId); expect(ev.type).toBe("STAGE_CHANGED"); expect(ev.payload).toEqual({ from: "NEW", to: "QUALIFIED" }); });
it("rejects two steps back", async () => { await changeStage(leadId, "QUALIFIED", actor.id); await expect(changeStage(leadId, "NEW", actor.id)).rejects.toBeInstanceOf(InvalidTransitionError); });
it("requires lostReason for LOST", async () => { await expect(changeStage(leadId, "LOST", actor.id)).rejects.toBeInstanceOf(LostReasonRequiredError); const l = await changeStage(leadId, "LOST", actor.id, { lostReason: "Budget" }); expect(l.lostReason).toBe("Budget"); });
it("assigns and unassigns with ASSIGNED events", async () => { /* assign agent, then null */ expect(events.filter(e => e.type === "ASSIGNED")).toHaveLength(2); });
it("addNote stores text in payload.text", async () => { const e = await addNote(leadId, "Prefers east facing", actor.id); expect(e.payload).toEqual({ text: "Prefers east facing" }); });
it("updateLeadFields recomputes score and emits SCORE_CHANGED", async () => { await updateLeadFields(leadId, { configuration: "3BHK" }, actor.id); expect(lead.score).toBe(55); expect(types).toContain("SCORE_CHANGED"); });
it("logContact moves NEW to CONTACTED and sets lastContactedAt", async () => { ... });
it("scheduleFollowUp sets nextFollowUpAt to earliest open; completeFollowUp advances it", async () => { /* schedule +2d and +1d; expect nextFollowUpAt == +1d; complete +1d; expect +2d; complete +2d; expect null */ });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/integration/lead-ingest.test.ts tests/integration/lead-service.test.ts`
Expected: FAIL on unresolved imports.

- [ ] **Step 4: Implement `types.ts`, `ingest.ts`, `service.ts`**

All multi-row writes inside `db.$transaction`. `ingestLead` resolves project by slug (ignore unknown slug), computes score with the project's price band, and on dedupe writes `payload = { ...input, phone: e164 }`.

- [ ] **Step 5: Run tests to verify they pass**

Run: same command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add lead ingest with dedupe and lead lifecycle service"
```

---

### Task 6: Ingest API — bearer keys, generic endpoint, CSV import

**Files:**
- Create: `src/lib/ingest-keys.ts`, `src/lib/csv.ts`
- Create: `src/app/api/ingest/route.ts`, `src/app/api/ingest/csv/route.ts`
- Test: `tests/unit/csv.test.ts`, `tests/integration/ingest-route.test.ts`

**Interfaces:**
- Consumes: `ingestLead`, `getCurrentUser`, `parseRupeesToPaise`.
- Produces:
  - `createIngestKey(name: string, source: LeadSource): Promise<{ id: string; plaintext: string }>` (plaintext `sk_live_` + 32 hex, stored as SHA-256), `resolveIngestKey(plaintext: string): Promise<IngestKey | null>` (active only; bumps `lastUsedAt`), `revokeIngestKey(id): Promise<void>`.
  - `parseLeadsCsv(text: string, source: LeadSource): { rows: NormalizedLead[]; errors: { line: number; message: string }[] }`.
  - `POST /api/ingest` → `201 { leadId, deduplicated:false }` / `202 { leadId, deduplicated:true }` / `401` / `422 { issues }`.
  - `POST /api/ingest/csv` (ADMIN) → `200 { created, deduplicated, errors: {line,message}[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/csv.test.ts
const csv = `name,phone,email,project,budget,configuration,locality,notes
Rohan,9845012345,r@x.in,krishvi-111,45L,2BHK,Whitefield,
Priya,9845000000,,,ask,3BHK,,
Amit,9845099999,,,1.2Cr,,,vip`;
it("parses valid rows and reports the bad budget row by line", () => {
  const r = parseLeadsCsv(csv, "CSV_IMPORT");
  expect(r.rows).toHaveLength(2); expect(r.rows[0].budgetPaise).toBe(450000000); expect(r.rows[1].name).toBe("Amit");
  expect(r.errors).toEqual([{ line: 3, message: expect.stringMatching(/budget/i) }]);
});
it("rejects missing name or phone per row", () => { expect(parseLeadsCsv("name,phone\n,9845012345", "CSV_IMPORT").errors[0].line).toBe(2); });

// tests/integration/ingest-route.test.ts
it("creates a lead with a valid key and stamps the key's source", async () => { const k = await createIngestKey("site", "WEBSITE"); const res = await POST(req({ name: "R", phone: "9845012345" }, k.plaintext)); expect(res.status).toBe(201); expect((await db.lead.findFirst())?.source).toBe("WEBSITE"); });
it("returns 202 on duplicate", async () => { ... expect(res2.status).toBe(202); });
it("returns 401 for unknown or revoked key", async () => { ... });
it("returns 422 for junk phone and creates nothing", async () => { const res = await POST(req({ name: "R", phone: "12" }, k.plaintext)); expect(res.status).toBe(422); expect(await db.lead.count()).toBe(0); });
it("csv route imports good rows and lists errors", async () => { /* FormData with file + source; mock getCurrentUser → ADMIN via vi.mock("@/lib/auth/current-user") */ expect(body.created).toBe(2); expect(body.errors).toHaveLength(1); });
it("csv route returns 403 for AGENT", async () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/csv.test.ts tests/integration/ingest-route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

CSV parsing by hand (split lines, handle quoted commas with a small state machine; no dependency). Generic ingest body schema: `name` 1..120, `phone` string, optional `email` (email), `projectSlug`, `budget` (string|number → `parseRupeesToPaise`), `configuration`, `locality`, `notes`, `externalId`. `InvalidPhoneError` → `422 { issues: [{ path: ["phone"], message: "Invalid phone number" }] }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ingest API with bearer keys and CSV import"
```

---

### Task 7: Meta Lead Ads webhook

**Files:**
- Create: `src/lib/meta/webhook.ts`, `src/lib/meta/graph.ts`, `src/lib/meta/token.ts`
- Create: `src/app/api/webhooks/meta/route.ts`
- Test: `tests/unit/meta-webhook.test.ts`, `tests/integration/meta-webhook-route.test.ts`

**Interfaces:**
- Consumes: `ingestLead`, `decrypt`, `getEnv`, `db`.
- Produces:
  - `verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean`
  - `extractLeadgenIds(body: unknown): { leadgenId: string; pageId: string; formId: string; createdTime: number }[]`
  - `mapFieldData(lead: { id: string; created_time: string; field_data: { name: string; values: string[] }[]; form_id?: string; ad_id?: string }): NormalizedLead` (spec §5.4 mapping; `externalId = lead.id`)
  - `fetchLeadgen(leadgenId: string, token: string, fetchImpl = fetch): Promise<NormalizedLead>` (GET `https://graph.facebook.com/{META_GRAPH_VERSION}/{id}?fields=field_data,created_time,ad_id,form_id`)
  - `getMetaAccessToken(): Promise<string | null>` (MetaConnection decrypted, else env)
  - `handleMetaWebhook(rawBody: string, signature: string | null, deps: { schedule: (fn: () => Promise<void>) => void; fetchImpl?: typeof fetch }): Promise<{ status: 200 | 401; accepted: number }>`
  - Route: `GET` challenge, `POST` → `handleMetaWebhook` with `schedule = after`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/meta-webhook.test.ts
it("verifies a correct sha256 signature and rejects a wrong one", () => { const body = '{"a":1}'; const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex"); expect(verifyMetaSignature(body, sig, "secret")).toBe(true); expect(verifyMetaSignature(body, "sha256=00", "secret")).toBe(false); expect(verifyMetaSignature(body, null, "secret")).toBe(false); });
it("extracts leadgen changes and ignores other fields", () => { const ids = extractLeadgenIds({ object: "page", entry: [{ id: "p1", changes: [{ field: "leadgen", value: { leadgen_id: "L1", page_id: "p1", form_id: "f1", created_time: 1 } }, { field: "feed", value: {} }] }] }); expect(ids).toEqual([{ leadgenId: "L1", pageId: "p1", formId: "f1", createdTime: 1 }]); });
it("maps field_data into a NormalizedLead", () => {
  const n = mapFieldData({ id: "L1", created_time: "2026-10-26T10:00:00+0000", form_id: "f1", field_data: [{ name: "full_name", values: ["Rohan"] }, { name: "phone_number", values: ["+919845012345"] }, { name: "email", values: ["r@x.in"] }, { name: "what_is_your_budget?", values: ["45L"] }, { name: "preferred_bhk", values: ["2BHK"] }, { name: "preferred_location", values: ["Whitefield"] }, { name: "when_to_buy", values: ["3 months"] }] });
  expect(n).toMatchObject({ source: "META_LEAD_AD", name: "Rohan", phone: "+919845012345", email: "r@x.in", budgetPaise: 450000000, configuration: "2BHK", locality: "Whitefield", externalId: "L1" });
  expect(n.notes).toContain("when_to_buy: 3 months");
});

// tests/integration/meta-webhook-route.test.ts  (env META_APP_SECRET=secret, META_ACCESS_TOKEN=tok)
const fetchImpl = vi.fn(async () => new Response(JSON.stringify(graphLead)));
it("GET answers the challenge with the right verify token and 403 otherwise", async () => { ... });
it("POST stores WebhookEvent, returns 200 immediately, then ingests the lead", async () => {
  const scheduled: (() => Promise<void>)[] = [];
  const r = await handleMetaWebhook(body, sig(body), { schedule: fn => scheduled.push(fn), fetchImpl });
  expect(r).toEqual({ status: 200, accepted: 1 });
  expect(await db.lead.count()).toBe(0);
  for (const fn of scheduled) await fn();
  expect(await db.lead.count()).toBe(1);
  expect((await db.webhookEvent.findFirstOrThrow()).status).toBe("PROCESSED");
  expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/v24.0/L1?fields=field_data,created_time,ad_id,form_id"), expect.anything());
});
it("is idempotent on redelivery of the same leadgen_id", async () => { /* deliver twice, run all scheduled */ expect(await db.lead.count()).toBe(1); expect(await db.webhookEvent.count()).toBe(1); expect(await db.leadEvent.count({ where: { type: "CREATED" } })).toBe(1); });
it("marks FAILED with error text when Graph API fails", async () => { fetchImpl.mockResolvedValueOnce(new Response("{}", { status: 500 })); ... expect(ev.status).toBe("FAILED"); expect(ev.error).toMatch(/500/); });
it("returns 401 on bad signature and stores nothing", async () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/meta-webhook.test.ts tests/integration/meta-webhook-route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`handleMetaWebhook`: verify → parse → for each leadgen `db.webhookEvent.upsert` on `[provider, externalId]` (`update: {}` so a redelivery is a no-op and returns the existing row) → schedule processing only for rows whose `status === "RECEIVED"` and `processedAt === null`. Processing: fetch → `ingestLead` → mark `PROCESSED`; on error mark `FAILED` with `error = message`. Route `POST` reads `await req.text()` for the raw body and passes `after` from `next/server` as `schedule`.

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Meta Lead Ads webhook with idempotent ingestion"
```

---

### Task 8: Meta Ads gateway — MCP client and Graph fallback

**Files:**
- Create: `src/lib/meta/gateway.ts`, `src/lib/meta/mcp-gateway.ts`, `src/lib/meta/graph-gateway.ts`, `src/lib/meta/index.ts`
- Test: `tests/unit/mcp-gateway.test.ts`, `tests/unit/graph-gateway.test.ts`

**Interfaces:**
- Consumes: `getEnv`, `getMetaAccessToken`.
- Produces (in `gateway.ts`):
  ```ts
  export type Campaign = { id: string; name: string; status: string; objective: string; dailyBudgetPaise?: number };
  export type Insights = { spendPaise: number; impressions: number; clicks: number; leads: number; costPerLeadPaise?: number };
  export type LeadForm = { id: string; name: string; status: string; leadsCount: number };
  export type DateRange = { since: string; until: string }; // YYYY-MM-DD
  export interface MetaAdsGateway {
    listCampaigns(adAccountId: string): Promise<Campaign[]>;
    getInsights(adAccountId: string, range: DateRange): Promise<Insights>;
    listLeadForms(pageId: string): Promise<LeadForm[]>;
  }
  export class MetaToolUnavailableError extends Error { constructor(public operation: keyof MetaAdsGateway, public available: string[]) }
  export class MetaNotConfiguredError extends Error {}
  export type ToolMap = Record<keyof MetaAdsGateway, string>;
  export const DEFAULT_TOOL_MAP: ToolMap = { listCampaigns: "ads_get_campaigns", getInsights: "ads_get_insights", listLeadForms: "ads_get_lead_forms" };
  ```
  - `mcp-gateway.ts`: `class McpMetaAdsGateway implements MetaAdsGateway { constructor(opts: { connect: () => Promise<Client>; toolMap?: Partial<ToolMap> }) }` where `Client` is `@modelcontextprotocol/sdk/client`. Lazily connects once, calls `client.listTools()` once, caches names. Each operation: resolve name → throw `MetaToolUnavailableError` if absent → `client.callTool({ name, arguments })` → parse `content[0].text` as JSON (fall back to `structuredContent`) → normalise to the types above (`spend` in account currency → paise ×100; `dailyBudget` likewise). `createMcpClientFactory(url: string, token: string): () => Promise<Client>` uses `StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: "Bearer " + token } } })`.
  - `graph-gateway.ts`: `class GraphMetaAdsGateway implements MetaAdsGateway { constructor(opts: { token: string; version: string; fetchImpl?: typeof fetch }) }` hitting `/act_{id}/campaigns?fields=id,name,status,objective,daily_budget`, `/act_{id}/insights?fields=spend,impressions,clicks,actions&time_range=...` (leads = sum of `actions[].value` where `action_type === "lead"`), `/{pageId}/leadgen_forms?fields=id,name,status,leads_count`.
  - `index.ts`: `getMetaGateway(): Promise<MetaAdsGateway>` picks by `META_GATEWAY`; throws `MetaNotConfiguredError` when no token.

- [ ] **Step 1: Write the failing MCP gateway test using an in-memory MCP server**

```ts
// tests/unit/mcp-gateway.test.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
function makeConnect(tools: Record<string, (args: any) => unknown>) {
  return async () => {
    const server = new McpServer({ name: "fake-meta", version: "0" });
    for (const [name, fn] of Object.entries(tools)) server.registerTool(name, { inputSchema: { } }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(fn(args)) }] }));
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "sales-os-test", version: "0" });
    await client.connect(b);
    return client;
  };
}
it("lists campaigns through the default tool name and converts budget to paise", async () => {
  const gw = new McpMetaAdsGateway({ connect: makeConnect({ ads_get_campaigns: () => ({ data: [{ id: "c1", name: "Launch", status: "ACTIVE", objective: "OUTCOME_LEADS", daily_budget: "2000" }] }) }) });
  expect(await gw.listCampaigns("act_1")).toEqual([{ id: "c1", name: "Launch", status: "ACTIVE", objective: "OUTCOME_LEADS", dailyBudgetPaise: 200000 }]);
});
it("honours a custom tool map", async () => { const gw = new McpMetaAdsGateway({ connect: makeConnect({ get_insights_v2: () => ({ spend: "1500.50", impressions: 1000, clicks: 50, actions: [{ action_type: "lead", value: "10" }] }) }), toolMap: { getInsights: "get_insights_v2" } }); expect(await gw.getInsights("act_1", { since: "2026-10-19", until: "2026-10-26" })).toEqual({ spendPaise: 150050, impressions: 1000, clicks: 50, leads: 10, costPerLeadPaise: 15005 }); });
it("throws MetaToolUnavailableError listing available tools when a mapped tool is missing", async () => { const gw = new McpMetaAdsGateway({ connect: makeConnect({ something_else: () => ({}) }) }); const err = await gw.listLeadForms("p1").catch(e => e); expect(err).toBeInstanceOf(MetaToolUnavailableError); expect(err.operation).toBe("listLeadForms"); expect(err.available).toEqual(["something_else"]); expect(err.message).toContain("ads_get_lead_forms"); });
it("connects and lists tools only once across calls", async () => { const connect = vi.fn(makeConnect({ ads_get_campaigns: () => ({ data: [] }), ads_get_lead_forms: () => ({ data: [] }) })); const gw = new McpMetaAdsGateway({ connect }); await gw.listCampaigns("a"); await gw.listLeadForms("p"); expect(connect).toHaveBeenCalledTimes(1); });

// tests/unit/graph-gateway.test.ts
it("builds the campaigns URL with act_ prefix and bearer header", async () => { const f = vi.fn(async () => new Response(JSON.stringify({ data: [] }))); await new GraphMetaAdsGateway({ token: "t", version: "v24.0", fetchImpl: f }).listCampaigns("123"); expect(f.mock.calls[0][0]).toContain("/v24.0/act_123/campaigns?"); expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer t"); });
it("sums lead actions into leads and computes costPerLeadPaise", async () => { ... expect(r.leads).toBe(10); expect(r.costPerLeadPaise).toBe(15005); });
it("getMetaGateway throws MetaNotConfiguredError without a token", async () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/mcp-gateway.test.ts tests/unit/graph-gateway.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the four files**

Tool call argument names: `listCampaigns` → `{ ad_account_id }`, `getInsights` → `{ ad_account_id, time_range: { since, until } }`, `listLeadForms` → `{ page_id }`. Response normalisation accepts either `{ data: [...] }` or a bare array, and either numeric or string money fields. `costPerLeadPaise = leads > 0 ? Math.round(spendPaise / leads) : undefined`.

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Meta Ads gateway with MCP client and Graph API fallback"
```

---

### Task 9: Design system and app shell

**Files:**
- Modify: `src/app/globals.css` (tokens per spec §7.1, stage colour vars, base styles, `prefers-reduced-motion`)
- Create: `src/components/ui/button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `select.tsx`, `tabs.tsx`, `skeleton.tsx`, `sheet.tsx` (Radix Dialog styled as bottom sheet `< md`, side panel `≥ md`), `empty-state.tsx`
- Create: `src/components/shell/app-shell.tsx`, `sidebar.tsx`, `bottom-nav.tsx`, `theme-toggle.tsx`, `user-menu.tsx`, `nav-items.ts`
- Create: `src/components/leads/stage-badge.tsx`, `score-ring.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/lib/cn.ts`
- Test: `tests/ui/bottom-nav.test.tsx`, `tests/ui/theme-toggle.test.tsx`, `tests/ui/stage-badge.test.tsx`

**Interfaces:**
- Produces: `NAV_ITEMS: { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }[]` = Today `/today`, Leads `/leads`, Pipeline `/pipeline`, Ads `/ads`, Settings `/settings` (adminOnly). `<AppShell user={...}>` renders `<Sidebar>` (`hidden lg:flex`) and `<BottomNav>` (`lg:hidden fixed bottom-0`, safe-area padding) and `<main className="pb-20 lg:pb-0">`. `<ThemeToggle>` toggles `document.documentElement.classList` `dark` and persists `localStorage["theme"]`; an inline script in the root layout applies the stored theme before paint. `<StageBadge stage>` and `<ScoreRing score size?>` (SVG arc, colour by band: `<40` muted, `40–69` warning, `≥70` success).

- [ ] **Step 1: Write the failing UI tests**

```tsx
// tests/ui/bottom-nav.test.tsx
it("renders four tabs for an AGENT and five for an ADMIN", () => { render(<BottomNav role="AGENT" pathname="/today" />); expect(screen.getAllByRole("link")).toHaveLength(4); cleanup(); render(<BottomNav role="ADMIN" pathname="/today" />); expect(screen.getAllByRole("link")).toHaveLength(5); });
it("marks the current route with aria-current=page", () => { render(<BottomNav role="AGENT" pathname="/leads" />); expect(screen.getByRole("link", { name: /leads/i })).toHaveAttribute("aria-current", "page"); });
it("every tab is at least 44px tall (class contract)", () => { render(<BottomNav role="AGENT" pathname="/today" />); for (const l of screen.getAllByRole("link")) expect(l.className).toMatch(/min-h-11/); });

// tests/ui/theme-toggle.test.tsx
it("toggles the dark class and persists to localStorage", async () => { render(<ThemeToggle />); await userEvent.click(screen.getByRole("button", { name: /theme/i })); expect(document.documentElement.classList.contains("dark")).toBe(true); expect(localStorage.getItem("theme")).toBe("dark"); });

// tests/ui/stage-badge.test.tsx
it("renders the human label and stage data attribute", () => { render(<StageBadge stage="SITE_VISIT_SCHEDULED" />); expect(screen.getByText("Site visit scheduled")).toHaveAttribute("data-stage", "SITE_VISIT_SCHEDULED"); });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project ui`
Expected: FAIL.

- [ ] **Step 3: Implement tokens, components and shell**

`BottomNav` and `Sidebar` accept `pathname` and `role` as props (the client wrapper reads `usePathname()`), so they test without the router. Buttons: variants `primary | secondary | ghost | danger`, sizes `sm | md | lg`, all `min-h-11` on touch (`md:min-h-9` for `sm`). Inter via `next/font/google` in root layout with `display: "swap"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --project ui`
Expected: PASS.

- [ ] **Step 5: Verify the shell builds**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add design tokens, UI primitives and responsive app shell"
```

---

### Task 10: Login page

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/login-form.tsx`, `src/app/login/actions.ts`
- Test: `tests/ui/login-form.test.tsx`

**Interfaces:**
- Consumes: `verifyPassword`, `signSession`, `SESSION_COOKIE`, `db`.
- Produces: server action `login(prev: { error?: string }, formData: FormData): Promise<{ error?: string }>` which sets the cookie and `redirect("/today")`. `<LoginForm action={login} />` uses `useActionState`.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows the server error and keeps the email", async () => {
  const action = vi.fn(async () => ({ error: "Invalid credentials" }));
  render(<LoginForm action={action} />);
  await userEvent.type(screen.getByLabelText(/email/i), "a@b.c");
  await userEvent.type(screen.getByLabelText(/password/i), "x");
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  expect(screen.getByLabelText(/email/i)).toHaveValue("a@b.c");
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm vitest run tests/ui/login-form.test.tsx` → FAIL.
- [ ] **Step 3: Implement page, form, action.** Page redirects to `/today` if already signed in. Form: centred card, max-w `sm`, `autoComplete` attributes, submit disabled while pending.
- [ ] **Step 4: Run test to verify it passes** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: add login page"` (after `git add -A`).

---

### Task 11: Today screen

**Files:**
- Create: `src/lib/leads/queries.ts` (`getTodayBoard`)
- Create: `src/app/(app)/today/page.tsx`, `src/app/(app)/today/follow-up-row.tsx`, `src/app/(app)/today/actions.ts`
- Test: `tests/integration/today-query.test.ts`, `tests/ui/follow-up-row.test.tsx`

**Interfaces:**
- Consumes: `db`, `completeFollowUp`, `toWaLink`, `toTelLink`, `requireUser`.
- Produces: `getTodayBoard(user: { id: string; role: Role }, now = new Date()): Promise<{ overdue: FollowUpWithLead[]; dueToday: FollowUpWithLead[]; newLeads: LeadWithOwner[] }>` where day boundaries use `Asia/Kolkata`; `newLeads` = `stage NEW` and (ADMIN: `ownerId null`; AGENT: `ownerId = user.id`), newest first, max 50. Server action `completeFollowUpAction(followUpId: string): Promise<void>` → `revalidatePath("/today")`. `<FollowUpRow item onDone />` renders name, project, due time, `Call` and `WhatsApp` anchors, `Done` button.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/integration/today-query.test.ts  (now = 2026-10-26T06:00:00Z = 11:30 IST)
it("buckets overdue (yesterday), due today (IST), and excludes tomorrow and completed", async () => { /* follow-ups at 2026-10-25T10:00Z, 2026-10-26T12:00Z (17:30 IST), 2026-10-27T01:00Z (06:30 IST tomorrow), and one completed today */ expect(b.overdue).toHaveLength(1); expect(b.dueToday).toHaveLength(1); });
it("AGENT sees only own follow-ups and own NEW leads; ADMIN sees all follow-ups and unassigned NEW leads", async () => { ... });

// tests/ui/follow-up-row.test.tsx
it("renders tel and wa.me links and calls onDone", async () => { render(<FollowUpRow item={item} onDone={onDone} />); expect(screen.getByRole("link", { name: /call/i })).toHaveAttribute("href", "tel:+919845012345"); expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", "https://wa.me/919845012345"); await userEvent.click(screen.getByRole("button", { name: /done/i })); expect(onDone).toHaveBeenCalledWith(item.id); });
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.
- [ ] **Step 3: Implement.** Page is a server component; sections with counts in headings; empty state copy: "Nothing due. Go find a lead." with a `Browse leads` button. Skeleton via `loading.tsx`.
- [ ] **Step 4: Run tests to verify they pass** → PASS.
- [ ] **Step 5: Commit** — `feat: add Today screen with follow-up actions`.

---

### Task 12: Leads list with filters and infinite scroll

**Files:**
- Modify: `src/lib/leads/queries.ts` (add `listLeads`)
- Create: `src/app/api/leads/route.ts`
- Create: `src/app/(app)/leads/page.tsx`, `lead-filters.tsx`, `lead-list.tsx`, `lead-card.tsx`, `lead-table.tsx`, `use-infinite-leads.ts`
- Test: `tests/integration/list-leads.test.ts`, `tests/ui/lead-filters.test.tsx`, `tests/ui/lead-card.test.tsx`

**Interfaces:**
- Produces: `LeadFilters = { q?: string; source?: LeadSource; stage?: LeadStage; ownerId?: string | "unassigned"; projectId?: string; sort?: "score" | "created" }`, `leadFiltersSchema` (Zod, parses `URLSearchParams`), `listLeads(filters: LeadFilters, cursor?: string, limit = 30): Promise<{ items: LeadListItem[]; nextCursor: string | null }>` (cursor = last item id; `q` matches `name ILIKE` or `phone` contains digits). `GET /api/leads?…&cursor=` returns the same shape; requires session. `useInfiniteLeads(filters)` → `{ items, loadMore, hasMore, isLoading }` using `IntersectionObserver` sentinel.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/integration/list-leads.test.ts
it("filters by stage and source", ...); it("q matches name case-insensitively and phone digits", async () => { /* leads Rohan +919845012345, Priya */ expect((await listLeads({ q: "roh" })).items.map(i => i.name)).toEqual(["Rohan"]); expect((await listLeads({ q: "98450" })).items).toHaveLength(1); });
it("pages by cursor without overlap", async () => { /* 35 leads */ const p1 = await listLeads({}, undefined, 30); const p2 = await listLeads({}, p1.nextCursor!, 30); expect(p1.items).toHaveLength(30); expect(p2.items).toHaveLength(5); expect(p2.nextCursor).toBeNull(); expect(new Set([...p1.items, ...p2.items].map(i => i.id)).size).toBe(35); });
it("ownerId=unassigned returns only null owners", ...);

// tests/ui/lead-filters.test.tsx
it("calls onChange with the chosen stage", async () => { ... expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ stage: "QUALIFIED" })); });
// tests/ui/lead-card.test.tsx
it("shows name, stage badge, short budget and score", () => { render(<LeadCard lead={{ ..., budgetPaise: 450000000, score: 72, stage: "QUALIFIED" }} />); expect(screen.getByText("₹45L")).toBeInTheDocument(); expect(screen.getByText("72")).toBeInTheDocument(); expect(screen.getByText("Qualified")).toBeInTheDocument(); });
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.
- [ ] **Step 3: Implement.** Filters live in the URL (`useSearchParams` + `router.replace`); first page server-rendered from `searchParams`, further pages via the hook. `<LeadTable>` `hidden lg:table`, `<LeadCard>` list `lg:hidden`. Filters render as horizontally scrollable chips `< md`, a toolbar `≥ md`.
- [ ] **Step 4: Run tests to verify they pass** → PASS.
- [ ] **Step 5: Commit** — `feat: add leads list with filters and infinite scroll`.

---

### Task 13: Lead detail

**Files:**
- Modify: `src/lib/leads/queries.ts` (add `getLeadDetail`)
- Create: `src/app/(app)/leads/[id]/page.tsx`, `lead-header.tsx`, `quick-actions.tsx`, `stage-dialog.tsx`, `assign-dialog.tsx`, `follow-up-dialog.tsx`, `note-form.tsx`, `timeline.tsx`, `edit-fields-sheet.tsx`, `actions.ts`
- Test: `tests/ui/stage-dialog.test.tsx`, `tests/ui/timeline.test.tsx`, `tests/integration/lead-actions.test.ts`

**Interfaces:**
- Consumes: Task 5 service functions, `STAGE_ORDER`, `canTransition`, `requireUser`.
- Produces: `getLeadDetail(id): Promise<LeadDetail | null>` (lead + project + owner + events with actor + open follow-ups). Server actions in `actions.ts`: `changeStageAction(leadId, to, lostReason?)`, `assignLeadAction(leadId, ownerId | null)`, `addNoteAction(leadId, text)`, `scheduleFollowUpAction(leadId, { dueAt: string; channel; note? })`, `logContactAction(leadId, channel, note?)`, `updateFieldsAction(leadId, patch)`; each returns `{ ok: true } | { ok: false; error: string }` and revalidates `/leads/[id]`, `/leads`, `/pipeline`, `/today`. `<StageDialog current onSubmit>` lists only stages where `canTransition(current, s)`; selecting `LOST` reveals a required `lostReason` input.

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/ui/stage-dialog.test.tsx
it("offers only legal transitions from QUALIFIED", async () => { render(<StageDialog current="QUALIFIED" open onSubmit={vi.fn()} />); const names = screen.getAllByRole("option").map(o => o.textContent); expect(names).toContain("Contacted"); expect(names).not.toContain("New"); expect(names).toContain("Lost"); });
it("requires a reason for LOST and submits it", async () => { const onSubmit = vi.fn(); render(<StageDialog current="NEW" open onSubmit={onSubmit} />); await userEvent.selectOptions(screen.getByRole("listbox"), "LOST"); await userEvent.click(screen.getByRole("button", { name: /move/i })); expect(onSubmit).not.toHaveBeenCalled(); await userEvent.type(screen.getByLabelText(/reason/i), "Budget"); await userEvent.click(screen.getByRole("button", { name: /move/i })); expect(onSubmit).toHaveBeenCalledWith("LOST", "Budget"); });

// tests/ui/timeline.test.tsx
it("renders one sentence per event type, newest first", () => { render(<Timeline events={[created(t0), stageChanged(t1, "NEW", "QUALIFIED"), note(t2, "Likes 3BHK")]} />); const items = screen.getAllByRole("listitem"); expect(items[0]).toHaveTextContent("Likes 3BHK"); expect(items[1]).toHaveTextContent("New → Qualified"); expect(items[2]).toHaveTextContent(/created/i); });

// tests/integration/lead-actions.test.ts  (mock requireUser → agent)
it("changeStageAction returns a readable error on illegal transition", async () => { const r = await changeStageAction(leadId, "LOST"); expect(r).toEqual({ ok: false, error: expect.stringMatching(/reason/i) }); });
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.
- [ ] **Step 3: Implement.** Header sticky on mobile with score ring and stage badge; quick actions as a 2×3 grid `< md`, a row `≥ md`. `StageDialog` uses a native `<select>` styled with tokens (keyboard and mobile friendly). Dialogs become bottom sheets `< md` via `<Sheet>`.
- [ ] **Step 4: Run tests to verify they pass** → PASS.
- [ ] **Step 5: Commit** — `feat: add lead detail with stage, assign, follow-up and timeline`.

---

### Task 14: Pipeline board

**Files:**
- Modify: `src/lib/leads/queries.ts` (add `getPipeline`)
- Create: `src/app/(app)/pipeline/page.tsx`, `pipeline-board.tsx`, `pipeline-column.tsx`, `pipeline-card.tsx`, `move-sheet.tsx`
- Test: `tests/integration/pipeline-query.test.ts`, `tests/ui/pipeline-board.test.tsx`

**Interfaces:**
- Consumes: `changeStageAction`, `STAGE_ORDER`, `STAGE_COLORS`, `formatPaiseShort`.
- Produces: `getPipeline(filters?: { projectId?: string; ownerId?: string; includeLost?: boolean }): Promise<{ stage: LeadStage; count: number; totalBudgetPaise: number; leads: PipelineCardItem[] }[]>` in `STAGE_ORDER` order, `LOST` only when `includeLost`. `<PipelineBoard columns onMove(leadId, to)>`: `≥ lg` DnD via `@dnd-kit/core` `DndContext` with one `useDroppable` per column; `< lg` a horizontal snap-scroll row (`snap-x snap-mandatory`) with a stage selector pill bar, each card having a `Move` button opening `<MoveSheet>` which lists legal stages.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/integration/pipeline-query.test.ts
it("groups leads by stage with totals and omits LOST by default", async () => { ... expect(cols.map(c => c.stage)).toEqual(STAGE_ORDER.filter(s => s !== "LOST")); expect(cols.find(c => c.stage === "NEW")?.totalBudgetPaise).toBe(900000000); });
it("includes LOST when asked", ...);

// tests/ui/pipeline-board.test.tsx
it("renders a column per stage with count headers", () => { render(<PipelineBoard columns={cols} onMove={vi.fn()} />); expect(screen.getByRole("heading", { name: /new/i })).toHaveTextContent("2"); });
it("Move sheet offers legal stages and calls onMove", async () => { const onMove = vi.fn(); render(<PipelineBoard columns={cols} onMove={onMove} />); await userEvent.click(screen.getAllByRole("button", { name: /move/i })[0]); await userEvent.click(screen.getByRole("button", { name: "Qualified" })); expect(onMove).toHaveBeenCalledWith(cols[0].leads[0].id, "QUALIFIED"); });
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.
- [ ] **Step 3: Implement.** Optimistic move with `useOptimistic`; on server error, revert and show a toast-style inline alert. Drop onto an illegal column is refused client-side using `canTransition` and the column dims during drag.
- [ ] **Step 4: Run tests to verify they pass** → PASS.
- [ ] **Step 5: Commit** — `feat: add pipeline board with desktop drag-and-drop and mobile move sheet`.

---

### Task 15: Ads screen (Meta MCP)

**Files:**
- Create: `src/lib/meta/overview.ts`
- Create: `src/app/(app)/ads/page.tsx`, `ads-summary.tsx`, `campaign-table.tsx`, `lead-forms-table.tsx`, `actions.ts`, `error-panel.tsx`
- Test: `tests/unit/ads-overview.test.ts`, `tests/ui/error-panel.test.tsx`

**Interfaces:**
- Consumes: `getMetaGateway`, `db.metaConnection`, `MetaToolUnavailableError`, `MetaNotConfiguredError`.
- Produces: `getAdsOverview(gateway: MetaAdsGateway, conn: { adAccountId: string; pageId: string }, now = new Date()): Promise<AdsOverview>` with `{ last7: Insights; last30: Insights; campaigns: Campaign[]; leadForms: LeadForm[] }`, wrapped by `getCachedAdsOverview` using `unstable_cache(..., ["ads-overview", adAccountId], { revalidate: 300 })`. `syncLeadFormsAction(): Promise<{ ok: boolean; count: number }>` stores form ids on `MetaConnection.leadFormIds`. `<ErrorPanel error>` renders: not configured → "Connect Meta in Settings → Integrations" with a link; tool unavailable → the error message plus the available tool list as chips; other → generic message with the error text in a `<details>`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/ads-overview.test.ts
it("computes 7 and 30 day ranges ending today in IST and calls the gateway with them", async () => { const gw = fakeGateway(); await getAdsOverview(gw, conn, new Date("2026-10-26T06:00:00Z")); expect(gw.getInsights).toHaveBeenCalledWith("act_1", { since: "2026-10-20", until: "2026-10-26" }); expect(gw.getInsights).toHaveBeenCalledWith("act_1", { since: "2026-09-27", until: "2026-10-26" }); });
it("propagates MetaToolUnavailableError unchanged", async () => { ... });

// tests/ui/error-panel.test.tsx
it("shows the unavailable-tool message and available tools", () => { render(<ErrorPanel error={new MetaToolUnavailableError("listLeadForms", ["ads_get_insights"])} />); expect(screen.getByText(/listLeadForms/)).toBeInTheDocument(); expect(screen.getByText("ads_get_insights")).toBeInTheDocument(); });
it("links to settings when not configured", () => { render(<ErrorPanel error={new MetaNotConfiguredError()} />); expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings?tab=integrations"); });
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.
- [ ] **Step 3: Implement.** Page is a server component: `try { overview } catch (e) { <ErrorPanel error={e} /> }`. Summary as four stat tiles (Spend, Leads, Cost/lead, Clicks) in a 2×2 grid `< md`, 4-up `≥ md`. Tables collapse to stacked cards `< md`.
- [ ] **Step 4: Run tests to verify they pass** → PASS.
- [ ] **Step 5: Commit** — `feat: add Ads screen reading Meta data over MCP`.

---

### Task 16: Settings — Projects and Team

**Files:**
- Create: `src/lib/projects.ts`, `src/lib/team.ts`
- Create: `src/app/(app)/settings/page.tsx`, `settings-tabs.tsx`, `projects/project-form.tsx`, `projects/project-list.tsx`, `team/invite-form.tsx`, `team/team-list.tsx`, `actions.ts`
- Test: `tests/integration/projects.test.ts`, `tests/integration/team.test.ts`, `tests/ui/project-form.test.tsx`

**Interfaces:**
- Produces: `projectInputSchema` (`name` 1..80, `slug` `^[a-z0-9-]+$`, `city`, `priceMin`/`priceMax` as rupee strings → paise, `priceMin ≤ priceMax`), `createProject(input)`, `updateProject(id, input)`, `setProjectActive(id, active)`. `inviteUser(input: { email; name; role; phone? }): Promise<{ user; temporaryPassword: string }>` (12-char random, hashed), `setUserActive(id, active)`, `resetPassword(id): Promise<string>`. Settings page reads `?tab=` (`projects | team | integrations | import`), ADMIN only.

- [ ] **Step 1: Write the failing tests**

```ts
it("rejects priceMin > priceMax", () => expect(projectInputSchema.safeParse({ name: "A", slug: "a", city: "B", priceMin: "1Cr", priceMax: "80L" }).success).toBe(false));
it("creates a project converting rupee strings to paise", async () => { const p = await createProject({ name: "K", slug: "k", city: "Bengaluru", priceMin: "80L", priceMax: "1.6Cr" }); expect(p.priceMinPaise).toBe(800000000); expect(p.priceMaxPaise).toBe(1600000000); });
it("inviteUser lower-cases email, hashes the temp password and returns it once", async () => { const r = await inviteUser({ email: "A@SC.Studio", name: "A", role: "AGENT" }); expect(r.user.email).toBe("a@sc.studio"); expect(await verifyPassword(r.temporaryPassword, r.user.passwordHash)).toBe(true); });
it("inviteUser rejects duplicate email with DuplicateEmailError", ...);
// ui: project-form shows a field error under price when min > max
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.
- [ ] **Step 3: Implement.** Tabs via Radix Tabs bound to the URL. Team list shows role badge and an active toggle; invite result shows the temporary password once in a copyable field.
- [ ] **Step 4: Run tests to verify they pass** → PASS.
- [ ] **Step 5: Commit** — `feat: add settings for projects and team`.

---

### Task 17: Settings — Integrations and Import

**Files:**
- Create: `src/lib/meta/connection.ts`
- Create: `src/app/(app)/settings/integrations/meta-form.tsx`, `integrations/ingest-keys.tsx`, `import/csv-import.tsx`
- Modify: `src/app/(app)/settings/actions.ts`
- Test: `tests/integration/meta-connection.test.ts`, `tests/ui/ingest-keys.test.tsx`

**Interfaces:**
- Consumes: `encrypt`/`decrypt`, `createIngestKey`/`revokeIngestKey`, `getEnv`.
- Produces: `saveMetaConnection(input: { pageId; adAccountId; accessToken?: string; mcpUrl?: string }): Promise<void>` (upsert id 1; keep the existing token when `accessToken` is blank; encrypt otherwise), `getMetaConnection(): Promise<{ pageId; adAccountId; hasToken: boolean; mcpUrl; leadFormIds; webhookUrl; verifyToken } | null>` (never returns the token). Actions: `saveMetaConnectionAction`, `createIngestKeyAction(name, source)` → `{ plaintext }`, `revokeIngestKeyAction(id)`, `importCsvAction(formData)` → result from Task 6's CSV route logic (call `parseLeadsCsv` + `ingestLead` directly).

- [ ] **Step 1: Write the failing tests**

```ts
it("stores the token encrypted and keeps it when saving with a blank token", async () => { await saveMetaConnection({ pageId: "p", adAccountId: "act_1", accessToken: "EAAB" }); const row = await db.metaConnection.findUniqueOrThrow({ where: { id: 1 } }); expect(row.accessTokenEnc).not.toContain("EAAB"); expect(decrypt(row.accessTokenEnc)).toBe("EAAB"); await saveMetaConnection({ pageId: "p2", adAccountId: "act_1", accessToken: "" }); expect(decrypt((await db.metaConnection.findUniqueOrThrow({ where: { id: 1 } })).accessTokenEnc)).toBe("EAAB"); });
it("getMetaConnection never exposes the token", async () => { ... expect(JSON.stringify(c)).not.toContain("EAAB"); expect(c.hasToken).toBe(true); });
// ui: ingest-keys shows the plaintext once after create and a Copy button
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.
- [ ] **Step 3: Implement.** Integrations tab shows read-only webhook URL (`${origin}/api/webhooks/meta`) and verify token with copy buttons, gateway mode (from env, read only), and a "Test connection" button that calls `getMetaGateway().listCampaigns` and reports success or the error message.
- [ ] **Step 4: Run tests to verify they pass** → PASS.
- [ ] **Step 5: Commit** — `feat: add Meta integration, ingest keys and CSV import settings`.

---

### Task 18: Seed, README, full verification

**Files:**
- Create: `prisma/seed.ts`
- Modify: `README.md`
- Test: `tests/integration/seed.test.ts`

**Interfaces:**
- Produces: `seed(db: PrismaClient): Promise<void>` exported from `prisma/seed.ts` (idempotent: wipes then inserts) creating exactly 1 ADMIN (`admin@sc.studio` / `admin1234`), 3 AGENTs (`agent1..3@sc.studio` / `agent1234`), 3 projects, 200 leads across all sources and stages with deterministic pseudo-random data (seeded PRNG), 60 follow-ups (20 overdue, 20 today, 20 future), 2 ingest keys.

- [ ] **Step 1: Write the failing test**

```ts
it("seeds the documented counts", async () => { await seed(db); expect(await db.user.count()).toBe(4); expect(await db.project.count()).toBe(3); expect(await db.lead.count()).toBe(200); expect(await db.followUp.count()).toBe(60); expect(new Set((await db.lead.findMany()).map(l => l.stage)).size).toBe(8); });
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement seed and README.** README: prerequisites, `.env` setup, `pnpm db:migrate && pnpm db:seed`, `pnpm dev`, test commands, ingest API example `curl`, Meta webhook setup steps (App → Webhooks → Page → `leadgen`), Meta MCP token scopes, `META_MCP_TOOL_MAP` override example.
- [ ] **Step 4: Run test to verify it passes** → PASS.
- [ ] **Step 5: Full verification**

Run: `pnpm lint && pnpm build && pnpm test`
Expected: all exit 0; test wall time < 90 s.

Run: `set -a && . ./.env && set +a && pnpm db:migrate && pnpm db:seed && (pnpm start -p 3100 & sleep 6; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/login; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/today; kill %1)`
Expected: `200` then `307` (redirect to login).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add seed data and README; complete Phase 1"
```
