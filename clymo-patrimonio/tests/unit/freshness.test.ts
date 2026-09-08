import { describe, it, expect } from 'vitest';
import { DEFAULT_POLICY, freshness, ageInDays } from '../../domain/freshness';
import { money } from '../../domain/format';
function ago(days: number) {
  const d = new Date('2026-09-04T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
describe('versioned freshness policy', () => {
  it.each([
    [35, 'current'],
    [36, 'stale'],
    [65, 'stale'],
    [66, 'urgent'],
    [95, 'urgent'],
    [96, 'expired'],
  ] as const)('statement age %s is %s', (days, expected) =>
    expect(freshness(ago(days), '2026-09-04', DEFAULT_POLICY.statement)).toBe(expected),
  );
  it.each([
    [30, 'current'],
    [31, 'stale'],
    [90, 'stale'],
    [91, 'urgent'],
    [180, 'urgent'],
    [181, 'expired'],
  ] as const)('manual age %s is %s', (days, expected) =>
    expect(freshness(ago(days), '2026-09-04', DEFAULT_POLICY.manual)).toBe(expected),
  );
  it.each([
    ['2026-09-02', 'current'],
    ['2026-09-01', 'stale'],
    ['2026-08-28', 'stale'],
    ['2026-08-27', 'urgent'],
    ['2026-08-21', 'urgent'],
    ['2026-08-20', 'expired'],
  ] as const)('business-day price at %s is %s', (date, expected) =>
    expect(freshness(date, '2026-09-04', DEFAULT_POLICY.price)).toBe(expected),
  );
  it('does not count weekends or configured holidays', () =>
    expect(ageInDays('2026-08-28', '2026-09-01', true, ['2026-08-31'])).toBe(1));
  it('future values are not current', () =>
    expect(freshness('2026-09-05', '2026-09-04', DEFAULT_POLICY.quantity)).toBe('future'));
  it('formats large decimal amounts without conversion to binary floats', () =>
    expect(money('999999999999999999999999.55', 'USD')).toBe(
      'USD 999.999.999.999.999.999.999.999,55',
    ));
  it('uses explicit unavailable text for null', () =>
    expect(money(null, 'CLP')).toBe('Conversión no disponible'));
});
