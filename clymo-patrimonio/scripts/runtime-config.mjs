import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const bin = existsSync('.local/bin/supabase') ? resolve('.local/bin/supabase') : 'supabase';
const env = { ...process.env, PATH: resolve('.local/bin') + ':' + process.env.PATH };
const status = JSON.parse(
  execFileSync(bin, ['status', '--output', 'json'], {
    env,
    stdio: ['ignore', 'pipe', 'ignore'],
    encoding: 'utf8',
  }),
);
const url = new URL(status.API_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw Error('Only a local Supabase stack may be configured by this script.');
mkdirSync('.local', { recursive: true, mode: 0o700 });
writeFileSync('.local/status.json', JSON.stringify(status), { mode: 0o600 });
chmodSync('.local/status.json', 0o600);
const values = {
  NEXT_TELEMETRY_DISABLED: '1',
  APP_ORIGIN: 'http://127.0.0.1:3100',
  SUPABASE_URL: status.API_URL,
  SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  DATABASE_URL: status.DB_URL,
};
for (const [name, value] of Object.entries(values))
  if (!value) throw Error(`Local runtime is missing ${name}.`);
writeFileSync(
  '.env.local',
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
chmodSync('.env.local', 0o600);
console.log(
  'Local environment configured in ignored, owner-readable files. Secret values were not printed.',
);
