# Milestone 2 implementation status

**HOSTED DATABASE PROVISIONED; PRIVATE APPLICATION DEPLOYMENT AND VERIFICATION PENDING. Milestone 2 is NOT complete.** Current hosted progress and known failures are recorded in [MILESTONE_2_HOSTED_VERIFICATION.md](MILESTONE_2_HOSTED_VERIFICATION.md). The completed local baseline below was gathered on 8–11 September 2026; its counts are historical, not hosted completion evidence. M1's completed evidence remains in [MILESTONE_1_VERIFICATION.md](MILESTONE_1_VERIFICATION.md).

## Implemented

The independent Next.js 16.3.4 / React 19.2.6 / strict TypeScript application now uses official Supabase Auth and a PostgreSQL 17 repository behind the existing persistence interface. The exact-decimal financial engine remains independent of Supabase. Spanish Resumen, Fuentes, Revisión and Configuración retain M1 functionality.

Implemented closed registration and explicit allowlisting; separate users/households; owner and read-only helper roles; membership authorization/revocation; seven versioned migrations; RLS on all 27 public application tables and the private deletion-receipt table; household-scoped UUID/foreign keys; exact numeric evidence; append-only observations and obligation events; transaction/revision/idempotency protection; valuation and audit history; owner-only JSON/CSV export; confirmed recent-auth household deletion; protected self-account deletion with last-owner safety and recoverable provider failure; explicit discard of old browser prototype data; database-backed reset; no financial localStorage; protected build diagnostics; no-store, CSP, origin validation and security headers.

All M1 source, ownership, freshness, inclusion/exclusion, missing-rate, property/mortgage and duplicate rules remain implemented. Manual assets, liabilities, repayments, original-currency calculations and source explanations work against the database. A household selection survives navigation and refresh. Summary review and conversion explanations use the selected household rather than assuming the canonical fixture.

## Synthetic fixtures

| Household              | Assets CLP | Liabilities CLP | Net worth CLP | Available cash CLP |
| ---------------------- | ---------: | --------------: | ------------: | -----------------: |
| A — Familia Demo Clymo | 60,240,000 |       7,700,000 |    52,540,000 |         25,250,000 |
| B — Familia Norte Demo |  2,000,000 |         100,000 |     1,900,000 |          2,000,000 |
| C — Hogar Vacío Demo   |          0 |               0 |             0 |                  0 |

Seven local Auth identities use only generated `.test` addresses and ignored random credentials. A's USD 9,200 brokerage uses its synthetic CLP 950 rate; B has its own USD account and CLP 1,000 rate. A's Santander account contributes 50%. No real financial information was used. Separate ignored hosted credentials were generated during the subsequent staging phase.

## Historical local baseline commands and results (8–11 September)

