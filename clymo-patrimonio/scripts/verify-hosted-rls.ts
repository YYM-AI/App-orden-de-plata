import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { hostedConfig, hostedConnection, HOSTED_REF } from './hosted-config';
import { ENTITIES } from '../database/entities';
import { householdFixture } from '../data/households';
import { applyCommand } from '../domain/commands';
import { calculateSnapshot } from '../domain/engine';

// Same non-vacuous matrix as rls.test.ts, batched inside PostgreSQL to avoid
// thousands of intercontinental round trips and an hour-long test transaction.
const c = hostedConfig(),
  pg = hostedConnection();
const accounts = JSON.parse(readFileSync('.local/hosted-test-accounts.json', 'utf8'));
const households = {
  A: '11111111-1111-4111-8111-111111111111',
  B: '22222222-2222-4222-8222-222222222222',
  C: '33333333-3333-4333-8333-333333333333',
};
const actors = [
  'anonymous',
  'ownerA',
  'helperA',
  'ownerB',
  'helperB',
  'ownerC',
  'outsider',
  'revokedA',
];
const tables = [
  'households',
  'household_memberships',
  ...ENTITIES.map(([, t]) => t),
  'valuation_runs',
  'valuation_components',
  'net_worth_snapshots',
  'audit_events',
  'command_receipts',
];
const claims: Record<string, object> = {};
const lit = (v: unknown) => "'" + String(v).replaceAll("'", "''") + "'";
const identifier = (v: string) => '"' + v.replaceAll('"', '""') + '"';
const scope = (table: string) => (table === 'households' ? 'id' : 'household_id');
const owns = (actor: string, label: string) => actor === `owner${label}`;
const reads = (actor: string, label: string) => owns(actor, label) || actor === `helper${label}`;

function probe(
  name: string,
  actor: string,
  sql: string,
  success: string,
  allowedErrors: string[] = [],
) {
  const identity = actor === 'revokedA' ? 'helperA' : actor;
  const revoke =
    actor === 'revokedA'
      ? `update public.household_memberships set active=false where household_id=${lit(households.A)} and user_id=${lit(accounts.helperA.id)};`
      : '';
  return `ok := false; error_code := null;
    begin
      ${revoke}
      execute 'set local role ${actor === 'anonymous' ? 'anon' : 'authenticated'}';
      perform set_config('request.jwt.claims',${lit(JSON.stringify(claims[identity] ?? {}))},true);
      ${sql}
      ok := ${success};
      raise exception using errcode='P9999', message='rollback successful probe';
    exception when sqlstate 'P9999' then null;
      when others then error_code := sqlstate; ok := sqlstate = any(array[${allowedErrors.map(lit).join(',')}]::text[]);
    end;
    if not ok then raise exception 'RLS probe failed: %, code %', ${lit(name)}, coalesce(error_code,'unexpected successful result'); end if;
    insert into probe_results values(${lit(name)});`;
}
async function batch(probes: string[]) {
  await pg.query(
    `do $clymo_probe$ declare ok boolean; error_code text; n bigint; begin ${probes.join('\n')} end $clymo_probe$`,
  );
}
const countQuery = (sql: string) => `execute ${lit(sql)} into n;`;
const mutation = (sql: string) => `execute ${lit(sql)}; get diagnostics n = row_count;`;

