import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const command = process.argv[2];
const actions = {
  start: [
    'start',
    '-x',
    'studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,inbucket',
  ],
  stop: ['stop'],
  reset: ['db', 'reset', '--local'],
  migrate: ['migration', 'up', '--local'],
};
if (!actions[command]) throw Error('Unknown local database command.');
const bin = existsSync('.local/bin/supabase') ? resolve('.local/bin/supabase') : 'supabase';
const child = spawn(bin, actions[command], {
  env: { ...process.env, PATH: resolve('.local/bin') + ':' + process.env.PATH },
  stdio: ['ignore', 'pipe', 'pipe'],
});
// CLI startup output contains credentials. Keep it out of logs; reveal only safe lifecycle status.
let stderr = '';
child.stdout.resume();
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});
child.on('error', () => {
  console.error(
    'Local Supabase CLI could not start. Install the CLI and a Docker-compatible runtime.',
  );
  process.exitCode = 1;
});
child.on('close', (code) => {
  if (code === 0) console.log(`Local Supabase ${command} completed. Credential output suppressed.`);
  else {
    console.error(
      `Local Supabase ${command} failed (exit ${code}). Check the local Docker runtime and CLI configuration.`,
    );
    // The diagnostic category is useful without printing CLI tokens, URLs or configuration values.
    for (const category of [
      'Cannot connect to the Docker daemon',
      'connection refused',
      'failed to start',
      'migration failed',
      'port is already allocated',
    ])
      if (stderr.includes(category)) console.error(category);
    process.exitCode = code ?? 1;
  }
});
