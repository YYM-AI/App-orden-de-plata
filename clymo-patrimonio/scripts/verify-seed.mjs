import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
process.loadEnvFile('.env.local');
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.SUPABASE_URL).hostname))
  throw Error('Local synthetic verification only.');
const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
async function fingerprint() {
  const result = {};
  for (const { tablename: t } of (
    await pg.query("select tablename from pg_tables where schemaname='public' order by tablename")
  ).rows) {
    result[t] = (
      await pg.query(
        `select count(*)::text count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) digest from public."${t}" t`,
      )
    ).rows[0];
  }
  return result;
}
try {
  execFileSync('npm', ['run', 'db:seed'], { stdio: 'ignore' });
  const before = await fingerprint();
  execFileSync('npm', ['run', 'db:seed'], { stdio: 'ignore' });
  const after = await fingerprint();
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error('Seed changed existing public application records on second execution.');
  console.log(
    `PASS: repeated seed preserves all rows in ${Object.keys(after).length} public application tables.`,
  );
  console.log(
    'Fixture counts: ' +
      JSON.stringify(Object.fromEntries(Object.entries(after).map(([k, v]) => [k, v.count]))),
  );
} finally {
  await pg.end();
}
