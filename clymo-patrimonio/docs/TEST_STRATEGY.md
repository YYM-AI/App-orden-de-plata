# Test strategy

All tests use synthetic data. Database tests require a real local Supabase/PostgreSQL stack; they refuse non-loopback URLs. Run database and E2E suites sequentially to avoid fixture interference.

- `npm run test:unit`: pure financial rules, validation, canonical/North/empty fixtures, exact decimal arithmetic, CSV formula escaping and format metadata.
- `npm run test:integration`: preserved M1 command and repository-interface regression cases. Legacy local/memory repositories are test-only.
- `npm run test:database`: real SQL/RLS resource matrix, PostgreSQL catalog/grants/search paths, constraints, exact numeric storage, transactional deletion, session/membership revocation, every public operation across actor types, actual Auth closed registration, and PostgREST repository persistence/export tests.
- `npm run test:e2e`: production Chromium tests; preserved 23 M1 scenarios plus authenticated owner/helper flows, unauthorized URLs, cookie restoration, legacy discard, direct write/export denial, cross-browser persistence, revocation, household switch/deletion, real Auth-account deletion, form/dialog accessibility and 320/390/768/1440 layouts. Traces are disabled so authentication bodies are not captured.

The CRUD matrix covers 26 household resource types × 3 households × 8 actors × 4 verbs. It creates sentinel rows in every target table inside a transaction, including normally empty Household C. Each case uses the real database role and actual locally issued claims; there are no mocked RLS decisions. Unrelated writes must fail by privilege/RLS or affect zero rows. Owner evidence inserts pass or reach an expected domain uniqueness constraint; guarded application commands prove positive mutation paths. All matrix writes are rolled back.

The real PostgREST tests separately demonstrate API JWT verification, persisted owner writes, helper denial and live revocation with an already issued token. SQL lifecycle tests validate deletion cascades, orphan protection and historical evidence after an owner's departure. E2E uses the official Auth flow through the Next API and actual database state.

A fresh local database reset, migration application, no-op reapplication and repeated seed must be verified and recorded. A successful build/test suite does not replace manual browser checks. Manual local and private hosted evidence belong in separate sections of implementation status. Failed intermediate runs remain documented; final counts may only be claimed after running the complete applicable suite.

For production verification: `npm ci --no-audit --no-fund`, format, format:check, lint (including import boundary), typecheck, unit/integration/database tests, production build, E2E, `npm audit --json`. Check the client bundle for actual configured service-key values without printing them; check unauthenticated HTML and API results for fixture values. Record exact commands/counts/build SHA. No independent penetration test or full accessibility certification is implied.

The local production browser suite uses one worker, zero retries, a 60-second test budget and 15-second state assertions to accommodate real Auth/database calls on the constrained VM. It uses condition-based waits, not sleeps. Household creation/navigation/deletion checks retain the selected household across routes and refresh; disposable test data are cleaned up in `finally`. `db:check` validates local Auth, PostgreSQL, migration availability and the synthetic identity file before the browser server starts.
