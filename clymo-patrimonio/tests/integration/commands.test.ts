import { describe, it, expect } from 'vitest';
import { createFixture } from '../../data/fixture';
import { calculateSnapshot, bindingTarget, reviewQueue } from '../../domain/engine';
import { outstandingFromEvents } from '../../domain/validation';
import { command, manual } from '../helpers';
const repayment = {
  type: 'obligation_event' as const,
  obligationId: 'obligation-maria',
  kind: 'repayment' as const,
  amount: '500000',
  effectiveDate: '2026-09-04',
  reason: 'Pago parcial ficticio',
};
const review = {
  type: 'review' as const,
  reviewId: 'review-duplicate',
  action: 'bind' as const,
  effectiveDate: '2026-09-04',
  reason: 'Misma cuenta ficticia confirmada.',
};
describe('commands, records and resulting valuation', () => {
  it('adds an independent manual asset and liability with provenance and ownership', () => {
    let s = command(createFixture(), manual(), 'asset');
    s = command(s, manual({ side: 'liability', category: 'loan', amount: '50000' }), 'liability');
    expect(calculateSnapshot(s).netWorth).toBe('52590000');
    expect(s.accounts).toHaveLength(15);
    expect(s.ownershipDecisions).toHaveLength(15);
  });
  it('appends observations without mutating old evidence or the input state', () => {
    const before = createFixture();
    const copy = structuredClone(before);
    const after = command(before, {
      type: 'observe',
      accountId: 'checking',
      amount: '14000000',
      effectiveDate: '2026-09-04',
      reason: 'Nuevo saldo de prueba',
    });
    expect(before).toEqual(copy);
    expect(after.balances.slice(0, before.balances.length)).toEqual(before.balances);
    expect(after.balances).toHaveLength(before.balances.length + 1);
    expect(calculateSnapshot(after).netWorth).toBe('54540000');
  });
  it('updates stale source through a new observation and resolves its review', () => {
    const s = command(createFixture(), {
      type: 'observe',
      accountId: 'old',
      amount: '2000000',
      effectiveDate: '2026-09-04',
      reason: 'Saldo renovado ficticio',
    });
    expect(calculateSnapshot(s).netWorth).toBe('54540000');
    expect(reviewQueue(s).find((r) => r.id === 'review-old')!.status).toBe('resolved');
    expect(s.balances.find((b) => b.id === 'balance-old')!.effectiveDate).toBe('2026-05-01');
  });
  it('changes ownership through a new decision', () => {
    const s = command(createFixture(), {
      type: 'ownership',
      accountId: 'joint',
      percentage: '25',
      status: 'confirmed',
      effectiveDate: '2026-09-04',
      reason: 'Participación ficticia corregida',
    });
    expect(s.ownershipDecisions.find((d) => d.id === 'ownership-joint')!.householdPercentage).toBe(
      '50',
    );
    expect(calculateSnapshot(s).netWorth).toBe('48790000');
  });
  it('partial repayment derives outstanding 2.5 million, retains initial principal', () => {
    const s = command(createFixture(), repayment);
    expect(outstandingFromEvents(s.obligationEvents).amount).toBe('2500000');
    expect(s.obligationEvents[0].amount).toBe('3000000');
    expect(s.obligationEvents).toHaveLength(2);
    expect(calculateSnapshot(s).netWorth).toBe('52040000');
  });
  it('linked cash repayment changes composition without creating net worth', () => {
    const s = command(createFixture(), { ...repayment, cashAccountId: 'checking' });
    const snap = calculateSnapshot(s);
    expect(snap.netWorth).toBe('52540000');
    expect(snap.assets).toBe('60240000');
    expect(snap.liquidCash).toBe('25750000');
    expect(snap.components.find((c) => c.accountId === 'receivable')!.originalAmount).toBe(
      '2500000',
    );
    expect(snap.components.find((c) => c.accountId === 'checking')!.originalAmount).toBe(
      '12500000',
    );
    expect(s.obligationEvents[1].linkedCashObservationId).toBeTruthy();
  });
  it('payable repayment reduces cash and liability equally', () => {
    let s = command(
      createFixture(),
      manual({ category: 'obligation', side: 'liability', amount: '1000000' }),
      'payable',
    );
    const before = calculateSnapshot(s).netWorth;
    s = command(
      s,
      { ...repayment, obligationId: s.obligations.at(-1)!.id, cashAccountId: 'checking' },
      'pay-payable',
    );
    expect(calculateSnapshot(s).netWorth).toBe(before);
    expect(calculateSnapshot(s).liabilities).toBe('8200000');
  });
  it('replayed commands are idempotent', () => {
    const a = command(createFixture(), { ...repayment, cashAccountId: 'checking' }, 'replay');
    const b = command(a, { ...repayment, cashAccountId: 'checking' }, 'replay');
    expect(b).toEqual(a);
  });
  it('rejects excessive repayment atomically', () => {
    const s = createFixture(),
      before = structuredClone(s);
    expect(() =>
      command(s, { ...repayment, amount: '4000000', cashAccountId: 'checking' }),
    ).toThrow('supera');
    expect(s).toEqual(before);
  });
  it('cannot directly overwrite an obligation balance', () =>
    expect(() =>
      command(createFixture(), {
        type: 'observe',
        accountId: 'receivable',
        amount: '10',
        effectiveDate: '2026-09-04',
        reason: 'Intento inválido',
      }),
    ).toThrow('eventos'));
  it('hiding obligations keeps the included balance and event history intact', () => {
    const s = command(createFixture(), { type: 'settings', obligationsVisible: false });
    expect(calculateSnapshot(s).netWorth).toBe('52540000');
    expect(s.obligationEvents).toHaveLength(1);
    expect(() => command(s, repayment, 'blocked')).toThrow('Activa');
  });
  it('explicitly excludes and re-includes a manual item through recorded decisions', () => {
    let s = command(
      createFixture(),
      {
        type: 'inclusion',
        accountId: 'cash',
        include: false,
        effectiveDate: '2026-09-04',
        reason: 'Exclusión ficticia',
      },
      'exclude',
    );
    expect(calculateSnapshot(s).netWorth).toBe('51540000');
    s = command(
      s,
      {
        type: 'inclusion',
        accountId: 'cash',
        include: true,
        effectiveDate: '2026-09-04',
        reason: 'Inclusión ficticia',
      },
      'include',
    );
    expect(calculateSnapshot(s).netWorth).toBe('52540000');
    expect(s.inclusionDecisions).toHaveLength(2);
  });
  it('inclusion cannot bypass unsupported property, ownership or missing FX rules', () => {
    expect(() =>
      command(createFixture(), {
        type: 'inclusion',
        accountId: 'home',
        include: true,
        effectiveDate: '2026-09-04',
        reason: 'Intento inválido',
      }),
    ).toThrow('elegibles');
    let s = command(createFixture(), manual({ currency: 'EUR' }), 'eur-manual');
    expect(() =>
      command(
        s,
        {
          type: 'inclusion',
          accountId: s.accounts.at(-1)!.id,
          include: true,
          effectiveDate: '2026-09-04',
          reason: 'Intento inválido',
        },
        'eur-include',
      ),
    ).toThrow('elegibles');
    s = command(
      createFixture(),
      {
        type: 'ownership',
        accountId: 'cash',
        percentage: '100',
        status: 'disputed',
        effectiveDate: '2026-09-04',
        reason: 'Disputa ficticia',
      },
      'dispute',
    );
    expect(() =>
      command(
        s,
        {
          type: 'inclusion',
          accountId: 'cash',
          include: true,
          effectiveDate: '2026-09-04',
          reason: 'Intento inválido',
        },
        'include',
      ),
    ).toThrow('elegibles');
  });
  it('binding duplicate and reversing it preserve totals and original evidence', () => {
    const before = createFixture();
    const bound = command(before, review, 'bind');
    expect(
      bindingTarget(
        bound,
        bound.sourceBindings.find((b) => b.id === 'binding-broker-copy')!,
      ),
    ).toBe('broker');
    expect(calculateSnapshot(bound).netWorth).toBe('52540000');
    expect(bound.balances).toEqual(before.balances);
    expect(reviewQueue(bound).find((r) => r.id === 'review-duplicate')!.status).toBe('resolved');
    const undone = command(bound, { ...review, action: 'undo_binding' }, 'undo');
    expect(
      bindingTarget(
        undone,
        undone.sourceBindings.find((b) => b.id === 'binding-broker-copy')!,
      ),
    ).toBeNull();
    expect(undone.resolutions).toHaveLength(2);
    expect(calculateSnapshot(undone).netWorth).toBe('52540000');
  });
  it('acknowledging missing rate keeps exclusion and truthful review status', () => {
    const s = command(createFixture(), {
      ...review,
      reviewId: 'review-eur',
      action: 'acknowledge',
    });
    expect(reviewQueue(s).find((r) => r.id === 'review-eur')!.status).toBe('acknowledged');
    expect(calculateSnapshot(s).components.find((c) => c.accountId === 'eur')!.included).toBe(
      false,
    );
  });
  it('similar balances never auto-merge distinct manually declared accounts', () => {
    let s = command(createFixture(), manual({ amount: '12000000' }), 'similar-one');
    s = command(s, manual({ amount: '12000000' }), 'similar-two');
    expect(s.accounts).toHaveLength(15);
    expect(calculateSnapshot(s).netWorth).toBe('76540000');
  });
  it.each(['forgiveness', 'write_off', 'adjustment'] as const)(
    'derives a reduction for %s without destroying evidence',
    (kind) => {
      const s = command(createFixture(), { ...repayment, kind, adjustmentDirection: 'decrease' });
      expect(outstandingFromEvents(s.obligationEvents).amount).toBe('2500000');
    },
  );
  it('settlement closes the derived balance; dispute blocks inclusion without changing principal', () => {
    const settled = command(createFixture(), {
      ...repayment,
      kind: 'settlement',
      amount: '3000000',
    });
    expect(outstandingFromEvents(settled.obligationEvents).amount).toBe('0');
    const disputed = command(createFixture(), { ...repayment, kind: 'dispute', amount: '0' });
    expect(outstandingFromEvents(disputed.obligationEvents)).toEqual({
      amount: '3000000',
      disputed: true,
    });
    expect(
      calculateSnapshot(disputed).components.find((c) => c.accountId === 'receivable')!.included,
    ).toBe(false);
  });
  it('rejects a cash link in another currency or with ambiguous joint ownership', () => {
    expect(() => command(createFixture(), { ...repayment, cashAccountId: 'joint' })).toThrow(
      '100%',
    );
    expect(() => command(createFixture(), { ...repayment, cashAccountId: 'eur' })).toThrow(
      'moneda',
    );
  });
});
it('equivalent decimal representation of full ownership permits a linked repayment', () => {
  const s = createFixture();
  s.ownershipDecisions.find((d) => d.accountId === 'receivable')!.householdPercentage = '100.0';
  s.ownershipDecisions.find((d) => d.accountId === 'checking')!.householdPercentage = '100.00';
  expect(calculateSnapshot(command(s, { ...repayment, cashAccountId: 'checking' })).netWorth).toBe(
    '52540000',
  );
});
