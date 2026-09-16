# Milestone 1 implementation status

**Implemented and verified on 6 September 2026.** Clymo Patrimonio is an independent, functional **synthetic local prototype** in `clymo-patrimonio/`. This status does not authorize real financial data or production use.

## Implemented

- Four Spanish routes: Resumen, Fuentes, Revisión and Configuración; responsive desktop sidebar and mobile navigation; loading, empty, error, stale, excluded and partial-coverage states.
- Exact-decimal financial engine with runtime validation. Logical accounts, source bindings, immutable observations, ownership/inclusion decisions, prices, FX/UF and valuation components remain separate.
- Complete Familia Demo Clymo: **CLP 60,240,000 assets − CLP 7,700,000 liabilities = CLP 52,540,000 net worth**. Assumed liquid cash: **CLP 25,250,000**. Nine of thirteen economic sources included; fourteen source bindings.
- USD brokerage cash and holdings, synthetic conversion at CLP 950/USD, Santander 50% ownership, missing EUR-rate exclusion, expired CLP source, excluded property/mortgage pair, and reversible duplicate-source binding without double counting.
- Manual assets and liabilities, receivables and payables; append-only balance updates and preserved position observations; ownership confirmation; recorded inclusion decisions; personal obligation payments, settlements, adjustments, forgiveness, write-offs and disputes. Linked payments update cash and obligation together in one saved prototype state.
- Original values, dates, source histories and calculation explanations; interactive reviews; CLP/USD switching; safe obligation visibility setting; local refresh persistence and confirmed reset. Persistence sits behind `PrototypeRepository` with local and memory adapters.
- Permanent synthetic-data warning, no credentials/uploads/live providers, no financial analytics, validated forms, keyboard dialog focus/Escape, explicit accessible labels, reduced-motion and text-enlargement support.
- Independent package, lockfile, TypeScript, lint/format and test configurations, routes, build commands, environment example and documentation. Optional read-only WebMCP snapshot tool works in a supporting browser.

## Tested

Environment: macOS, Node **26.7.0**, npm **11.19.0**. Commands run inside the independent application directory. The clean-install sequence passed; after the final review-copy correction, formatting, lint, types, production build and all E2E tests were rerun successfully. Domain code was unchanged by that correction.

| Command                           | Final result                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`     | PASS; dependency installation completed                        |
| `npx playwright install chromium` | PASS; local Chromium installed                                 |
| `npm run format`                  | PASS                                                           |
| `npm run format:check`            | PASS                                                           |
| `npm run lint`                    | PASS; includes independent import-boundary check               |
| `npm run typecheck`               | PASS; no TypeScript errors                                     |
| `npm run test:unit`               | **83 passed, 0 failed**, 3 files                               |
| `npm run test:integration`        | **28 passed, 0 failed**, 2 files                               |
| `npm run build`                   | PASS; optimized Next build and four static application routes  |
| `npm run test:e2e`                | **23 passed, 0 failed**, Chromium, production server           |
| `npm audit --omit=dev --json`     | **0 reported production vulnerabilities** at verification time |

Total automated tests: **134 passed, 0 failed**. E2E includes axe WCAG A/AA checks on four routes and an entry dialog, keyboard focus/Escape/return focus, 320/390/768/1440 px layouts, 200% text enlargement, reduced motion, console/page errors, and absence of external financial requests. These are bounded checks, not a full accessibility certification.

A local scan of the new source/configuration/docs/lockfile found zero common private-key, GitHub-token, AWS-access-key or live-secret patterns. It is not a comprehensive secret scanner or independent security assessment.

Initial E2E runs exposed label-name and dialog focus defects (17/23 and then 22/23 passed). Those defects were fixed; the final two complete E2E runs each passed 23/23. Manual review also caught outdated text after duplicate resolution; the final build displays the current state and distinguishes effective decision date from recorded timestamp. Only final results above constitute milestone verification.

## Manually verified

Opened the production application in the real Codex browser and operated its visible controls separately from the automated suite. Verified all four sections, the three canonical totals and liquid cash, all four calculation dialogs, broker provenance and Santander ownership, creation of both an asset and a liability, refresh persistence, linked partial repayment, duplicate resolution/reversal, CLP/USD switching and persistence, confirmed reset, mobile/tablet/desktop layouts and console. **No browser console errors or warnings were reported** during the checked flows.

Detailed inputs and observed outcomes are in [MANUAL_VERIFICATION.md](MANUAL_VERIFICATION.md). Screenshots are in [screenshots/](screenshots/). The final visible demo was reset to the canonical fixture. The temporary viewport override was removed.

## Deployment and repository boundary

Local-only preview: `http://127.0.0.1:3100`. No existing usable free private staging configuration was available; no public deployment or paid service was provisioned. GitHub stores source code and synthetic screenshots, not a deployed financial application. See [DEPLOYMENT.md](DEPLOYMENT.md) and [README.md](../README.md) for exact commands.

Repository: `YYM-AI/App-orden-de-plata`. Delivery branch: `codex/clymo-patrimonio-milestone-1`. Baseline: `3ae93f3e1b0839b6e42d131fd2e5b7aaa298c43b`. All **76 baseline files remain unchanged**. Changes are confined to the independent directory and a new root documentation pointer. Clymo Alerts was neither modified nor imported, migrated or coupled. Its prior runtime was not recertified; its code/configuration and dependency files were preserved. The branch is not merged into `main`; Git history identifies the delivery commit.

## Deferred

PWA/offline installation; real authentication/helper invitations; durable service/PostgreSQL storage; private cloud staging; target-user validation and seven-household real-data pilot; transaction activity; document/CSV intake and five-template certification; OCR/AI extraction; real bank/broker/price/FX providers; corporate actions; real property valuation; financial exports; alerts; advice, tax, trading or payment services. See [NEXT_MILESTONE.md](NEXT_MILESTONE.md).

## Blocked before real data

Authentication; server-side authorization/RLS and tenant isolation; encryption and key management; retention/deletion/export policies; tested backups and restoration; incident/support/rollback controls; privacy and Chilean legal review; approved vendors, processing regions and licensing; independent security assessment; target-user and financial-policy approval. Browser localStorage is not secure production financial storage, and revision checks are not multi-user transactions.

## Not started

Real financial accounts/documents; actual bank or broker connections; production provisioning; public release; financial transactions; Clymo Alerts integration. No API or hosting charges were incurred by this milestone.