| Command                                                          | Result                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`                                    | PASS; 105 packages installed. npm warned about unapproved optional esbuild/fsevents install scripts; installed platform binaries worked. |
| `npm run format`                                                 | PASS.                                                                                                                                    |
| `npm run format:check`                                           | PASS.                                                                                                                                    |
| `npm run lint`                                                   | PASS, including independent application import-boundary check.                                                                           |
| `npm run typecheck`                                              | PASS, generated route types and TypeScript.                                                                                              |
| `npm run test:unit`                                              | **96 passed, 0 failed** (83 retained M1 + 13 new).                                                                                       |
| `npm run test:integration`                                       | **28 passed, 0 failed**, retained M1 integration cases.                                                                                  |
| `npm run test:database`                                          | **2,829 passed, 0 failed**, four files, actual local PostgreSQL/Supabase.                                                                |
| `npm run build`                                                  | PASS; optimized production build. Financial routes/APIs are dynamic, not publicly prerendered fixture pages.                             |
| `npm run test:e2e`                                               | **44 passed, 0 failed, 0 skipped, 0 retries**, one Chromium worker, 6.1 minutes on the final full run.                                   |
| `npm audit --json`                                               | PASS; 0 reported vulnerabilities in the captured audit.                                                                                  |
| `npm run db:start` / `npm run db:configure` / `npm run db:check` | PASS; isolated local Auth, database, migrations and generated identities available.                                                      |
| `npm run db:reset` / `npm run db:migrate`                        | PASS; clean rebuild from all seven migrations and safe no-op reapplication.                                                              |
| `npm run db:seed` / `npm run db:verify-seed`                     | PASS; repeated seed preserved all rows across the 27 public application tables.                                                          |
| `node scripts/check-private-build.mjs`                           | PASS; 17 public build assets scanned, no configured service/database credentials or canonical fixture payload markers.                   |

**Combined automated test total: 2,997 passed.** The database breakdown is 2,539 CRUD/catalog/profile/join cases, 37 constraint cases, 240 function/actor cases and 13 real Auth/PostgREST repository cases. The core matrix alone is 26 household resource types × 3 households × 8 actors × 4 CRUD operations = 2,496 cases. RLS is not mocked. Fixture reset, migration reconstruction, membership changes, expired sessions, revoked tokens, lifecycle deletion and precision/relational constraints are exercised separately.

Independent request probes also passed **53/53**, recorded in [MILESTONE_2_HTTP_VERIFICATION.json](MILESTONE_2_HTTP_VERIFICATION.json). They are additional HTTP/PostgREST assertions, not included in the 2,997 test total. The manually deleted household had zero remaining rows across all 26 related tables; see [deletion evidence](MILESTONE_2_DELETION_VERIFICATION.json).

### Failures found during development

Earlier runs were not all green. Initial browser verification had 37/43 passes and found two UI regressions (async checkbox feedback and ownership validation text), plus assertions that needed correction. A later 43/43 run passed. Expanded 44-case runs then exposed household-navigation timeouts, one transient session redirect and test assumptions about HTTP 201 and response-body availability after document navigation. The route links now preserve household selection, loading state waits for actual data, and tests observe the resulting URL/API rather than an unavailable old response body. One database-unavailable run after workstation restart was interrupted; the new preflight detects a stopped VM before tests. Duplicate generated/installed type files were repaired from the lockfile and regenerated caches. A targeted corrected switching test passed before the final full **44/44** run. No retries or skipped cases conceal these failures. The expired-session negative test emits expected Supabase SDK validation errors without token values; those are not unexpected browser-console errors.

## Manual local verification

[Detailed manual evidence and screenshots](MILESTONE_2_MANUAL_VERIFICATION.md) record actual browser interaction: four sections and exact totals; provenance and calculation dialogs; manual asset/liability creation; reload and independent-session persistence; partial repayment and preserved observations; duplicate link/undo; USD/CLP switching; downloaded JSON and UTF-8 CSV; helper read-only access; direct request/database denial; helper revocation/restoration; B isolation and manipulated URL denial; disposable household deletion; reset; desktop/mobile layouts; sign-out/session handling; console checks.

Observed widths: 320, 390, 768 and 1440 pixels without horizontal document overflow. Owner and helper mobile flows were opened in Chromium. Automated checks additionally cover keyboard/focus, WCAG AA, 200% text and reduced motion. **No physical iPhone Safari verification occurred.** The final local fixture was restored to canonical values.

## Git and application boundary

Repository: `YYM-AI/App-orden-de-plata`. Branch: `codex/clymo-patrimonio-milestone-2`, descended from verified M1 commit `f99f3a6441f36e4f587b68a166dd344829529576`. This delivery is committed/pushed on that branch and reviewed through a stacked draft PR targeting M1; neither branch is merged into main. The delivered commit is available from Git HEAD and the protected diagnostics after rebuilding that revision.

Every M2 source/documentation change is confined to `clymo-patrimonio/`. All **76 original repository files** were compared byte-for-byte with original commit `3ae93f3e1b0839b6e42d131fd2e5b7aaa298c43b`: **zero changed or missing**. Clymo Alerts is not modified, migrated, renamed, imported or required. Source candidate scans found no configured keys, database connection secret or generated passwords. Credentials, local tooling, build output and raw test logs remain ignored. Source-control publication is not a public financial application deployment.

## Incomplete: private hosted staging

The dedicated Free Supabase project now exists, contains three synthetic demonstration households and has eight migrations applied with verified TLS. Registration is closed and the explicit allowlist is configured. Hosted RLS passed 2,539 assertions; a subsequent 289/290 repository/constraint/function run exposed a stale-revision retry issue, repaired in migration 008 with the full rerun pending. See [current hosted evidence](MILESTONE_2_HOSTED_VERIFICATION.md).

The owner-only Sites project is registered and runtime secrets are configured, but the application has not been deployed or manually verified there. No public release or paid resource has been activated. Remaining work is the exact-build private deployment, hosted browser and permission checks, screenshots, final evidence and branch delivery. Local screenshots do not count as deployed verification. See [PRIVATE_STAGING.md](PRIVATE_STAGING.md).

## Deferred and blocked before real data

Real statements/document intake, OCR, real PDF extraction, bank/broker integrations or passwords, live exchange rates/prices, advice, alerts, offline financial caching and public release remain deferred. M1's optional WebMCP integration is not active in the authenticated production application.

Before real financial data: finish private staging; independent security/privacy review; provider/region and processing-term decisions; backup/restore and retention validation; encryption/key rotation and incident/recovery procedures; distributed operational controls; owner transfer/recovery UX; financial-policy and target-user validation. Passing synthetic local tests is not production approval.

Recommended M3, after completing hosted M2: a controlled synthetic pilot focused on usability for older/non-technical people, backup/restore, recovery, deletion/retention and operational security. Do not introduce real document intake first.
