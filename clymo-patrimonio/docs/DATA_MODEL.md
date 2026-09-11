# Database model

Versioned migrations are the source of schema truth. `supabase/migrations/` contains:

1. `202609070001_foundation.sql`: UUID keys, profiles/allowlist, households/memberships, normalized financial evidence, numeric columns, scoped foreign keys, indexes, RLS and initial grants.
2. `202609070002_operations.sql`: append-only guards, relational/economic checks, narrow owner operations, consistent reads, valuation history, safe membership administration and invoker view.
3. `202609070003_account_lifecycle.sql`: recoverable account-deletion request and provider-completion receipt, consistent read snapshot.
4. `202609070004_export.sql`: owner-only complete household export, with numeric history serialized as strings.
5. `202609070005_actor_integrity.sql`: decision/event authors must match the authenticated UUID at append time.
6. `202609080006_session_integrity.sql`: retained tokens lose database access when their Supabase session is removed.
7. `202609080007_membership_idempotence.sql`: repeated identical authorization/seed operations do not create duplicate membership audit events.

## Tables

- Identity/access: `profiles`, `households`, `household_memberships`.
- Financial identity: `financial_parties`, `institutions`, `instruments`, `logical_accounts`, `account_source_bindings`.
- Evidence: `balance_observations`, `position_observations`, `price_observations`, `exchange_rates`, `uf_values`.
- Decisions: `ownership_decisions`, `inclusion_decisions`, `resolution_decisions`.
- Economic metadata/journal: `manual_assets`, `liabilities`, `obligations`, `obligation_events`.
- Review: `duplicate_candidates`, `review_tasks`.
- Derived history: `valuation_runs`, `valuation_components`, `net_worth_snapshots`.
- Minimal tracking: `audit_events`, `command_receipts`; unexposed `private.deletion_receipts`.

All financial tables carry `household_id`. Entity keys are UUIDv5(household UUID, scoped domain key); composite foreign keys include household ID. Known account IDs cannot cross a household boundary. A source binding has a single nullable logical-account target; immutable duplicate resolution decisions use the existing account. Unique candidate-per-binding and component-per-run/account constraints prevent duplicate economic entries in the persisted valuation. The engine enforces statement-total versus child-component valuation, so both cannot contribute.

Money/event numeric columns have eight fractional places; quantities/prices twelve; percentages/FX/UF sixteen. Input constraints reject excess precision rather than silently rounding these evidence values. UUID IDs, UTC `timestamptz` effective/recorded times, matching original payload timestamps and nonnegative/positive/range constraints are enforced. PostgreSQL has no floating-point financial columns. Original values remain decimal strings in API/JSON export.

Balances and decisions are appended. Obligation outstanding values are derived from their journal, with one initial capital event, nonnegative outstanding, ordered dates, consistent currency and bounded repayment checks. Membership roles are `owner`/`helper`; the unchanged domain engine's internal `admin`/`viewer` mapping is an adapter detail. Application membership confers no financial ownership.

Profiles can be read only by their own user. Household memberships expose only the display name/role needed for that household. Deleted authors remain detached UUID references labeled “Participante anterior” in historical financial evidence; no provider credentials or emails are stored there.
