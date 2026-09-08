import type { DemoState, LogicalAccount } from '../domain/model';
import { DEFAULT_POLICY } from '../domain/freshness';
import { validateState } from '../domain/validation';
export const CUTOFF = '2026-09-04';
const recordedAt = '2026-09-04T20:00:00Z';
const householdId = 'household-demo';
const rows: Array<
  [
    string,
    string,
    string,
    string,
    LogicalAccount['currency'],
    LogicalAccount['side'],
    LogicalAccount['category'],
    string,
    string,
    boolean,
  ]
> = [
  [
    'checking',
    'chile',
    'Cuenta corriente',
    '12000000',
    'CLP',
    'asset',
    'bank',
    '100',
    '2026-08-31',
    false,
  ],
  [
    'joint',
    'santander',
    'Ahorro compartido',
    '15000000',
    'CLP',
    'asset',
    'bank',
    '50',
    '2026-08-31',
    false,
  ],
  [
    'deposit',
    'estado',
    'Depósito a plazo',
    '20000000',
    'CLP',
    'asset',
    'deposit',
    '100',
    '2026-08-31',
    false,
  ],
  [
    'cash',
    'manual',
    'Efectivo en casa',
    '1000000',
    'CLP',
    'asset',
    'cash',
    '100',
    '2026-09-01',
    true,
  ],
  [
    'broker',
    'broker-us',
    'Inversión en Estados Unidos',
    '5000',
    'USD',
    'asset',
    'investment',
    '100',
    '2026-08-31',
    false,
  ],
  [
    'fund',
    'fund-cl',
    'Fondo mutuo chileno',
    '8000000',
    'CLP',
    'asset',
    'investment',
    '100',
    '2026-08-31',
    false,
  ],
  [
    'receivable',
    'manual',
    'María Demo me debe',
    '3000000',
    'CLP',
    'asset',
    'obligation',
    '100',
    '2026-09-01',
    true,
  ],
  [
    'card',
    'chile',
    'Tarjeta de crédito',
    '1200000',
    'CLP',
    'liability',
    'card',
    '100',
    '2026-08-31',
    false,
  ],
  [
    'loan',
    'santander',
    'Crédito de consumo',
    '6500000',
    'CLP',
    'liability',
    'loan',
    '100',
    '2026-08-31',
    false,
  ],
  ['eur', 'europe', 'Ahorro en euros', '8000', 'EUR', 'asset', 'bank', '100', '2026-08-31', false],
  [
    'old',
    'estado',
    'Cuenta antigua',
    '2000000',
    'CLP',
    'asset',
    'bank',
    '100',
    '2026-05-01',
    false,
  ],
  [
    'home',
    'manual',
    'Vivienda de referencia',
    '150000000',
    'CLP',
    'asset',
    'property',
    '100',
    '2026-09-01',
    true,
  ],
  [
    'mortgage',
    'santander',
    'Hipoteca de la vivienda',
    '1000',
    'CLF',
    'liability',
    'loan',
    '100',
    '2026-08-31',
    false,
  ],
];
export function createFixture(): DemoState {
  const s: DemoState = {
    schemaVersion: 1,
    revision: 0,
    cutoff: CUTOFF,
    household: { id: householdId, name: 'Familia Demo Clymo', synthetic: true },
    users: [
      { id: 'user-demo', displayName: 'Administrador Demo' },
      { id: 'helper-demo', displayName: 'Ayudante Demo' },
    ],
    financialParties: [
      { id: 'party-household', householdId, label: 'Titulares Demo del hogar', role: 'owner' },
      { id: 'party-maria', householdId, label: 'María Demo', role: 'counterparty' },
    ],
    memberships: [
      { id: 'member-admin', householdId, userId: 'user-demo', role: 'admin', active: true },
      { id: 'member-helper', householdId, userId: 'helper-demo', role: 'viewer', active: true },
    ],
    institutions: [
      ['chile', 'Banco de Chile', 'CL'],
      ['santander', 'Santander', 'CL'],
      ['estado', 'Banco Estado', 'CL'],
      ['manual', 'Registro manual ficticio', 'CL'],
      ['broker-us', 'Demo Securities · EE. UU.', 'US'],
      ['fund-cl', 'Administradora Demo', 'CL'],
      ['europe', 'Banco Europeo Demo', 'ES'],
    ].map(([id, name, country]) => ({ id, name, country, synthetic: true })),
    accounts: [],
    sourceBindings: [],
    balances: [],
    instruments: [
      {
        id: 'etf-demo',
        name: 'ETF Minería Demo',
        currency: 'USD',
        fictionalTicker: 'DEMO-MIN',
        confirmed: true,
      },
    ],
    positions: [],
    prices: [
      {
        id: 'price-etf',
        instrumentId: 'etf-demo',
        amount: '42',
        currency: 'USD',
        effectiveDate: '2026-09-03',
        recordedAt,
        source: 'Cierre ficticio aprobado',
        approved: true,
      },
    ],
    rates: [
      {
        id: 'fx-usd',
        base: 'USD',
        quote: 'CLP',
        rate: '950',
        effectiveDate: CUTOFF,
        recordedAt,
        source: 'Tipo de cambio sintético aprobado',
        approved: true,
      },
    ],
    ufValues: [
      {
        id: 'uf-demo',
        unit: 'CLF',
        clpValue: '40000',
        effectiveDate: CUTOFF,
        recordedAt,
        source: 'UF sintética aprobada',
        approved: true,
      },
    ],
    ownershipDecisions: [],
    inclusionDecisions: [],
    manualAssets: [],
    liabilities: [],
    obligations: [
      {
        id: 'obligation-maria',
        householdId,
        accountId: 'receivable',
        counterpartyId: 'party-maria',
        direction: 'receivable',
        currency: 'CLP',
        unverified: true,
        shared: false,
      },
    ],
    obligationEvents: [
      {
        id: 'event-initial-maria',
        householdId,
        obligationId: 'obligation-maria',
        kind: 'initial',
        amount: '3000000',
        currency: 'CLP',
        effectiveDate: '2026-09-01',
        recordedAt,
        actorId: 'user-demo',
        reason: 'Capital inicial ficticio confirmado por el usuario.',
      },
    ],
    duplicates: [
      {
        id: 'duplicate-broker',
        householdId,
        bindingId: 'binding-broker-copy',
        candidateAccountId: 'broker',
        evidence: [
          'Misma institución y cuenta ficticia DEMO-4821.',
          'Misma moneda USD, titulares y posiciones.',
          'El saldo similar por sí solo no prueba identidad.',
        ],
      },
    ],
    reviewTasks: [
      {
        id: 'review-duplicate',
        householdId,
        accountId: 'broker',
        candidateId: 'duplicate-broker',
        kind: 'duplicate',
        title: 'Dos cartolas, una misma inversión',
        detail: 'La segunda cartola está en espera. No agrega otra cuenta ni otro valor.',
      },
      {
        id: 'review-eur',
        householdId,
        accountId: 'eur',
        kind: 'missing_rate',
        title: 'El ahorro en euros necesita una conversión',
        detail: 'No existe una tasa EUR aprobada. El valor original se conserva fuera del total.',
      },
      {
        id: 'review-old',
        householdId,
        accountId: 'old',
        kind: 'stale',
        title: 'Actualizar la cuenta antigua',
        detail: 'La observación supera 95 días. Registra una nueva observación ficticia.',
      },
      {
        id: 'review-property',
        householdId,
        accountId: 'home',
        kind: 'property',
        title: 'Vivienda e hipoteca fuera del cálculo',
        detail: 'La valoración de propiedades no está soportada. Se excluye la pareja completa.',
      },
    ],
    resolutions: [],
    policy: structuredClone(DEFAULT_POLICY),
    settings: { reportingCurrency: 'CLP', obligationsVisible: true },
    appliedCommands: [],
  };
  rows.forEach(
    (
      [id, institutionId, name, amount, currency, side, category, share, effectiveDate, manual],
      i,
    ) => {
      s.accounts.push({
        id,
        householdId,
        institutionId,
        name,
        currency,
        side,
        category,
        manual,
        maskedIdentifier: id === 'broker' ? 'DEMO-4821' : `DEMO-${String(i + 1).padStart(4, '0')}`,
        valuationBasis:
          category === 'obligation'
            ? 'obligation'
            : id === 'broker'
              ? 'component_sum'
              : manual
                ? 'manual'
                : 'statement_total',
        ...(['home', 'mortgage'].includes(id) ? { propertyPairId: 'pair-home' } : {}),
        ...(id === 'broker' ? { expectedInstrumentIds: ['etf-demo'] } : {}),
      });
      s.sourceBindings.push({
        id: `binding-${id}`,
        householdId,
        accountId: id,
        name: manual ? 'Ingreso manual Demo' : 'Cartola ficticia de referencia',
        method: manual ? 'manual' : 'synthetic_statement',
        priority: 10,
      });
      if (category !== 'obligation')
        s.balances.push({
          id: `balance-${id}`,
          householdId,
          accountId: id,
          bindingId: `binding-${id}`,
          source: manual ? 'Usuario Demo' : 'Cartola sintética',
          synthetic: true,
          amount,
          currency,
          kind: id === 'broker' ? 'cash' : 'balance',
          effectiveDate,
          recordedAt,
        });
      s.ownershipDecisions.push({
        id: `ownership-${id}`,
        householdId,
        accountId: id,
        partyId: 'party-household',
        householdPercentage: share,
        status: 'confirmed',
        effectiveDate: '2026-01-01',
        recordedAt,
        actorId: 'user-demo',
        reason: 'Participación del hogar confirmada para la demostración.',
      });
      if (manual && side === 'asset')
        s.manualAssets.push({ id: `manual-${id}`, householdId, accountId: id, description: name });
      if (side === 'liability')
        s.liabilities.push({
          id: `liability-${id}`,
          householdId,
          accountId: id,
          principalOnly: true,
        });
    },
  );
  s.sourceBindings.push({
    id: 'binding-broker-copy',
    householdId,
    accountId: null,
    name: 'Segunda cartola ficticia · DEMO-4821',
    method: 'synthetic_statement',
    priority: 5,
  });
  const brokerObservation = s.balances.find((b) => b.accountId === 'broker')!;
  s.balances.push(
    { ...brokerObservation, id: 'balance-broker-total', kind: 'account_total', amount: '9200' },
    {
      ...brokerObservation,
      id: 'balance-broker-copy',
      bindingId: 'binding-broker-copy',
      kind: 'account_total',
      amount: '9200',
      source: 'Segunda cartola ficticia',
    },
  );
  s.balances.push({
    ...s.balances.find((b) => b.accountId === 'card')!,
    id: 'credit-limit-card',
    kind: 'credit_limit',
    amount: '5000000',
  });
  s.positions.push({
    id: 'position-etf',
    householdId,
    accountId: 'broker',
    bindingId: 'binding-broker',
    source: 'Cartola sintética',
    synthetic: true,
    instrumentId: 'etf-demo',
    quantity: '100',
    effectiveDate: '2026-08-31',
    recordedAt,
  });
  return validateState(s);
}
