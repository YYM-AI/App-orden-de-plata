# Authentication

The application uses official Supabase email/password authentication with server-created or invited test identities. Supabase owns password hashing. Application tables store no passwords or password hashes. There is no registration page or public administration endpoint.

Both controls are required:

- Supabase global registration disabled (`[auth].enable_signup=false` locally).
- `profiles.allowlisted=true` set only through trusted administration, plus an active membership for household access.

`[auth.email].enable_signup=true` enables the entire email provider, including sign-in for already-created users. Setting it false disables that provider and breaks invited-user sign-in. It does **not** override the global closed-registration setting. The real Auth signup rejection is tested. See [provider/global setting distinction](https://github.com/supabase/supabase/issues/40582).

`/login` is Spanish, accepts the authorized application identity only, and returns generic invalid-login errors. `/api/auth/login` applies same-origin checks and a best-effort process limiter in addition to Supabase's provider limiter. `/auth/callback` accepts an official PKCE code exchange and a fixed internal destination; a caller-supplied redirect URL is ignored. Missing configuration fails closed.

Official SSR clients manage HTTPOnly, SameSite=Lax cookies, with Secure enabled on HTTPS. No browser JavaScript reads tokens and no tokens are manually persisted in localStorage. `proxy.ts` refreshes cookies and redirects unauthenticated financial-page requests. Protected layouts and APIs independently validate Auth and allowlist; database RLS checks current session/membership again. Expired, deleted and revoked access is denied on the next validated request.

Sign-out clears official cookies and removes the Supabase session. `private.allowed()` also requires the claimed session to still exist, denying retained JWTs after logout. Deletion requires an Auth session created within the preceding ten minutes; token refresh alone does not make an old session recent. Re-sign-in creates a fresh session.

Local credentials are generated with cryptographic random passwords and stored only in ignored `.local/test-accounts.json` with mode 0600. Do not copy local test identities/passwords to a hosted project. Hosted users require secure administration and an explicit allowlist; never paste credentials into chat.
