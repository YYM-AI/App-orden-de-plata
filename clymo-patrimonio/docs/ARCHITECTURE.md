# Architecture

## Independent modular application

```text
Next.js routes / /fuentes /revision /configuracion
    → React client provider + accessible UI
    → validated commands → immutable new state
    → pure financial engine → valued components → snapshot
    → PrototypeRepository → browser localStorage (prototype only)
                           → in-memory repository (tests)
```

Next serves static route shells and client JavaScript. Financial state stays in the browser; no application API receives it. Context holds one validated state and derives snapshots. The four routes share state across navigation. User input is rendered as text; no raw HTML interpolation or financial logging is used.

`domain/model.ts`: Zod contracts and exported entity types. `domain/validation.ts`: runtime shape, identity, ownership boundary, currency/reference and obligation-journal checks. `domain/commands.ts`: validated transformations that clone their input and append evidence/decisions. `domain/engine.ts`: observation selection, ownership, inclusion, rates, components, snapshot and review derivation. `domain/freshness.ts`: versioned date rules. `data/fixture.ts`: deterministic synthetic adapter.

`PrototypeRepository` exposes `load`, `save(expectedRevision)`, and `reset`. Local writes serialize one validated state. The UI updates only after persistence succeeds; quota failures do not announce a successful change. Corrupted stored data is preserved until explicit reset. Revision checking and storage-event warnings detect stale-tab edits; this is not a transactional multi-user database or comprehensive concurrent-writer solution.

Reset is an explicitly confirmed destructive operation on disposable demo state. Normal observations, ownership, inclusion, source-binding resolutions and obligation events are append-only. Replayed command identities do not append again.

## Extending later

Replace the repository with a Patrimonio-owned service/PostgreSQL implementation, keeping domain commands and calculations. Real collaboration requires server-side authentication/authorization and atomic transactions, not trusted client state. Use numeric monetary columns, immutable evidence tables, and append-only decision/event tables. Provider adapters should produce validated domain observations; they are not implemented in this milestone. There are no fake OAuth, extraction, market feed or bank adapter implementations.

A progressive, read-only WebMCP tool (`get_synthetic_net_worth`) returns the same snapshot shown by the interface when the browser supports the experimental API. It cannot change data or connect an institution. Normal UI operation does not depend on WebMCP.

No PWA/service worker, external fonts, build-time remote content, root workspace dependency, shared database, shared credentials, cloud provisioning or release dependency on Alerts. Basic response headers and noindex metadata are present; they are not an authentication system.
