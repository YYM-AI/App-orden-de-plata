import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const result = spawnSync(resolve('node_modules/.bin/vinext'), ['build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
    APP_ORIGIN: 'https://clymo-patrimonio-m2.familiameirovichhaic.chatgpt.site',
  },
});
if (result.status !== 0) process.exit(result.status ?? 1);

// The plugin can emit development credentials for preview. They never belong in an archive.
function removePreviewCredentials(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = `${path}/${entry.name}`;
    if (entry.isSymbolicLink()) throw Error('Staging output must not contain symlinks.');
    if (/^(\.dev\.vars|\.env)(\.|$)/.test(entry.name)) rmSync(file);
    else if (entry.isDirectory()) removePreviewCredentials(file);
  }
}
removePreviewCredentials('dist');
const secrets = [];
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
  secrets.push(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.DATABASE_URL);
}
if (existsSync('.local/hosted-staging.json')) {
  const hosted = JSON.parse(readFileSync('.local/hosted-staging.json', 'utf8'));
  secrets.push(hosted.databasePassword, hosted.serviceRoleKey);
}
let files = 0;
function scan(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = `${path}/${entry.name}`;
    if (entry.isDirectory()) scan(file);
    else {
      files++;
      const text = readFileSync(file, 'utf8');
      if (secrets.filter(Boolean).some((value) => text.includes(value)))
        throw Error('Staging artifact contains a configured secret. Deployment is blocked.');
      if (
        file.startsWith('dist/client/') &&
        ['60240000', '52540000', '11111111-1111-4111-8111-111111111111'].some((v) =>
          text.includes(v),
        )
      )
        throw Error('Public staging artifact contains a synthetic household fixture payload.');
    }
  }
}
scan('dist');
console.log(
  `PASS: ${files} staging artifact files scanned; no configured secrets or public fixture payloads.`,
);
