# Sales OS

Real-estate sales CRM built with Next.js 16, Prisma 7 and PostgreSQL 16.

## Setup

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env` and fill in `SESSION_SECRET` and `ENCRYPTION_KEY` (generate each with `openssl rand -hex 32`).

## Commands

- `pnpm dev`: start the dev server
- `pnpm build`: production build
- `pnpm lint`: run ESLint
- `pnpm test`: run all Vitest projects (`unit` and `ui`)
- `pnpm test:watch`: run Vitest in watch mode
