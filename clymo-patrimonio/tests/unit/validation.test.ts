import { describe, it, expect } from 'vitest';
import { createFixture } from '../../data/fixture';
import { validateState } from '../../domain/validation';
import { applyCommand } from '../../domain/commands';
import { context, manual } from '../helpers';
describe('fail-closed input validation', () => {
  it.each(['-1', 'NaN', 'Infinity', '1e6', '1,000', '', '12.000.000', '.5', '0.000000001'])(
    'rejects invalid money %j',
    (amount) =>
      expect(() => applyCommand(createFixture(), manual({ amount }), context())).toThrow(),
  );
  it.each(['101', '-10', 'NaN', '', '50,5'])('rejects invalid ownership %j', (percentage) =>
    expect(() => applyCommand(createFixture(), manual({ percentage }), context())).toThrow(),
  );
  it.each(['', '2026-02-30', '2026-13-01', '04-09-2026', '2026-09-05'])(
    'rejects missing, malformed or future form date %j',
    (effectiveDate) =>
      expect(() => applyCommand(createFixture(), manual({ effectiveDate }), context())).toThrow(),
  );
  it('rejects unknown currencies and negative source values', () => {
    const s = createFixture();
    const raw = JSON.parse(JSON.stringify(s));
    raw.balances[0].currency = 'XYZ';
    expect(() => validateState(raw)).toThrow();
    s.balances[0].amount = '-12';
    expect(() => validateState(s)).toThrow();
  });
  it('rejects duplicate entity IDs across all arrays', () => {
    const s = createFixture();
    s.balances.push({ ...s.balances[0] });
    expect(() => validateState(s)).toThrow('Identificador duplicado');
  });
  it('rejects duplicate command identities', () => {
    const s = createFixture();
    s.appliedCommands = ['same', 'same'];
    expect(() => validateState(s)).toThrow('Comando duplicado');
  });
  it('rejects cross-household observations and decisions', () => {
    const s = createFixture();
    s.balances[0].householdId = 'other';
    expect(() => validateState(s)).toThrow('otro hogar');
  });
  it('rejects orphan source binding and incorrect original currency', () => {
    const s = createFixture();
    s.balances[0].bindingId = 'unknown';
    expect(() => validateState(s)).toThrow();
    s.balances[0].bindingId = 'binding-checking';
    s.balances[0].currency = 'USD';
    expect(() => validateState(s)).toThrow('moneda');
  });
  it('rejects zero and invalid FX rates', () => {
    const s = createFixture();
    s.rates[0].rate = '0';
    expect(() => validateState(s)).toThrow();
  });
  it('rejects invalid linked repayment references', () => {
    const s = createFixture();
    s.obligationEvents[0].linkedCashObservationId = 'missing';
    expect(() => validateState(s)).toThrow();
  });
  it('rejects malformed persisted objects without replacing the fixture', () => {
    expect(() => validateState({})).toThrow();
    expect(() => validateState(null)).toThrow();
  });
  it('rejects amount supplied as a binary floating point number', () =>
    expect(() => applyCommand(createFixture(), manual({ amount: 123.45 }), context())).toThrow());
  it('viewer role cannot execute financial commands', () =>
    expect(() =>
      applyCommand(createFixture(), manual(), { ...context(), actorId: 'helper-demo' }),
    ).toThrow('lectura'));
  it('does not cap manual accounts at five', () => {
    let s = createFixture();
    for (let i = 0; i < 16; i++) s = applyCommand(s, manual(), context('manual-' + i));
    expect(s.accounts).toHaveLength(29);
  });
});
