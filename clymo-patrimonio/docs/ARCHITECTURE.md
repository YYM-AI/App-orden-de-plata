# Architecture

M2 retains the independent Next.js App Router application and the M1 exact-decimal financial engine. Clymo Alerts remains outside the dependency graph.

```text
Spanish React UI → authenticated same-origin API → validated application command
  → PrototypeRepository interface → SupabaseRepository → guarded RPC / PostgreSQL

Financial engine → domain models / decimal.js / policy (no Supabase imports)
```

`domain/commands.ts` appends observations and decisions and checks current command authority. `domain/validation.ts` validates reference integrity and economic consistency; historical authors remain identifiable after membership changes. New authors must be the authenticated owner when the database accepts an append. `domain/engine.ts` computes exact decimal values, with an explicit eight-decimal valuation boundary; presentation rounding does not rewrite observations.

`persistence/repository.ts` contains the existing interface. The production adapter loads a consistent MVCC state using `read_household`, and saves through an atomic owner-only RPC. The old local and memory adapters live only in `tests/legacy/` for preserved M1 regression coverage. They are not imported by the application.

The server uses fresh official `auth.getUser()` validation, the live profile allowlist and a live household membership on each request. SQL independently checks the Auth session, allowlist and membership. Cookie values are managed through official Supabase SSR clients. The UI has no Supabase administration client or service key.

A household is reconstructed from normalized per-entity tables, not one whole-household JSON document. Each domain row retains a JSON payload for lossless string values and original domain identifiers; generated stored numeric columns and scoped UUID foreign keys enforce financial/relational constraints. Household rows contain metadata, policy and settings only.

Saving locks the household, checks expected revision, compares old evidence against proposed evidence, appends new rows, stores a valuation run/components/snapshot, records a command receipt and a minimal audit event in one transaction. A repeated command UUID is idempotent. Stale concurrent revisions return a conflict. Reset and deletion use narrowly granted owner-only functions; generic table updates cannot rewrite evidence.

The authenticated client keeps only an in-memory view. Navigation, visibility restoration, refresh and periodic validation retrieve current authorized state. Hidden pages clear financial state; revocation clears the view at the next validated request. There is no service worker or persistent financial client cache. Protected routes and responses use no-store. A full navigation changes the selected household.

Official references: [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [PostgreSQL RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). These do not constitute independent certification of this implementation.

The optional M1 WebMCP snapshot component remains inactive in the authenticated application pending a separate authorization-lifecycle review. It exposes no registered financial tool in M2.
