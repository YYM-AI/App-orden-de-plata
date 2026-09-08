import { describe, it, expect } from 'vitest';
import { createFixture } from '../../data/fixture';
import { calculateSnapshot, convert, bindingTarget, reviewQueue } from '../../domain/engine';
import { D } from '../../domain/model';
import { command, manual } from '../helpers';
const value = (id: string, s = createFixture()) =>
  calculateSnapshot(s).components.find((c) => c.accountId === id)!;
describe('canonical synthetic household', () => {
  it('reproduces assets exactly', () =>
    expect(calculateSnapshot(createFixture()).assets).toBe('60240000'));
  it('reproduces liabilities exactly', () =>
    expect(calculateSnapshot(createFixture()).liabilities).toBe('7700000'));
  it('reproduces net worth exactly', () =>
    expect(calculateSnapshot(createFixture()).netWorth).toBe('52540000'));
  it('includes nine economic sources and excludes four, without counting source bindings as accounts', () => {
    const s = createFixture(),
      snap = calculateSnapshot(s);
    expect(s.accounts).toHaveLength(13);
    expect(s.sourceBindings).toHaveLength(14);
    expect(snap.includedCount).toBe(9);
    expect(snap.excludedCount).toBe(4);
    expect(snap.partial).toBe(true);
    expect(snap.oldestIncludedDate).toBe('2026-08-31');
  });
  it('applies 50% joint ownership without changing original value', () => {
    expect(value('joint')).toMatchObject({
      originalAmount: '15000000',
      reportingValue: '7500000',
      ownershipPercentage: '50',
    });
  });
  it('calculates broker cash and 100 units at USD 42, converts using 950 and preserves independent dates', () => {
    expect(value('broker')).toMatchObject({
      originalAmount: '9200',
      reportingValue: '8740000',
      liquidReporting: '4750000',
      quantityDate: '2026-08-31',
      priceDate: '2026-09-03',
      fxDate: '2026-09-04',
    });
    expect(value('broker').steps.join(' ')).toContain('100 unidades × 42 USD = 4200 USD');
  });
  it('preserves every original USD observation after calculation', () => {
    const s = createFixture(),
      before = JSON.stringify(s);
    calculateSnapshot(s);
    calculateSnapshot(s, 'USD');
    expect(JSON.stringify(s)).toBe(before);
    expect(s.balances.find((b) => b.id === 'balance-broker')!.amount).toBe('5000');
  });
  it('excludes EUR and keeps missing conversion null, never zero', () => {
    expect(value('eur')).toMatchObject({
      included: false,
      originalAmount: '8000',
      reportingValue: null,
    });
    expect(convert(createFixture(), '8000', 'EUR', 'USD').value).toBeNull();
  });
  it('excludes a statement older than 95 days regardless of retrieval time', () => {
    expect(value('old')).toMatchObject({
      included: false,
      originalAmount: '2000000',
      freshness: 'expired',
    });
  });
  it('a current price does not make expired investment quantity current', () => {
    const s = createFixture();
    s.positions[0].effectiveDate = '2026-05-01';
    expect(value('broker', s)).toMatchObject({
      included: false,
      freshness: 'expired',
      quantityDate: '2026-05-01',
      priceDate: '2026-09-03',
    });
    expect(calculateSnapshot(s).assets).toBe('51500000');
  });
  it('excludes broker with expired price', () => {
    const s = createFixture();
    s.prices[0].effectiveDate = '2026-08-03';
    expect(value('broker', s).included).toBe(false);
  });
  it('excludes rather than fabricates an unpriced or unresolved instrument', () => {
    const s = createFixture();
    s.prices = [];
    expect(value('broker', s).reportingValue).toBeNull();
    expect(value('broker', s).included).toBe(false);
    s.prices = createFixture().prices;
    s.instruments[0].confirmed = false;
    expect(value('broker', s).included).toBe(false);
  });
  it('does not count unresolved duplicate evidence', () => {
    const s = createFixture();
    expect(
      bindingTarget(
        s,
        s.sourceBindings.find((b) => b.id === 'binding-broker-copy')!,
      ),
    ).toBeNull();
    expect(calculateSnapshot(s).components.filter((c) => c.accountId === 'broker')).toHaveLength(1);
    expect(reviewQueue(s).filter((r) => r.status === 'pending')).toHaveLength(4);
  });
  it('never adds container total to component values', () => {
    const s = createFixture();
    s.balances.find((b) => b.id === 'balance-broker-total')!.amount = '999999';
    expect(value('broker', s).originalAmount).toBe('9200');
    s.accounts.find((a) => a.id === 'broker')!.valuationBasis = 'statement_total';
    expect(value('broker', s).originalAmount).toBe('999999');
    expect(value('broker', s).observationIds).not.toContain('position-etf');
  });
  it('credit limit never increases assets or liabilities', () => {
    const s = createFixture();
    s.balances.find((b) => b.kind === 'credit_limit')!.amount = '9999999999';
    expect(calculateSnapshot(s).assets).toBe('60240000');
    expect(calculateSnapshot(s).liabilities).toBe('7700000');
  });
  it('posted card balance is a liability', () =>
    expect(value('card')).toMatchObject({ side: 'liability', reportingValue: '1200000' }));
  it('receivable is an asset under explicit synthetic policy', () => {
    expect(value('receivable')).toMatchObject({
      side: 'asset',
      included: true,
      originalAmount: '3000000',
    });
    const s = createFixture();
    s.policy.allowUnverifiedObligations = false;
    expect(value('receivable', s).included).toBe(false);
  });
  it('payable is a liability using the same obligation model', () => {
    const s = command(
      createFixture(),
      manual({
        side: 'liability',
        category: 'obligation',
        name: 'Debo a Juan Demo',
        amount: '400000',
      }),
    );
    expect(calculateSnapshot(s).liabilities).toBe('8100000');
    expect(s.obligations.at(-1)!.direction).toBe('payable');
  });
  it('cash excludes investments, deposits, receivables and credit capacity', () =>
    expect(calculateSnapshot(createFixture()).liquidCash).toBe('25250000'));
  it('unknown and disputed ownership always block primary inclusion', () => {
    for (const status of ['unknown', 'disputed'] as const) {
      const s = createFixture();
      s.ownershipDecisions.find((d) => d.accountId === 'checking')!.status = status;
      expect(value('checking', s).included).toBe(false);
      expect(calculateSnapshot(s).netWorth).toBe('40540000');
      expect(reviewQueue(s).some((r) => r.accountId === 'checking' && r.kind === 'ownership')).toBe(
        true,
      );
    }
  });
  it('read-only helper membership confers no economic ownership', () => {
    const s = createFixture();
    s.memberships.find((m) => m.role === 'viewer')!.active = false;
    expect(calculateSnapshot(s).netWorth).toBe('52540000');
  });
  it('property and linked mortgage stay outside the primary snapshot', () => {
    expect(value('home').included).toBe(false);
    expect(value('mortgage').included).toBe(false);
    expect(value('mortgage').originalCurrency).toBe('CLF');
    expect(value('mortgage').reportingValue).toBe('40000000');
  });
  it('switches currencies from original values with no compounding conversion error', () => {
    const s = createFixture();
    for (let i = 0; i < 30; i++) {
      s.settings.reportingCurrency = 'USD';
      const usd = calculateSnapshot(s);
      expect(new D(usd.assets).minus(usd.liabilities).eq(usd.netWorth)).toBe(true);
      s.settings.reportingCurrency = 'CLP';
      expect(calculateSnapshot(s).netWorth).toBe('52540000');
    }
  });
  it('sums stored component values exactly at the snapshot precision', () => {
    const s = calculateSnapshot(createFixture(), 'USD');
    const sum = s.components
      .filter((c) => c.included && c.side === 'asset')
      .reduce((v, c) => v.plus(c.reportingValue!), new D(0));
    expect(sum.toFixed()).toBe(s.assets);
  });
  it('handles direct, inverse and UF cross conversion', () => {
    const s = createFixture();
    expect(convert(s, '2', 'USD', 'CLP').value).toBe('1900');
    expect(convert(s, '1900', 'CLP', 'USD').value).toBe('2');
    expect(convert(s, '0.0475', 'CLF', 'USD').value).toBe('2');
  });
  it('rejects expired, future and unapproved FX instead of using it silently', () => {
    for (const alteration of ['expired', 'future', 'unapproved']) {
      const s = createFixture();
      if (alteration === 'expired') s.rates[0].effectiveDate = '2026-08-01';
      if (alteration === 'future') s.rates[0].effectiveDate = '2026-09-05';
      if (alteration === 'unapproved') s.rates[0].approved = false;
      expect(value('broker', s).included).toBe(false);
      expect(value('broker', s).reportingValue).toBeNull();
    }
  });
  it('chooses effective time over retrieval time, and manual corrections at the same date', () => {
    let s = command(
      createFixture(),
      {
        type: 'observe',
        accountId: 'checking',
        amount: '13000000',
        effectiveDate: '2026-09-04',
        reason: 'Corrección ficticia',
      },
      'newer',
    );
    s = command(
      s,
      {
        type: 'observe',
        accountId: 'checking',
        amount: '1',
        effectiveDate: '2026-08-01',
        reason: 'Cartola anterior',
      },
      'older',
    );
    expect(value('checking', s).originalAmount).toBe('13000000');
  });
  it('ignores future observations at a historical cutoff', () => {
    const s = createFixture();
    s.balances.push({
      ...s.balances[0],
      id: 'future-balance',
      amount: '90000000',
      effectiveDate: '2026-09-05',
    });
    expect(value('checking', s).originalAmount).toBe('12000000');
  });
  it('is deterministic and does not mutate its inputs', () => {
    const s = createFixture(),
      before = structuredClone(s);
    const a = calculateSnapshot(s);
    expect(calculateSnapshot(s)).toEqual(a);
    expect(s).toEqual(before);
    expect(JSON.stringify(a)).toBe(
      JSON.stringify(calculateSnapshot(JSON.parse(JSON.stringify(s)))),
    );
  });
  it('new fixture restores original values independent of previous modifications', () => {
    const s = createFixture();
    s.balances[0].amount = '1';
    expect(calculateSnapshot(s).netWorth).not.toBe('52540000');
    expect(calculateSnapshot(createFixture()).netWorth).toBe('52540000');
  });
});
it('missing expected broker quantity is unavailable, never silently reduced to cash only', () => {
  const s = createFixture();
  s.positions = [];
  expect(value('broker', s)).toMatchObject({
    included: false,
    originalAmount: null,
    reportingValue: null,
  });
});
