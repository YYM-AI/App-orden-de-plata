import type { Freshness, FreshnessRule, Policy } from './model';
export const DEFAULT_POLICY: Policy = {
  version: 'synthetic-v1.0',
  allowUnverifiedObligations: true,
  statement: { currentDays: 35, warningDays: 65, maxDays: 95, businessDays: false },
  quantity: { currentDays: 35, warningDays: 65, maxDays: 95, businessDays: false },
  price: { currentDays: 2, warningDays: 5, maxDays: 10, businessDays: true },
  rate: { currentDays: 2, warningDays: 5, maxDays: 10, businessDays: true },
  manual: { currentDays: 30, warningDays: 90, maxDays: 180, businessDays: false },
  holidays: [],
};
export function ageInDays(
  date: string,
  cutoff: string,
  businessDays = false,
  holidays: string[] = [],
): number {
  const start = new Date(date + 'T00:00:00Z');
  const end = new Date(cutoff + 'T00:00:00Z');
  if (!businessDays) return Math.floor((end.getTime() - start.getTime()) / 86400000);
  if (start > end) return -1;
  let count = 0;
  for (
    start.setUTCDate(start.getUTCDate() + 1);
    start <= end;
    start.setUTCDate(start.getUTCDate() + 1)
  ) {
    if (![0, 6].includes(start.getUTCDay()) && !holidays.includes(start.toISOString().slice(0, 10)))
      count++;
  }
  return count;
}
export function freshness(
  date: string,
  cutoff: string,
  rule: FreshnessRule,
  holidays: string[] = [],
): Freshness {
  const age = ageInDays(date, cutoff, rule.businessDays, holidays);
  if (age < 0) return 'future';
  if (age > rule.maxDays) return 'expired';
  if (age > rule.warningDays) return 'urgent';
  if (age > rule.currentDays) return 'stale';
  return 'current';
}
const order: Freshness[] = ['current', 'stale', 'urgent', 'expired', 'future'];
export const worstFreshness = (...states: Freshness[]): Freshness =>
  states.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] ?? 'current';
export const freshnessLabel: Record<Freshness, string> = {
  current: 'Vigente',
  stale: 'Antigua',
  urgent: 'Muy antigua',
  expired: 'Vencida',
  future: 'Fecha futura',
};
