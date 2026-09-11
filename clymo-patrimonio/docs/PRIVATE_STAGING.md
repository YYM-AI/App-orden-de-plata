# Private staging

**Not yet provisioned or verified. Do not call M2 complete or publish an open public financial application.** Remote provisioning remains a separate requirement. On 9 September and again on 10 September 2026 the official Supabase dashboard redirected to sign-in, so no authenticated hosted project is available to this task. No hosted project, deployment or billing was created.

The required hosted configuration is a free Supabase project, closed registration, an explicit profile allowlist and a free HTTPS application host. Use provider-level owner restriction where available without billing, plus application authentication in all cases. A hidden/unlisted URL or robots.txt is not an access-control mechanism.

Required private server configuration, through secure provider settings only:

- `APP_ORIGIN`: exact stable HTTPS application origin.
- `SUPABASE_URL`: dedicated synthetic staging project.
- `SUPABASE_ANON_KEY`: corresponding publishable/anon credential.
- `SUPABASE_SERVICE_ROLE_KEY`: protected server secret for authenticated self-account deletion.
- `CLYMO_BUILD_COMMIT`: exact tested commit, when provided by a deployment runner.

`DATABASE_URL` is only for trusted migrations/test administration; the Next runtime uses HTTPS PostgREST/Auth, not direct database TCP. Never use `NEXT_PUBLIC_` for service keys. Do not copy `.env.local` or local test-identity files into Git or a public build artifact.

Before deployment: verify free plan/no billing, secure account authorization, exact callback/site URLs, global signup disabled, explicit test-user allowlist and owner/helper memberships, reproducible versioned migrations, synthetic fixtures only, host access restriction, no secret-bearing build logs, HTTPS/cookie/CSP compatibility, and the clean tested Git SHA. Local bootstrap/test scripts intentionally reject hosted URLs. Hosted identity provisioning must use secure administrative tooling and separate generated credentials.

After deployment: record stable URL, access-control method, exact commit from protected diagnostics, provider configuration, and actual owner/helper/unrelated/unauthenticated checks. Repeat canonical totals, export authorization, logout, mobile layout, robots, console and no-unauthenticated-financial-content checks in a real browser. Do not substitute local screenshots for deployed verification.

If no secure authenticated free project/host is available, finish all local work, then request one specific secure authentication/provisioning action from the user. Do not ask for passwords, private tokens, service keys or recovery codes in chat. Do not activate billing, buy a domain/email/database or choose a paid deployment feature.

Rollback: disable access to a bad staging version and deploy the previously verified source commit in an isolated checkout. Never rewrite Git history or apply destructive rollback against another application's database. M1 is a browser-local prototype and must not be redeployed as a publicly open replacement for M2. Preserve schema-compatible synthetic data or rebuild only the dedicated synthetic staging project from migrations after explicit administrative review. Export authorized synthetic fixtures if needed before a reset.

Resource teardown: revoke staging access, remove its deployment, securely remove that dedicated synthetic Supabase project and configured secrets through the provider, and verify they are absent. Check names/IDs before deletion. This task has not authorized removal of unrelated projects or resources.

## Current secure handoff

The next external step is for the user to sign in through the official Supabase dashboard in the opened browser tab. No password, token or key should be sent through chat. After that secure sign-in, continue this same milestone: inspect free-tier availability, provision a dedicated synthetic project without billing, apply the versioned migrations, configure closed signup/allowlist and server secrets securely, deploy the tested branch behind access controls, and perform the required hosted browser verification. The local build is not a substitute for that evidence.
