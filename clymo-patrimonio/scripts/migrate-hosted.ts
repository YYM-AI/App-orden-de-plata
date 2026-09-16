import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hostedConnection, HOSTED_REF } from './hosted-config';

const pg = hostedConnection();
const directory = 'supabase/migrations';
const files = readdirSync(directory)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort();
const evidence: object[] = [];
try {
  await pg.connect();
  await pg.query("select pg_advisory_lock(hashtext('clymo-hosted-migrations'))");
  const ledger = await pg.query(
    "select to_regclass('supabase_migrations.schema_migrations') present",
  );
  if (!ledger.rows[0].present) {
    const tables = await pg.query("select tablename from pg_tables where schemaname='public'");
    if (tables.rowCount) throw Error('Refusing to initialize an unrecognized, nonempty database.');
    await pg.query('create schema if not exists supabase_migrations');
    await pg.query(
      'create table supabase_migrations.schema_migrations(version text primary key, statements text[], name text)',
    );
  }
  const previous = (
    await pg.query(
      'select version,statements from supabase_migrations.schema_migrations order by version',
    )
  ).rows;
  if (previous.some((r) => !files.some((f) => f.startsWith(r.version + '_'))))
    throw Error('Hosted database contains an unexpected migration.');
  for (const file of files) {
    const sql = readFileSync(`${directory}/${file}`, 'utf8');
    const version = file.split('_')[0];
    const existing = previous.find((r) => r.version === version);
    if (existing && existing.statements?.join('\n') !== sql)
      throw Error(`Migration ${version} differs from its recorded source.`);
    if (!existing) {
      await pg.query('begin');
      try {
        await pg.query(sql);
        await pg.query(
          'insert into supabase_migrations.schema_migrations(version,statements,name) values($1,$2,$3)',
          [version, [sql], file.slice(version.length + 1, -4)],
        );
        await pg.query('commit');
      } catch (error) {
        await pg.query('rollback');
        throw error;
      }
    }
    evidence.push({
      file,
      sha256: createHash('sha256').update(sql).digest('hex'),
      result: existing ? 'already applied; source verified' : 'applied',
    });
    console.log(`${file}: ${existing ? 'verified' : 'applied'}`);
  }
  writeFileSync(
    'docs/MILESTONE_2_HOSTED_MIGRATIONS.json',
    JSON.stringify(
      {
        projectRef: HOSTED_REF,
        checkedAt: new Date().toISOString(),
        tlsVerified: true,
        migrations: evidence,
      },
      null,
      2,
    ) + '\n',
  );
} catch (error) {
  // Never print connection objects or credential-bearing diagnostic payloads.
  console.error(
    'Hosted migration failed:',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exitCode = 1;
} finally {
  await pg.end();
}
