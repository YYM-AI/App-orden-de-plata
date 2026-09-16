# Export and deletion

## Export

Owners download versioned JSON or a UTF-8 CSV summary from Configuración. Helpers, unrelated identities, revoked memberships and unauthenticated requests are denied at API and database layers. POST requests require the configured Origin. Responses set Content-Disposition, nosniff and no-store.

JSON `clymo-export-2` includes generation timestamp, household ID, reporting currency, synthetic notice, normalized domain collections, members/roles, current exact calculation and all persisted valuation runs/components/snapshots and minimal audits. It has no authentication records, email/password details, tokens, keys or provider credentials. Original numeric values and numeric history are strings.

CSV contains one row per economic account, including excluded accounts: version, UTC timestamp, household, synthetic flag, reporting/original currency, original amount, ownership, converted value, effective date, inclusion flag/reasons and provenance. It uses a UTF-8 BOM, CRLF, quoted cells and doubled embedded quotes. Formula-like prefixes (including leading whitespace, =, +, -, @, tabs/newlines) are prefixed with a quote. It is a readable summary; the JSON export supplies the complete history.

An export audit event is written after the payload is generated successfully and before the response is returned. The server can confirm successful response preparation, not that the user saved the downloaded file. Exports are not stored server-side. Existing downloaded files on a user's own device cannot be recalled by household deletion.

## Household deletion

An authenticated owner must have signed in during the last ten minutes, type the exact current household name, tick the irreversible-confirmation checkbox, and press the final deletion button. The API validates both confirmations; the SQL function independently checks live ownership, recent Auth session and household name.

A single transaction deletes the household and cascading memberships, normalized financial evidence, review/duplicate rows, valuation history, receipts and household audit records. The UI clears its view and redirects. Former owners/helpers are denied by the old household ID. No storage objects or server-retained export files exist.

A private, inaccessible-to-users deletion receipt retains only a random receipt UUID, actor UUID, kind, completion time and phase. It contains no household ID/name, amounts, source details or financial payload; it exists to track completion. Household deletion-request audits are part of the deleted household and do not survive the transaction; the private completion receipt is the retained record.

## Application-account deletion

Self-account deletion is also available to an allowlisted user who has no household. It requires recent sign-in, `ELIMINAR MI CUENTA`, explicit confirmation and the final button. The caller cannot supply another account UUID.

The database locks the caller's households, checks last-owner safety, removes only that user's memberships, deactivates the profile and records a non-financial request receipt. A protected server-only Supabase admin client then deletes the authenticated Auth identity. A database trigger completes the receipt. If the provider call fails, the account stays deactivated and the same authenticated user may retry; ordinary financial access is already denied. Account deletion is a two-phase operation across PostgreSQL and the Auth provider, not a claim of a distributed transaction.

The last owner must delete the household or authorize another owner first. Households of remaining owners and historical evidence survive. Historical author UUIDs are detached from the deleted profile and shown as a former participant. No ordinary account deletion removes another owner's household.
