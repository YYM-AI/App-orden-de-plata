import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accounts, households, signedIn, client } from '../support/database';
import { SupabaseRepository } from '../../persistence/supabase-repository';
import { householdFixture } from '../../data/households';
import { calculateSnapshot } from '../../domain/engine';
import { applyCommand, type Command } from '../../domain/commands';
let db: SupabaseClient, helper: SupabaseClient, other: SupabaseClient, repo: SupabaseRepository;
const fixture = () =>
  householdFixture(households.A, 'Familia Demo Clymo', accounts.ownerA.id, 'canonical');
beforeAll(async () => {
  db = (await signedIn('ownerA')).db;
  helper = (await signedIn('helperA')).db;
  other = (await signedIn('ownerB')).db;
  repo = new SupabaseRepository(db, households.A);
});
beforeEach(async () => {
  await repo.reset(fixture());
});
afterAll(async () => {
  if (repo) await repo.reset(fixture());
});
async function save(command: Command) {
  const current = (await repo.load())!;
  const id = randomUUID();
  const next = applyCommand(current, command, {
    id,
    actorId: accounts.ownerA.id,
    recordedAt: new Date().toISOString(),
  });
  await new SupabaseRepository(db, households.A, id, command.type).save(next, current.revision);
  return { current, next, id };
}
it('restores the exact canonical household through real PostgREST', async () => {
  expect(calculateSnapshot((await repo.load())!)).toMatchObject({
    assets: '60240000',
    liabilities: '7700000',
    netWorth: '52540000',
    liquidCash: '25250000',
  });
});
it('persists a new manual asset across two authenticated clients', async () => {
  await save({
    type: 'add_manual',
    name: 'Ahorro persistente Demo',
    amount: '100000.12345678',
    currency: 'CLP',
    percentage: '100',
    effectiveDate: '2026-09-04',
    side: 'asset',
    category: 'cash',
  });
  const second = (await signedIn('ownerA')).db;
  expect(
    calculateSnapshot((await new SupabaseRepository(second, households.A).load())!).assets,
  ).toBe('60340000.12345678');
});
it('append-only observations preserve original evidence', async () => {
  await save({
    type: 'observe',
    accountId: 'checking',
    amount: '14000000',
    effectiveDate: '2026-09-04',
    reason: 'Actualización ficticia',
  });
  const s = (await repo.load())!;
  expect(s.balances.filter((b) => b.accountId === 'checking').map((b) => b.amount)).toContain(
    '12000000',
  );
  expect(calculateSnapshot(s).netWorth).toBe('54540000');
});
it('partial repayment updates cash atomically and conserves net worth', async () => {
  await save({
    type: 'obligation_event',
    obligationId: 'obligation-maria',
    kind: 'repayment',
    amount: '500000',
    effectiveDate: '2026-09-04',
    reason: 'Pago ficticio',
    cashAccountId: 'checking',
  });
  expect(calculateSnapshot((await repo.load())!)).toMatchObject({
    netWorth: '52540000',
    liquidCash: '25750000',
  });
});
it('duplicate resolution preserves 13 logical accounts and the exact total', async () => {
  await save({
    type: 'review',
    reviewId: 'review-duplicate',
    action: 'bind',
    effectiveDate: '2026-09-04',
    reason: 'Misma cuenta ficticia',
  });
  const s = (await repo.load())!;
  expect(s.accounts).toHaveLength(13);
  expect(s.resolutions).toHaveLength(1);
  expect(calculateSnapshot(s).netWorth).toBe('52540000');
});
it('reporting currency changes persist snapshots without altering originals', async () => {
  await save({ type: 'settings', reportingCurrency: 'USD' });
  const s = (await repo.load())!;
  expect(s.balances.find((b) => b.id === 'balance-checking')?.amount).toBe('12000000');
  expect(calculateSnapshot(s).reportingCurrency).toBe('USD');
});
it('concurrent revisions and duplicate command receipts prevent lost or repeated writes', async () => {
  const { current, next, id } = await save({ type: 'settings', reportingCurrency: 'USD' });
  await new SupabaseRepository(db, households.A, id, 'settings').save(next, current.revision);
  expect((await repo.load())!.revision).toBe(current.revision + 1);
  await expect(
    new SupabaseRepository(db, households.A, randomUUID()).save(next, current.revision),
  ).rejects.toMatchObject({ code: '40001' });
});
it('helper sees the same balances but cannot save or reset', async () => {
  const r = new SupabaseRepository(helper, households.A);
  expect(calculateSnapshot((await r.load())!).netWorth).toBe('52540000');
  await expect(r.save(fixture(), 0)).rejects.toMatchObject({ code: '42501' });
  await expect(r.reset(fixture())).rejects.toMatchObject({ code: '42501' });
});
it('foreign, anonymous and unapproved identities cannot read household state', async () => {
  const unapproved = (await signedIn('unapproved')).db;
  for (const d of [other, client(), unapproved])
    await expect(new SupabaseRepository(d, households.A).load()).rejects.toMatchObject({
      code: '42501',
    });
});
it('owner export includes all normalized collections, history and only the target household', async () => {
  const { data, error } = await db.rpc('export_household', { p_household: households.A });
  expect(error).toBeNull();
  expect(data.state.household.id).toBe(households.A);
  expect(data.history.net_worth_snapshots[0].net_worth).toBe('52540000.00000000');
  expect(data.state.balances).toHaveLength(15);
  expect(JSON.stringify(data)).not.toMatch(
    /Familia Norte|Banco Norte|password|access_token|service_role/,
  );
  for (const d of [helper, other, client()])
    expect((await d.rpc('export_household', { p_household: households.A })).error?.code).toBe(
      '42501',
    );
});
it('live helper revocation blocks the already-issued JWT and can be explicitly reauthorized', async () => {
  try {
    expect(
      (
        await db.rpc('set_membership', {
          p_household: households.A,
          p_user: accounts.helperA.id,
          p_role: 'helper',
          p_active: false,
        })
      ).error,
    ).toBeNull();
    await expect(new SupabaseRepository(helper, households.A).load()).rejects.toMatchObject({
      code: '42501',
    });
  } finally {
    await db.rpc('set_membership', {
      p_household: households.A,
      p_user: accounts.helperA.id,
      p_role: 'helper',
      p_active: true,
    });
  }
});
it('persists dynamically detected review tasks before their resolution foreign key', async () => {
  await save({
    type: 'ownership',
    accountId: 'checking',
    percentage: '100',
    status: 'disputed',
    effectiveDate: '2026-09-04',
    reason: 'Propiedad ficticia en revisión',
  });
  await save({
    type: 'review',
    reviewId: 'auto-checking',
    action: 'acknowledge',
    effectiveDate: '2026-09-04',
    reason: 'Mantener excluida hasta confirmar',
  });
  const state = (await repo.load())!;
  expect(state.reviewTasks.some((t) => t.id === 'auto-checking')).toBe(true);
  expect(state.resolutions.at(-1)?.reviewId).toBe('auto-checking');
});
it('real PostgREST rejects an expired signed JWT without returning financial data', async () => {
  const { expiredSession } = await import('../support/expired-session');
  const expired = expiredSession(accounts.ownerA.id);
  const r = await fetch(process.env.SUPABASE_URL + '/rest/v1/logical_accounts?select=id', {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY!,
      Authorization: 'Bearer ' + expired.access_token,
    },
  });
  expect(r.status).toBe(401);
  const body = await r.json();
  expect(body.message).toMatch(/expired/i);
  expect(JSON.stringify(body)).not.toContain(households.A);
});
