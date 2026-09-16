# Local Supabase setup

Use a synthetic-only local database. This application does not connect to the older root app or any Clymo Alerts secret.

## Prerequisites

- Node >=22.13 and npm; this workstation uses Node 26.7.0 / npm 11.19.0.
- Supabase CLI; local verification uses 2.117.0.
- Docker-compatible runtime. This workstation uses free Colima 0.10.3/Lima 2.2.0 and Docker CLI 29.8.0, with an isolated `clymo-patrimonio` profile (2 CPUs, 4 GiB memory, approximately 20 GiB virtual disk).

On a supported workstation, install the free tools through their official distribution. The current Intel macOS machine needed official prebuilt CLI binaries because Homebrew's Docker/Supabase install required newer Command Line Tools. No system developer tools were removed. Downloaded binaries are local ignored tooling, not repository artifacts: [Supabase CLI release](https://github.com/supabase/cli/releases/tag/v2.117.0), [official Docker static CLI index](https://download.docker.com/mac/static/stable/x86_64/).

For the existing configured workstation, run inside `clymo-patrimonio`:

```sh
PATH="$PWD/.local/bin:$PATH" colima start clymo-patrimonio --cpu 2 --memory 4 --disk 20 --vm-type vz --runtime docker
export DOCKER_CONTEXT=colima-clymo-patrimonio
npm ci --no-audit --no-fund
npm run db:start
npm run db:configure
npm run db:migrate
npm run db:seed
npm run db:check
npm run build
npm run start
```

The tooling wrapper prefers `.local/bin/supabase` and otherwise uses the installed CLI. `db:start` excludes unused storage, realtime, edge, studio and analytics services. Startup command output is suppressed because Supabase normally prints development keys. `db:configure` captures local status securely and creates `.env.local` and `.local/status.json`, mode 0600. Never print those files into shared logs.

Local configuration: project ID `clymo-patrimonio-m2`, HTTP API `127.0.0.1:55321`, PostgreSQL `127.0.0.1:55322`, shadow database 55320, local email capture 55324. The application binds `127.0.0.1:3100`. Local HTTP is for loopback development; hosted staging must use HTTPS.

## Identities and fixtures

`npm run db:seed` creates seven synthetic `.test` identities: owner/helper A, owner/helper B, owner C, unrelated allowlisted user, and an unapproved user. Passwords are random; only `.local/test-accounts.json` contains their values. Open that file privately on your workstation when signing into the local app. It is ignored and must remain mode 0600. No emails are delivered to real recipients.

Household creation is an idempotent owner-only RPC. Existing financial records are not overwritten by rerunning seed. A is canonical, B is North, C is empty. Reset in the application restores the selected household's configured fixture, preserving membership and security audit history.

## Reset and tests

The following is destructive only to this isolated local synthetic database. Do not run while browser/database tests or the app are writing:

```sh
npm run db:reset
npm run db:migrate
npm run db:configure
npm run db:seed
npm run db:seed
npm run test:unit
npm run test:integration
npm run test:database
npm run build
npm run test:e2e
```

After reset, Auth users/sessions are rebuilt: sign in again. Tests refuse non-loopback Supabase URLs. SQL suites use real role/RLS enforcement with rollback-only transactions; repository/E2E tests commit synthetic writes then reset their fixture. Run suites sequentially. E2E traces are disabled to avoid recording authentication request bodies. The E2E server runs `db:check` first so a stopped VM or missing migrations fail once before browser tests start. Restart the existing Colima profile after a workstation restart; it is not automatically kept running by the application.

To stop without destroying the database: `npm run db:stop`, then `colima stop clymo-patrimonio`. This preserves local volumes. Destruction of the isolated runtime/volumes is a separate explicit administrative operation; check the active project/profile before removing them. Never remove unrelated Docker volumes or another application's data.
