# Clymo Patrimonio · Milestone 1

Independent Spanish-first **synthetic financial prototype**. It calculates a dated household inventory from observations, ownership decisions, approved fictional prices and exchange rates. It has no bank connections, document intake, accounts for real users, or production financial storage.

> Este prototipo utiliza únicamente datos ficticios. No ingreses ni subas información financiera real.

## Run locally

Requires Node.js **22.13 or newer** and npm. This milestone was verified with Node 26.7.0 and npm 11.19.0.

```sh
cd '/Users/yosefmeirovich/Documents/ChatGPT/App orden de plata/clymo-patrimonio'
npm ci
npm run dev
```

Open <http://127.0.0.1:3100>. The server binds only to loopback. No environment credentials are needed; `.env.example` documents the telemetry setting. Run commands **inside this directory**, not in the older root prototype.

For the production build:

```sh
npm run build
npm run start
```

Stop an existing server on port 3100 before switching between development, production and end-to-end tests. Data survives refresh for the same browser origin; another browser or `localhost` instead of `127.0.0.1` has separate storage.

## Verify

```sh
npm ci
npx playwright install chromium
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
```

`npm run format` formats source and documentation. `npm run verify` performs formatting checks, lint, types, unit/integration tests, build and E2E in order. Playwright starts and stops its own production server. No paid CI or hosting workflow is configured.

## What works

- **Resumen:** calculated net worth, assets, liabilities, liquid cash, coverage, exclusions, oldest included observation and explanations.
- **Fuentes:** filter accounts/assets/liabilities/obligations by type and eligibility, inspect original currencies, dates, ownership, valuation inputs and history; add manual assets and liabilities, including receivables/payables.
- **Revisión:** bind a duplicate statement to the existing broker, reverse that binding, acknowledge or reopen exclusions; update stale sources through new observations.
- **Configuración:** CLP/USD, household/helper reference, safe obligation visibility toggle, freshness explanation and reset.
- Partial repayments, settlements, adjustments, forgiveness, write-offs and disputes are append-only events. Optional cash links update the cash observation and obligation in one persisted state change.

Canonical cutoff **4 September 2026**: assets **CLP 60,240,000**, liabilities **CLP 7,700,000**, net worth **CLP 52,540,000**, assumed liquid cash **CLP 25,250,000**. Nine included economic sources, four excluded; the extra broker statement is a source binding, not a fourteenth account.

## Implementation

Next.js 16.3.4 App Router, React 19.2.6, strict TypeScript, decimal.js 10.6.0, Zod runtime validation, native accessible HTML controls and custom CSS, Lucide icons, Vitest, Playwright and axe. System fonts; no remote media, analytics or market APIs. `domain/` is pure and independent of React/storage. `persistence/` supplies a replaceable repository interface with local and memory implementations.

All 76 files from the original root workspace remain intact. This directory can be installed, built and run by itself. The temporary milestone Git branch is a delivery branch; the application directory and independent dependencies provide the permanent product boundary.

See [implementation status](docs/IMPLEMENTATION_STATUS.md), [architecture](docs/ARCHITECTURE.md), [financial contract](docs/FINANCIAL_TRUTH_CONTRACT.md), [tests](docs/TEST_STRATEGY.md), and [deployment](docs/DEPLOYMENT.md).
