import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ENTITIES } from '../../database/entities';
import { householdFixture } from '../../data/households';
import { applyCommand } from '../../domain/commands';
import { calculateSnapshot } from '../../domain/engine';
import { accounts, households, connection, signedIn } from '../support/database';
const pg = connection();
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
const actors = [
  'anonymous',
  'ownerA',
  'helperA',
  'ownerB',
  'helperB',
  'ownerC',
  'outsider',
  'revokedA',
] as const;
const claims: Record<string, object> = {};
const rows: Record<string, Record<string, unknown>> = {};
const columns: Record<string, string[]> = {};
const owns = (actor: string, h: string) => actor === `owner${h}`;
const reads = (actor: string, h: string) => owns(actor, h) || actor === `helper${h}`;
const scope = (table: string) => (table === 'households' ? 'id' : 'household_id');
const q = (name: string) => '"' + name.replaceAll('"', '""') + '"';
async function asActor<T>(actor: string, fn: () => Promise<T>) {
  await pg.query('savepoint actor_test');
  try {
    if (actor === 'revokedA')
      await pg.query(
        'update public.household_memberships set active=false where household_id=$1 and user_id=$2',
        [households.A, accounts.helperA.id],
      );
    await pg.query(`set local role ${actor === 'anonymous' ? 'anon' : 'authenticated'}`);
    await pg.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(claims[actor === 'revokedA' ? 'helperA' : actor] ?? {}),
    ]);
    return await fn();
  } finally {
    await pg.query('rollback to savepoint actor_test');
    await pg.query('release savepoint actor_test');
  }
}
async function denied(fn: () => Promise<unknown>) {
  let error: unknown;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  expect(error, 'request must be denied by PostgreSQL privileges/RLS').toMatchObject({
    code: '42501',
  });
}
beforeAll(async () => {
  for (const key of actors.filter((a) => a !== 'anonymous' && a !== 'revokedA'))
    claims[key] = (await signedIn(key)).claims;
  await pg.connect();
  await pg.query('begin');
  // Populate every table for each target inside this rollback-only test transaction.
  // Even Household C has sentinel rows here, so isolation assertions cannot pass vacuously.
  for (const [label, h] of Object.entries(households)) {
    const owner = `owner${label}`;
    await pg.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(claims[owner]),
    ]);
    let s = householdFixture(h, `Isolation Sentinel ${label}`, accounts[owner].id, 'canonical');
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
    await pg.query('select public.reset_household($1,$2,$3)', [h, s, calculateSnapshot(s)]);
    await pg.query(
      'insert into public.command_receipts(id,household_id,revision) values($1,$2,1)',
      [randomUUID(), h],
    );
    for (const t of tables) {
      rows[t + label] = (
        await pg.query(`select * from public.${q(t)} where ${scope(t)}=$1 limit 1`, [h])
      ).rows[0];
      expect(rows[t + label], `nonempty ${t} target ${label}`).toBeTruthy();
    }
  }
  for (const t of tables)
    columns[t] = (
      await pg.query(
        "select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER' and is_identity='NO' order by ordinal_position",
        [t],
      )
    ).rows.map((r) => r.column_name);
});
afterAll(async () => {
  await pg.query('rollback');
  await pg.end();
});
describe('real PostgreSQL RLS: every household resource, actor, target and CRUD verb', () => {
  for (const t of tables)
    for (const [label, h] of Object.entries(households))
      for (const actor of actors) {
        const name = `${t} / ${actor} → ${label}`;
        it(`${name} SELECT`, async () =>
          asActor(actor, async () => {
            const query = () => pg.query(`select * from public.${q(t)} where ${scope(t)}=$1`, [h]);
            if (actor === 'anonymous') return denied(query);
            const r = await query();
            expect(r.rows.length > 0).toBe(reads(actor, label));
            expect(r.rows.every((row) => row[scope(t)] === h)).toBe(true);
          }));
        it(`${name} INSERT`, async () => {
          // Positive owner appends are verified separately with new valid domain identities.
          // This matrix checks ordinary grants/RLS; protected lifecycle/history tables reject owners too.
          if (owns(actor, label) && ENTITIES.some(([, table]) => table === t)) {
            return asActor(actor, async () => {
              const {
                rows: [policy],
              } = await pg.query('select private.has_role($1,true) allowed', [h]);
              expect(policy.allowed).toBe(true);
              const base = rows[t + label];
              const payload = { ...(base.payload as object) } as Record<string, unknown>;
              const id = 'probe-' + randomUUID();
              payload.id = id;
              if ('actorId' in payload) payload.actorId = accounts[actor].id;
              // For naturally unique exposure/event tables a duplicate must fail with the specific
              // uniqueness constraint, proving RLS admitted this owner before enforcing domain integrity.
              const clone: Record<string, unknown> = { ...base, domain_key: id, payload };
              clone.id = (await pg.query('select private.entity_id($1,$2) id', [h, id])).rows[0].id;
              const cols = columns[t];
              try {
                await pg.query(
                  `insert into public.${q(t)} (${cols.map(q)}) values(${cols.map((_, i) => '$' + (i + 1))})`,
                  cols.map((c) => clone[c as keyof typeof clone]),
                );
              } catch (e) {
                expect(['23505']).toContain((e as { code: string }).code);
              }
            });
          }
          return asActor(actor, () =>
            denied(() => {
              const cols = columns[t];
              return pg.query(
                `insert into public.${q(t)} (${cols.map(q)}) values(${cols.map((_, i) => '$' + (i + 1))})`,
                cols.map((c) => rows[t + label][c]),
              );
            }),
          );
        });
        for (const verb of ['UPDATE', 'DELETE'])
          it(`${name} ${verb}`, async () =>
            asActor(actor, async () => {
              const query = () =>
                pg.query(
                  verb === 'UPDATE'
                    ? `update public.${q(t)} set ${scope(t)}=$2 where ${scope(t)}=$1 returning id`
                    : `delete from public.${q(t)} where ${scope(t)}=$1 returning id`,
                  verb === 'UPDATE' ? [h, label === 'A' ? households.B : households.A] : [h],
                );
              if (actor === 'anonymous' || !ENTITIES.some(([, table]) => table === t))
                return denied(query);
              expect((await query()).rowCount).toBe(0);
            }));
      }
});
describe('security catalog and relational access paths', () => {
  it('enables RLS on every public application table and private deletion receipts', async () => {
    const r = await pg.query(
      "select n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','private')",
    );
    expect(r.rows.length).toBe(tables.length + 2);
    expect(r.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it('uses no floating point columns for financial data', async () => {
    const r = await pg.query(
      "select column_name from information_schema.columns where table_schema='public' and data_type in ('real','double precision')",
    );
    expect(r.rows).toEqual([]);
  });
  it('pins every application function search path and denies PUBLIC execution', async () => {
    const r = await pg.query(
      "select p.proname,p.proconfig,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') broad from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.prokind='f'",
    );
    expect(r.rows.every((r) => r.proconfig?.includes('search_path=""') && !r.broad)).toBe(true);
  });
  for (const actor of actors) {
    it(`${actor} profile scope`, () =>
      asActor(actor, async () => {
        if (actor === 'anonymous') return denied(() => pg.query('select * from public.profiles'));
        const r = await pg.query('select id from public.profiles');
        expect(r.rows.map((r) => r.id)).toEqual([
          accounts[actor === 'revokedA' ? 'helperA' : actor].id,
        ]);
      }));
    it(`${actor} joins and invoker view`, () =>
      asActor(actor, async () => {
        if (actor === 'anonymous')
          return denied(() => pg.query('select * from public.account_inventory'));
        const r = await pg.query(
          'select v.household_id from public.account_inventory v join public.logical_accounts a on v.id=a.id',
        );
        expect([...new Set(r.rows.map((r) => r.household_id))]).toEqual(
          Object.entries(households)
            .filter(([h]) => reads(actor, h))
            .map(([, id]) => id),
        );
      }));
    for (const [label, h] of Object.entries(households)) {
      it(`${actor} direct read/export RPC → ${label}`, () =>
        asActor(actor, async () => {
          const fn = reads(actor, label) ? 'export_household' : 'read_household';
          if (!owns(actor, label)) return denied(() => pg.query(`select public.${fn}($1)`, [h]));
          const r = await pg.query('select public.export_household($1) data', [h]);
          expect(r.rows[0].data.state.household.id).toBe(h);
          for (const other of Object.values(households).filter((id) => id !== h))
            expect(JSON.stringify(r.rows)).not.toContain(other);
        }));
    }
  }
});
