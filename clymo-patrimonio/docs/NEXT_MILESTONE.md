# Recommended Milestone 2 · Validate the synthetic product and design the private data boundary

Keep the next increment synthetic while validating whether older and non-technical users can explain the dated totals, exclusions and ownership without coaching. Run repeat tasks with a disclosed number of unique participants; measure mistakes, time, recovery and maintenance. Do not infer usability from passing browser automation.

Prioritize a small, evidence-backed correction cycle: understand net worth versus liquidity; trace the broker's quantity/price/FX dates; update a stale source; reject a duplicate; explain a linked repayment; hide and re-enable obligations safely. Confirm the proposed freshness, precision and materiality policies with a domain owner.

Design a Patrimonio-owned private service/PostgreSQL schema and repository adapter with authentication, server-side authorization, RLS and tenant isolation. Exercise backups, reset/deletion, migration and concurrency using synthetic fixtures first. Existing client-side membership checks are not a substitute.

Before **any real financial data**, require:

1. Approved threat model, data map, legal/privacy role, notices, terms and consent boundaries.
2. Real authentication/recovery, authorization at API/database/storage boundaries, household-isolation negative tests and RLS.
3. Encrypted storage and key management, least-privilege service identities, no financial values in logs or analytics.
4. Retention, deletion/export, backup expiry/restore, incident response, support controls and rollback evidence.
5. Approved vendors/regions/transfers and an independent security assessment with no unresolved high/critical findings.
6. Approved financial policy and user-facing coverage/estimate claims.
7. Private staging with controlled access, tested on the exact release build.

Document intake would be a later explicitly approved milestone: lawful corpus, named supported formats, quarantine, retention and deterministic parsing. Five templates do not limit accounts. Live institutions, real prices/FX, OCR, recommendations, trading and Alerts integration remain separate future gates; none is needed to validate this foundation.
