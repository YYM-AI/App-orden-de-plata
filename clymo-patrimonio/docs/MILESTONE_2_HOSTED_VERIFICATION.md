# Hosted Milestone 2 verification — in progress

Checkpoint: 15 September 2026. This document is deliberately not a completion claim. The private application has not been deployed or manually verified at its hosted URL yet.

## Dedicated synthetic database

Supabase project `sfdazqyophgjehwlkhla`, **Clymo Patrimonio M2 Synthetic**, YYM-AI organization, Free/Nano, Oregon (`us-west-2`). No billing or payment information was activated. Postgres 17.6.1.166, hosted PostgREST 14.5. SSL enforcement is enabled; administrative migrations use the official Supabase root CA with certificate verification enabled.

Eight immutable, ordered migrations are applied. The first seven retain their original content. Migration `202609150008_revision_conflict.sql` replaces only the application-level stale-revision error with `PT409` (HTTP 409). PostgREST 14 automatically retries SQLSTATE `40001`; a deliberately stale client revision can never succeed on retry. See [official Supabase troubleshooting](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Ownership checks, household locks, revision comparison, append-only state, idempotency receipts and valuation writes are preserved.

Closed public signup, anonymous sign-in disabled, manual identity linking disabled, email confirmation enabled, secure email/password change enabled, current password required for password changes, password minimum 12, email OTP lifetime 600 seconds. Email is the only enabled provider. Only the exact intended HTTPS origin and `/auth/callback` are allowed; no wildcard redirects. Paid breached-password detection was not activated.

Three synthetic households and seven generated `@staging.clymo.test` identities were seeded. Six identities are approved; the unapproved identity deliberately remains outside the allowlist. Membership distinguishes owners, read-only helpers and an unrelated approved identity. Separate random hosted passwords are ignored local administrative fixtures, never application source or public assets.

## Evidence and unresolved checks

- Migration ledger/source hashes: [MILESTONE_2_HOSTED_MIGRATIONS.json](MILESTONE_2_HOSTED_MIGRATIONS.json).
- Hosted RLS: [MILESTONE_2_HOSTED_RLS.json](MILESTONE_2_HOSTED_RLS.json). First complete batched run: **2,539 passed**, transaction rolled back. The matrix includes 26 household resource types, three households, eight actors, four CRUD actions, profile/catalog/join/read/export checks.
- Subsequent hosted constraint/function/repository run: **289 passed, 1 failed**. The stale-revision case timed out; this led to the eighth migration. A full post-fix run is pending at this checkpoint.
- The first unbatched hosted matrix lost its long-lived connection after 1,541 checks; subsequent assertions cascaded from the disconnected client. The SQL batch verifier tests the same operation/actor combinations, uses real Auth session claims and resets each case through rollback rather than thousands of remote round trips. Failures are not skipped or retried into a pass.
- A local-key JWT cannot imitate the hosted signing key: hosted PostgREST rejects it with 401/PGRST301. This does **not** prove natural expiry of a genuine hosted token. Local expired signed-token coverage remains separate.
- Canonical repository test passed on hosted Supabase: included assets **CLP 60,240,000**, liabilities **CLP 7,700,000**, net worth **CLP 52,540,000**, available cash **CLP 25,250,000**. The fixture is restored after mutation tests.

## Private host and Worker adapter

Existing Sites project `appgprj_6aa4055b56e881918a6cbafdf94245f6` remains owner-only: custom access, one allowed account, no external viewers or group grants. No version was published at this checkpoint. Intended origin: `https://clymo-patrimonio-m2.familiameirovichhaic.chatgpt.site`. An intended URL is not a live preview.

Runtime values have been configured through native secure Sites settings. The database password is not a runtime setting. Secret values and provider credentials are excluded from Git and archives.

The established Next.js build remains available. The parallel Worker build uses Vinext 1.0.0-beta.9, Vite 8, Cloudflare's Vite plugin, patched React 19.2.8, and a minimal static-asset dispatch entry. `worker.ts` serves only `/_next/static/` GET/HEAD requests through the asset binding; all application routes retain server authorization. Missing assets cannot fall through to authenticated page layouts. No D1, R2, paid images, public workers.dev URL or paid API is configured.

`npm run build:staging` removes generated preview variable files and scans all output for configured secrets; client output is additionally checked for fixture payload markers. The last successful build scanned **147 files**. The initial raw adapter build emitted development variables, which were caught before packaging or publication. No such artifact was published.

Manual local Worker check: hydrated login, synthetic owner sign-in, summary totals and empty warning/error console confirmed. This is **local Worker evidence**, not hosted manual verification.

## Security issue found during verification

Before hydration was fixed, the old login form could fall back to GET submission, placing a **local synthetic test password** in the browser URL/tool output. That generated password was rotated immediately. Login now declares POST explicitly and waits for hydration; JavaScript-disabled and bootstrap-asset regression checks were added. No real user, bank, hosted database password or service key was involved in this form incident. Earlier provider OAuth navigation also exposed transient authorization/session values in tool output; no values are reproduced in committed evidence. Future provider inspection must suppress credential-bearing URLs and snapshots.

## Remaining work

Complete clean post-fix local/hosted tests and Worker E2E, commit the source, rebuild and publish that exact tested state privately, verify hosted authentication/persistence/export/deletion/isolation, manually check 320/390/768/1440 layouts and console/network/session behavior, capture hosted screenshots, record deployment commit and update the draft PR. Physical iPhone verification requires the owner to open the private URL after publication. M2 remains incomplete until these hosted requirements pass.
