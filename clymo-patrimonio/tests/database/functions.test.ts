import { beforeAll, afterAll, it, describe, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { connection, accounts, households, signedIn } from '../support/database';
import { householdFixture } from '../../data/households';
import { calculateSnapshot } from '../../domain/engine';
const pg = connection(),
  claims: Record<string, object> = {};
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
beforeAll(async () => {
  for (const a of actors.filter((a) => a !== 'anonymous' && a !== 'revokedA'))
    claims[a] = (await signedIn(a)).claims;
  await pg.connect();
  await pg.query('begin');
});
afterAll(async () => {
  await pg.query('rollback');
  await pg.end();
});
async function asActor(actor: string, fn: () => Promise<unknown>) {
  await pg.query('savepoint function_test');
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
    await pg.query('rollback to savepoint function_test');
    await pg.query('release savepoint function_test');
  }
}
async function denied(fn: () => Promise<unknown>) {
  let error: unknown;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  expect(error).toMatchObject({ code: '42501' });
}
for (const [label, h] of Object.entries(households))
  for (const actor of actors) {
    const owner = actor === 'owner' + label,
      member = owner || actor === 'helper' + label;
    const s = () =>
      householdFixture(
        h,
        `Probe ${label}`,
        accounts['owner' + label].id,
        label === 'A' ? 'canonical' : label === 'B' ? 'north' : 'empty',
      );
    describe(`${actor} database functions → ${label}`, () => {
      for (const fn of ['read_household', 'export_household'])
        it(fn, () =>
          asActor(actor, async () => {
            const query = () => pg.query(`select public.${fn}($1) data`, [h]);
            if (fn === 'read_household' ? member : owner)
              expect((await query()).rows[0].data).toBeTruthy();
            else await denied(query);
          }),
        );
      it('private.has_role returns only a scoped boolean', () =>
        asActor(actor, async () => {
          if (actor === 'anonymous')
            return denied(() => pg.query('select private.has_role($1)', [h]));
          expect(
            (
              await pg.query('select private.has_role($1) member,private.has_role($1,true) owner', [
                h,
              ])
            ).rows[0],
          ).toEqual({ member, owner });
        }));
      for (const fn of [
        'save_household',
        'reset_household',
        'set_membership',
        'delete_household',
        'create_household',
        'record_audit',
      ])
        it(fn, () =>
          asActor(actor, async () => {
            const state = s();
            const execute = () => {
              switch (fn) {
                case 'save_household':
                  return pg.query("select public.save_household($1,-1,'{}','{}',$2,'settings')", [
                    h,
                    randomUUID(),
                  ]);
                case 'reset_household':
                  return pg.query('select public.reset_household($1,$2,$3)', [
                    h,
                    state,
                    calculateSnapshot(state),
                  ]);
                case 'set_membership':
                  return pg.query("select public.set_membership($1,$2,'helper',true)", [
                    h,
                    accounts.outsider.id,
                  ]);
                case 'delete_household':
                  return pg.query('select public.delete_household($1,$2)', [
                    h,
                    label === 'A'
                      ? 'Familia Demo Clymo'
                      : label === 'B'
                        ? 'Familia Norte Demo'
                        : 'Hogar Vacío Demo',
                  ]);
                case 'create_household':
                  return pg.query('select public.create_household($1,$2,$3,$4)', [
                    h,
                    state,
                    calculateSnapshot(state),
                    label === 'A' ? 'canonical' : label === 'B' ? 'north' : 'empty',
                  ]);
                default:
                  return pg.query("select public.record_audit($1,'export_json')", [h]);
              }
            };
            if (!owner) return denied(execute);
            if (fn === 'save_household') {
              let error: unknown;
              try {
                await execute();
              } catch (e) {
                error = e;
              }
              expect(error).toMatchObject({ code: 'PT409' });
            } else await execute();
          }),
        );
    });
  }
for (const actor of actors) {
  it(`${actor} cannot call internal unguarded mutators`, () =>
    asActor(actor, () =>
      denied(() => pg.query('select private.clear_financial_rows($1)', [households.A])),
    ));
  it(`${actor} cannot bypass private receipt isolation`, () =>
    asActor(actor, () => denied(() => pg.query('select * from private.deletion_receipts'))));
  it(`${actor} account deletion can remove only its own memberships`, () =>
    asActor(actor, async () => {
      if (actor === 'anonymous')
        return denied(() => pg.query('select public.prepare_account_deletion()'));
      if (
        actor === 'revokedA' ||
        actor === 'helperA' ||
        actor === 'helperB' ||
        actor === 'outsider'
      ) {
        await pg.query('select public.prepare_account_deletion()');
        return;
      }
      let error: unknown;
      try {
        await pg.query('select public.prepare_account_deletion()');
      } catch (e) {
        error = e;
      }
      expect(error).toMatchObject({ code: '23514' });
    }));
}
