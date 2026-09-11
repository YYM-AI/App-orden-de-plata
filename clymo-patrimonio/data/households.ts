import { createFixture } from './fixture';
import { validateState } from '@/domain/validation';
import type { DemoState } from '@/domain/model';
export type FixtureKind = 'canonical' | 'north' | 'empty';
export function householdFixture(
  id: string,
  name: string,
  ownerId: string,
  kind: FixtureKind,
): DemoState {
  const state = createFixture();
  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
    if (value === state.household.id) return id;
    if (value === 'user-demo') return ownerId;
    return value;
  };
  const result = rewrite(state) as DemoState;
  result.household = { id, name, synthetic: true };
  result.users = [{ id: ownerId, displayName: 'Propietario Demo' }];
  result.memberships = [
    { id: 'membership-owner', householdId: id, userId: ownerId, role: 'admin', active: true },
  ];
  if (kind !== 'canonical') {
    for (const key of [
      'accounts',
      'sourceBindings',
      'balances',
      'instruments',
      'positions',
      'prices',
      'rates',
      'ufValues',
      'ownershipDecisions',
      'inclusionDecisions',
      'manualAssets',
      'liabilities',
      'obligations',
      'obligationEvents',
      'duplicates',
      'reviewTasks',
      'resolutions',
    ] as const)
      result[key] = [];
    result.financialParties = [
      { id: 'party-household', householdId: id, label: 'Propiedad del hogar', role: 'owner' },
    ];
    result.institutions = [
      { id: 'manual', name: 'Registro manual ficticio', country: 'CL', synthetic: true },
    ];
  }
  if (kind === 'north') {
    result.institutions.push({
      id: 'north-bank',
      name: 'Banco Norte Ficticio',
      country: 'US',
      synthetic: true,
    });
    const common = {
      householdId: id,
      effectiveDate: '2026-09-01',
      recordedAt: '2026-09-04T20:00:00Z',
    };
    for (const [accountId, side, name, currency, amount, category] of [
      ['north-cash', 'asset', 'Cuenta Norte USD', 'USD', '2000', 'bank'],
      ['north-loan', 'liability', 'Deuda Norte CLP', 'CLP', '100000', 'loan'],
    ] as const) {
      result.accounts.push({
        id: accountId,
        householdId: id,
        institutionId: 'north-bank',
        name,
        currency,
        side,
        category,
        maskedIdentifier: 'DEMO-NORTE-' + accountId,
        valuationBasis: 'statement_total',
        manual: false,
      });
      result.sourceBindings.push({
        id: accountId + '-binding',
        householdId: id,
        accountId,
        name: 'Cartola Norte ficticia',
        method: 'synthetic_statement',
        priority: 10,
      });
      result.balances.push({
        ...common,
        id: accountId + '-balance',
        accountId,
        bindingId: accountId + '-binding',
        amount,
        currency,
        kind: 'balance',
        source: 'Cartola Norte ficticia',
        synthetic: true,
      });
      result.ownershipDecisions.push({
        ...common,
        id: accountId + '-ownership',
        accountId,
        partyId: 'party-household',
        householdPercentage: '100',
        status: 'confirmed',
        actorId: ownerId,
        reason: 'Propiedad ficticia confirmada.',
      });
      if (side === 'liability')
        result.liabilities.push({
          id: accountId + '-liability',
          householdId: id,
          accountId,
          principalOnly: true,
        });
    }
    result.rates.push({
      ...common,
      id: 'north-usd-clp',
      base: 'USD',
      quote: 'CLP',
      rate: '1000',
      source: 'Tasa Norte ficticia',
      approved: true,
    });
  }
  return validateState(result);
}
