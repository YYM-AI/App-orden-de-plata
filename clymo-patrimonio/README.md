# Clymo Patrimonio · Milestone 2

Independent, Spanish-first **synthetic financial application** with Supabase Auth, PostgreSQL persistence and household isolation. The four sections remain Resumen, Fuentes, Revisión and Configuración. No real financial information, document intake, bank connections or paid APIs are used.

**Local implementation and verification are complete. Milestone 2 remains incomplete because private hosted staging is not yet provisioned or verified.** See [implementation status](docs/IMPLEMENTATION_STATUS.md) for actual evidence and remaining work.

## Local setup

Requires Node.js >=22.13, npm, a Docker-compatible runtime and the Supabase CLI. The verified workstation uses an isolated Colima profile. All commands run inside `clymo-patrimonio/`, independently of the older root application.

```sh
cd '/Users/yosefmeirovich/Documents/ChatGPT/App orden de plata/clymo-patrimonio'
npm ci --no-audit --no-fund
npm run db:start
npm run db:configure
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

Open http://127.0.0.1:3100. Use a generated local synthetic test identity from the ignored, owner-readable `.local/test-accounts.json` file. Do not paste its passwords or any environment values into chat, screenshots or Git. Public registration is disabled. [Full setup](docs/LOCAL_SUPABASE_SETUP.md) covers runtime installation, local ports, reset and safe credentials.

PostgreSQL is the source of truth. Authenticated browser refresh and a second browser retrieve the same authorized household. Old prototype localStorage must be explicitly discarded; it is never uploaded. Sign-in uses official Supabase email/password authentication with an application allowlist. Auth cookies are HTTPOnly, SameSite=Lax and Secure on HTTPS.

## Financial behavior

Canonical cutoff: **4 September 2026**. Household A includes **CLP 60,240,000 assets**, **CLP 7,700,000 liabilities**, **CLP 52,540,000 net worth**, and **CLP 25,250,000 synthetic available cash**. Household B has its own USD account and fictional FX rate; Household C starts empty.

Preserves M1 ownership, freshness, inclusion, property/mortgage pairing, duplicate-source resolution and exact-decimal rules. Manual assets/liabilities, observations, repayments, original-currency provenance and “Ver cálculo” remain functional. Owners can authorize/revoke helpers, export JSON/CSV, reset fixtures and delete a household. Helpers have read-only access to household finances. Self-account deletion cannot orphan a household.

## Checks

```sh
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:database
npm run build
npm run test:e2e
npm audit --json
```

Run database and browser suites sequentially; both use the local synthetic fixtures. Playwright starts its own production server on port 3100, so stop a previous app server first. Do not run local reset/test scripts against hosted or real data.

## Architecture and documentation

Next.js 16.3.4, React 19.2.6, TypeScript, decimal.js, Zod, official Supabase SSR/JS clients, PostgreSQL 17, Vitest, Playwright and axe. Domain calculations remain pure; server commands validate authenticated ownership and persist atomically through `SupabaseRepository`.

- [Architecture](docs/ARCHITECTURE.md) and [data model](docs/DATA_MODEL.md)
- [Authentication](docs/AUTHENTICATION.md) and [authorization/RLS](docs/AUTHORIZATION_AND_RLS.md)
- [Export and deletion](docs/EXPORT_AND_DELETION.md)
- [Private staging](docs/PRIVATE_STAGING.md) and [security boundary](docs/SECURITY_BOUNDARY.md)
- [Test strategy](docs/TEST_STRATEGY.md), [implementation status](docs/IMPLEMENTATION_STATUS.md), [next milestone](docs/NEXT_MILESTONE.md)
- [M2 manual browser evidence](docs/MILESTONE_2_MANUAL_VERIFICATION.md) and [HTTP evidence](docs/MILESTONE_2_HTTP_VERIFICATION.json)
- [M1 historical verification](docs/MILESTONE_1_VERIFICATION.md) and [financial truth contract](docs/FINANCIAL_TRUTH_CONTRACT.md)

All application imports stay inside this directory. Clymo Alerts shares only the repository and is not imported, modified, migrated or required to run this application.
