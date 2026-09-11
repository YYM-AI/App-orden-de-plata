import { access } from 'node:fs/promises';
import { Client } from 'pg';

try {
  process.loadEnvFile('.env.local');
  const url = new URL(process.env.SUPABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname))
    throw Error('Local verification requires a loopback database.');
  await access('.local/test-accounts.json');
  const health = await fetch(new URL('/auth/v1/health', url), {
    headers: { apikey: process.env.SUPABASE_ANON_KEY },
    signal: AbortSignal.timeout(5000),
  });
  if (!health.ok) throw Error('Local Auth is unavailable.');
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await db.connect();
    const { rows } = await db.query(
      "select exists(select 1 from supabase_migrations.schema_migrations where version='202609080007') as ready",
    );
    if (!rows[0]?.ready) throw Error('Local migrations are incomplete.');
  } finally {
    await db.end();
  }
  console.log(
    'PASS: local Auth, PostgreSQL, migrations and synthetic identity file are available.',
  );
} catch {
  console.error(
    'Local test stack is unavailable. Start the isolated Docker runtime, then run db:start, db:configure, db:migrate and db:seed. No credential values were printed.',
  );
  process.exitCode = 1;
}
