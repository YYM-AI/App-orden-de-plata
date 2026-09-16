import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Preview binds only the isolated local synthetic stack. Hosted secrets are never copied.
process.loadEnvFile('.env.local');
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.SUPABASE_URL).hostname))
  throw Error('Worker preview requires the isolated local synthetic Supabase stack.');
mkdirSync('.local', { recursive: true, mode: 0o700 });
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
config.main = resolve('dist/server/index.js');
config.assets.directory = resolve('dist/client');
delete config.configPath;
delete config.userConfigPath;
writeFileSync('.local/worker-preview.json', JSON.stringify(config), { mode: 0o600 });
const vars = { APP_ORIGIN: 'http://127.0.0.1:3101' };
for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) throw Error(`Missing local runtime value: ${key}`);
  vars[key] = process.env[key];
}
writeFileSync(
  '.local/.dev.vars',
  Object.entries(vars)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
const child = spawn(
  resolve('node_modules/.bin/wrangler'),
  [
    'dev',
    '--config',
    '.local/worker-preview.json',
    '--ip',
    '127.0.0.1',
    '--port',
    '3101',
    '--local',
    '--log-level',
    'error',
  ],
  { stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
