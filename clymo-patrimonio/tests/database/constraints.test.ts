import { beforeAll, afterAll, it, expect, describe } from 'vitest';
import { randomUUID } from 'node:crypto';
import { connection, accounts, households, signedIn, client } from '../support/database';
import { householdFixture } from '../../data/households';
import { calculateSnapshot } from '../../domain/engine';
import { validateState, outstandingFromEvents } from '../../domain/validation';
const pg = connection();
let ownerClaims: object;
beforeAll(async () => {
  ownerClaims = (await signedIn('ownerA')).claims;
  await pg.connect();
  await pg.query('begin');
  await pg.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(ownerClaims)]);
});
afterAll(async () => {
  await pg.query('rollback');
  await pg.end();
});
async function isolated(fn: () => Promise<unknown>) {
  await pg.query('savepoint constraint_test');
  try {
    return await fn();
  } finally {
    await pg.query('rollback to savepoint constraint_test');
    await pg.query('release savepoint constraint_test');
  }
}
async function rejected(fn: () => Promise<unknown>, code = '23514') {
  let caught: unknown;
  try {
    await fn();
    await pg.query('set constraints all immediate');
  } catch (e) {
    caught = e;
  }
  expect(caught).toMatchObject({ code });
}
async function insert(t: string, original: string, changes: Record<string, unknown> = {}) {
  const {
    rows: [r],
  } = await pg.query(`select payload from public.${t} where household_id=$1 and domain_key=$2`, [
    households.A,
    original,
  ]);
  const id = 'probe-' + randomUUID(),
    p = { ...r.payload, id, ...changes };
  return pg.query(
    `insert into public.${t}(id,household_id,domain_key,payload${'effectiveDate' in p ? ',effective_at,recorded_at' : ''}) values(private.entity_id($1,$2),$1,$2,$3${'effectiveDate' in p ? ',$4,$5' : ''}) returning *`,
    [
      households.A,
      id,
      p,
      ...('effectiveDate' in p ? [p.effectiveDate + 'T00:00:00Z', p.recordedAt] : []),
    ],
  );
}
describe('real database constraints and exact values', () => {
  it('stores decimal precision beyond JavaScript safe integers without rounding', () =>
    isolated(async () => {
      const n = '123456789012345678901234567890.12345678';
      const r = await insert('balance_observations', 'balance-checking', { amount: n });
      expect(r.rows[0].financial_value).toBe(n);
    }));
  for (const [label, table, key, changes, code] of [
    ['negative money', 'balance_observations', 'balance-checking', { amount: '-1' }, '23514'],
    [
      'too many money decimals',
      'balance_observations',
      'balance-checking',
      { amount: '1.000000001' },
      '23514',
    ],
    ['invalid currency', 'balance_observations', 'balance-checking', { currency: 'BTC' }, '23514'],
    [
      'source binding account mismatch',
      'balance_observations',
      'balance-checking',
      { bindingId: 'binding-joint' },
      '23514',
    ],
    [
      'missing account FK',
      'balance_observations',
      'balance-checking',
      { accountId: 'missing', bindingId: 'missing' },
      '23503',
    ],
    [
      'missing source FK',
      'balance_observations',
      'balance-checking',
      { bindingId: 'missing' },
      '23503',
    ],
    [
      'household payload spoof',
      'balance_observations',
      'balance-checking',
      { householdId: households.B },
      '23514',
    ],
    [
      'ownership above 100',
      'ownership_decisions',
      'ownership-checking',
      { householdPercentage: '100.00001' },
      '23514',
    ],
    [
      'negative ownership',
      'ownership_decisions',
      'ownership-checking',
      { householdPercentage: '-1' },
      '23514',
    ],
    [
      'invalid ownership status',
      'ownership_decisions',
      'ownership-checking',
      { status: 'anything' },
      '23514',
    ],
    [
      'spoofed author',
      'ownership_decisions',
      'ownership-checking',
      { actorId: accounts.helperA.id },
      '42501',
    ],
    ['invalid account side', 'logical_accounts', 'checking', { side: 'equity' }, '23514'],
    [
      'invalid valuation basis',
      'logical_accounts',
      'checking',
      { valuationBasis: 'floating' },
      '23514',
    ],
    [
      'real account number rejected',
      'logical_accounts',
      'checking',
      { maskedIdentifier: '123456789' },
      '23514',
    ],
    ['zero FX rejected', 'exchange_rates', 'fx-usd', { rate: '0' }, '23514'],
    ['negative quantity', 'position_observations', 'position-etf', { quantity: '-1' }, '23514'],
    [
      'overpayment',
      'obligation_events',
      'event-initial-maria',
      { kind: 'repayment', amount: '3000001' },
      '23514',
    ],
    [
      'out of order repayment',
      'obligation_events',
      'event-initial-maria',
      { kind: 'repayment', amount: '1', effectiveDate: '2020-01-01' },
      '23514',
    ],
    ['duplicate initial capital', 'obligation_events', 'event-initial-maria', {}, '23505'],
    ['duplicate exposure candidate', 'duplicate_candidates', 'duplicate-broker', {}, '23505'],
  ] as const)
    it(label, () => isolated(() => rejected(() => insert(table, key, changes), code)));
  it('rejects invalid membership roles', () =>
    isolated(() =>
      rejected(() =>
        pg.query(
          "insert into public.household_memberships(household_id,user_id,display_name,role) values($1,$2,'Invalid Demo','admin')",
          [households.A, accounts.outsider.id],
        ),
      ),
    ));
  it('enforces exact timestamps from original evidence', () =>
    isolated(() =>
      rejected(async () => {
        const r = await pg.query(
          "select * from public.balance_observations where household_id=$1 and domain_key='balance-checking'",
          [households.A],
        );
        const p = { ...r.rows[0].payload, id: 'timestamp-probe' };
        return pg.query(
          "insert into public.balance_observations(id,household_id,domain_key,payload,effective_at,recorded_at) values(private.entity_id($1,'timestamp-probe'),$1,'timestamp-probe',$2,now(),now())",
          [households.A, p],
        );
      }),
    ));
  it('rejects rewriting append-only evidence even with elevated maintenance role', () =>
    isolated(() =>
      rejected(
        () =>
          pg.query('update public.balance_observations set payload=payload where household_id=$1', [
            households.A,
          ]),
        '42501',
      ),
    ));
  it('calculates remaining receivable from append-only events', () =>
    isolated(async () => {
      await insert('obligation_events', 'event-initial-maria', {
        kind: 'repayment',
        amount: '500000',
      });
      const r = await pg.query(
        'select payload from public.obligation_events where household_id=$1 order by ordinal',
        [households.A],
      );
      expect(outstandingFromEvents(r.rows.map((r) => r.payload))).toEqual({
        amount: '2500000',
        disputed: false,
      });
    }));
  it('rejects incoherent snapshot totals', () =>
    isolated(() =>
      rejected(() =>
        pg.query(
          'insert into public.net_worth_snapshots(household_id,run_id,assets,liabilities,net_worth,liquid_cash) values($1,$2,10,2,9,0)',
          [households.A, randomUUID()],
        ),
      ),
    ));
  it('rejects two valuation components for the same account and run', () =>
    isolated(() =>
      rejected(
        () =>
          pg.query(
            'insert into public.valuation_components(household_id,run_id,account_id,original_amount,reporting_value,included,side,payload) select household_id,run_id,account_id,original_amount,reporting_value,included,side,payload from public.valuation_components where household_id=$1 limit 1',
            [households.A],
          ),
        '23505',
      ),
    ));
  it('last owner cannot be revoked or demoted', () =>
    isolated(() =>
      rejected(() =>
        pg.query("select public.set_membership($1,$2,'helper',true)", [
          households.A,
          accounts.ownerA.id,
        ]),
      ),
    ));
  it('last owner cannot delete their account leaving an orphan', () =>
    isolated(() => rejected(() => pg.query('select public.prepare_account_deletion()'))));
  it('requires a recent session for deletion', () =>
    isolated(async () => {
      await pg.query(
        "update auth.sessions set created_at=now()-interval '11 minutes' where id=$1",
        [(ownerClaims as { session_id: string }).session_id],
      );
      await rejected(
        () => pg.query("select public.delete_household($1,'Familia Demo Clymo')", [households.A]),
        '42501',
      );
    }));
  it('requires typed household name', () =>
    isolated(() =>
      rejected(() => pg.query("select public.delete_household($1,'WRONG')", [households.A])),
    ));
  it('transactional household deletion removes every financial, membership, review and audit row', () =>
    isolated(async () => {
      const previousReceipts = Number(
        (
          await pg.query(
            "select count(*) count from private.deletion_receipts where actor_id=$1 and kind='household'",
            [accounts.ownerA.id],
          )
        ).rows[0].count,
      );
      await pg.query("select public.delete_household($1,'Familia Demo Clymo')", [households.A]);
      const tables = await pg.query(
        "select table_name from information_schema.columns where table_schema='public' and column_name='household_id'",
      );
      for (const { table_name: t } of tables.rows)
        expect(
          (
            await pg.query(`select count(*) count from public.${t} where household_id=$1`, [
              households.A,
            ])
          ).rows[0].count,
        ).toBe('0');
      expect(
        (await pg.query('select id from public.households where id=$1', [households.A])).rowCount,
      ).toBe(0);
      const receipts = (
        await pg.query(
          "select kind,phase from private.deletion_receipts where actor_id=$1 and kind='household'",
          [accounts.ownerA.id],
        )
      ).rows;
      expect(receipts).toHaveLength(previousReceipts + 1);
      expect(receipts.every((r) => r.kind === 'household' && r.phase === 'completed')).toBe(true);
    }));
  it('owner departure preserves another owner and historical decision authors', () =>
    isolated(async () => {
      await pg.query("select public.set_membership($1,$2,'owner',true)", [
        households.A,
        accounts.outsider.id,
      ]);
      await pg.query('select public.prepare_account_deletion()');
      const other = (await signedIn('outsider')).claims;
      await pg.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(other)]);
      const r = await pg.query('select public.read_household($1) state', [households.A]);
      expect(calculateSnapshot(validateState(r.rows[0].state)).netWorth).toBe('52540000');
    }));
  it('seeding an existing owned household is idempotent and cannot override it', () =>
    isolated(async () => {
      const s = householdFixture(households.A, 'Override Attempt', accounts.ownerA.id, 'empty');
      const before = (
        await pg.query('select revision,name from public.households where id=$1', [households.A])
      ).rows;
      await pg.query("select public.create_household($1,$2,$3,'empty')", [
        households.A,
        s,
        calculateSnapshot(s),
      ]);
      expect(
        (await pg.query('select revision,name from public.households where id=$1', [households.A]))
          .rows,
      ).toEqual(before);
    }));
  it('rejects a stale revision and rolls back the command', () =>
    isolated(() =>
      rejected(
        () =>
          pg.query("select public.save_household($1,-1,'{}','{}',$2,'settings')", [
            households.A,
            randomUUID(),
          ]),
        '40001',
      ),
    ));
  it('revoked session JWT loses access at the next database request', () =>
    isolated(async () => {
      await pg.query('delete from auth.sessions where id=$1', [
        (ownerClaims as { session_id: string }).session_id,
      ]);
      await rejected(() => pg.query('select public.read_household($1)', [households.A]), '42501');
    }));
});
it('closed registration is enforced by real Supabase Auth', async () => {
  const { data, error } = await client().auth.signUp({
    email: 'not-invited@clymo.test',
    password: randomUUID() + randomUUID(),
  });
  expect(data.session).toBeNull();
  expect(error?.code).toBe('signup_disabled');
});