try {
  for (const actor of actors.filter((a) => a !== 'anonymous' && a !== 'revokedA')) {
    const db = createClient(c.supabaseUrl, c.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await db.auth.signInWithPassword(accounts[actor]);
    if (result.error || !result.data.session) throw Error(`Hosted Auth failed for ${actor}.`);
    claims[actor] = JSON.parse(
      Buffer.from(result.data.session.access_token.split('.')[1], 'base64url').toString(),
    );
  }
  await pg.connect();
  await pg.query('begin');
  await pg.query('create temporary table probe_results(name text primary key) on commit drop');
  for (const [label, id] of Object.entries(households)) {
    const owner = 'owner' + label;
    await pg.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(claims[owner]),
    ]);
    let s = householdFixture(id, `Isolation Sentinel ${label}`, accounts[owner].id, 'canonical');
    for (const command of [
      {
        type: 'inclusion',
        accountId: 'cash',
        include: false,
        effectiveDate: s.cutoff,
        reason: 'Prueba de aislamiento',
      },
      {
        type: 'review',
        reviewId: 'review-duplicate',
        action: 'bind',
        effectiveDate: s.cutoff,
        reason: 'Prueba de aislamiento',
      },
    ] as const)
      s = applyCommand(s, command, {
        id: randomUUID(),
        actorId: accounts[owner].id,
        recordedAt: new Date().toISOString(),
      });
    await pg.query('select public.reset_household($1,$2,$3)', [id, s, calculateSnapshot(s)]);
    await pg.query(
      'insert into public.command_receipts(id,household_id,revision) values($1,$2,1)',
      [randomUUID(), id],
    );
  }
  const rows: Record<string, Record<string, unknown>> = {};
  const rowQueries = tables.flatMap((t) =>
    Object.entries(households).map(
      ([label, id]) =>
        `select ${lit(t + label)} key,to_jsonb(r) payload from (select * from public.${identifier(t)} where ${scope(t)}=${lit(id)} limit 1) r`,
    ),
  );
  for (const row of (await pg.query(rowQueries.join(' union all '))).rows)
    rows[row.key] = row.payload;
  if (Object.keys(rows).length !== tables.length * 3)
    throw Error('Every isolation target must contain sentinel rows.');
  const columns: Record<string, string[]> = {};
  for (const row of (
    await pg.query(
      "select table_name,array_agg(column_name::text order by ordinal_position) cols from information_schema.columns where table_schema='public' and is_generated='NEVER' and is_identity='NO' group by table_name",
    )
  ).rows)
    columns[row.table_name] = row.cols;
  for (const table of tables) {
    const checks: string[] = [],
      financial = ENTITIES.some(([, t]) => t === table);
    for (const [label, id] of Object.entries(households))
      for (const actor of actors) {
        const name = `${table} / ${actor} → ${label}`;
        checks.push(
          probe(
            name + ' SELECT',
            actor,
            countQuery(
              `select count(*) from public.${identifier(table)} where ${scope(table)}=${lit(id)}`,
            ),
            actor === 'anonymous' ? 'false' : reads(actor, label) ? 'n > 0' : 'n = 0',
            actor === 'anonymous' ? ['42501'] : [],
          ),
        );
        const base = rows[table + label],
          clone = { ...base };
        if (owns(actor, label) && financial) {
          const key = 'probe-' + randomUUID(),
            payload = { ...(base.payload as Record<string, unknown>), id: key };
          if ('actorId' in payload) payload.actorId = accounts[actor].id;
          clone.domain_key = key;
          clone.payload = payload;
        }
        const data =
          owns(actor, label) && financial
            ? `jsonb_set(${lit(JSON.stringify(clone))}::jsonb,'{id}',to_jsonb(private.entity_id(${lit(id)},${lit(clone.domain_key)})))`
            : `${lit(JSON.stringify(clone))}::jsonb`;
        const cols = columns[table].map(identifier).join(',');
        checks.push(
          probe(
            name + ' INSERT',
            actor,
            mutation(
              `insert into public.${identifier(table)} (${cols}) select ${cols} from jsonb_populate_record(null::public.${identifier(table)},${data})`,
            ),
            owns(actor, label) && financial ? 'n = 1' : 'false',
            owns(actor, label) && financial ? ['23505'] : ['42501'],
          ),
        );
        for (const verb of ['UPDATE', 'DELETE']) {
          const query =
            verb === 'UPDATE'
              ? `update public.${identifier(table)} set ${scope(table)}=${lit(label === 'A' ? households.B : households.A)} where ${scope(table)}=${lit(id)}`
              : `delete from public.${identifier(table)} where ${scope(table)}=${lit(id)}`;
          checks.push(
            probe(
              name + ' ' + verb,
              actor,
              mutation(query),
              actor !== 'anonymous' && financial ? 'n = 0' : 'false',
              actor === 'anonymous' || !financial ? ['42501'] : [],
            ),
          );
        }
      }
    await batch(checks);
    console.log(`PASS: ${table}, ${checks.length} hosted CRUD checks.`);
  }
  const catalog = [
    [
      'RLS on every table',
      "select count(*)=28 and bool_and(c.relrowsecurity) ok from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','private')",
    ],
    [
      'No floating point finance',
      "select count(*)=0 ok from information_schema.columns where table_schema='public' and data_type in ('real','double precision')",
    ],
    [
      'Pinned functions and no PUBLIC execution',
      "select bool_and(p.proconfig @> array['search_path=\"\"'] and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')) ok from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.prokind='f'",
    ],
  ];
  for (const [name, sql] of catalog) {
    if (!(await pg.query(sql)).rows[0].ok) throw Error(`Catalog assertion failed: ${name}`);
    await pg.query('insert into probe_results values($1)', [name]);
  }
  const remaining: string[] = [];
  for (const actor of actors) {
    const identity = actor === 'revokedA' ? 'helperA' : actor;
    remaining.push(
      probe(
        actor + ' profile scope',
        actor,
        countQuery(
          actor === 'anonymous'
            ? 'select count(*) from public.profiles'
            : `select case when count(*)=1 and bool_and(id=${lit(accounts[identity].id)}) then 1 else 0 end from public.profiles`,
        ),
        actor === 'anonymous' ? 'false' : 'n = 1',
        actor === 'anonymous' ? ['42501'] : [],
      ),
    );
    const expected = Object.entries(households)
      .filter(([label]) => reads(actor, label))
      .map(([, id]) => id);
    const join = `select case when coalesce(array_agg(distinct v.household_id order by v.household_id),'{}'::uuid[])=array[${expected.map(lit).join(',')}]::uuid[] then 1 else 0 end from public.account_inventory v join public.logical_accounts a on v.id=a.id`;
    remaining.push(
      probe(
        actor + ' joins and invoker view',
        actor,
        countQuery(join),
        actor === 'anonymous' ? 'false' : 'n = 1',
        actor === 'anonymous' ? ['42501'] : [],
      ),
    );
    for (const [label, id] of Object.entries(households)) {
      const fn = reads(actor, label) ? 'export_household' : 'read_household';
      remaining.push(
        probe(
          `${actor} read/export RPC → ${label}`,
          actor,
          countQuery(
            `select count(*) from (select public.${fn}(${lit(id)}) value) s where value->'state'->'household'->>'id'=${lit(id)}`,
          ),
          owns(actor, label) ? 'n = 1' : 'false',
          owns(actor, label) ? [] : ['42501'],
        ),
      );
    }
  }
  await batch(remaining);
  const passed = Number((await pg.query('select count(*) n from probe_results')).rows[0].n);
  if (passed !== 2539) throw Error('Incomplete hosted RLS matrix.');
  await pg.query('rollback');
  writeFileSync(
    'docs/MILESTONE_2_HOSTED_RLS.json',
    JSON.stringify(
      {
        projectRef: HOSTED_REF,
        checkedAt: new Date().toISOString(),
        passed,
        failed: 0,
        crudChecks: 2496,
        resources: 26,
        households: 3,
        actors: 8,
        tlsVerified: true,
        transactionRolledBack: true,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`PASS: ${passed} hosted RLS assertions; all sentinel changes rolled back.`);
} catch (error) {
  await pg.query('rollback').catch(() => {});
  console.error(error instanceof Error ? error.message : 'Hosted RLS verification failed');
  process.exitCode = 1;
} finally {
  await pg.end();
}
