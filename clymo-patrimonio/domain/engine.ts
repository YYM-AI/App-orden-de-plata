import {
  D,
  type Currency,
  type DemoState,
  type SourceBinding,
  type ConversionStep,
  type ValuationComponent,
  type NetWorthSnapshot,
  type ReportingCurrency,
  type Freshness,
  type ExchangeRate,
} from './model';
import { freshness, worstFreshness } from './freshness';
import { outstandingFromEvents, validateState } from './validation';

export function latest<T extends { effectiveDate: string }>(
  items: T[],
  cutoff: string,
): T | undefined {
  return items
    .filter((v) => v.effectiveDate <= cutoff)
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v.effectiveDate.localeCompare(a.v.effectiveDate) || b.i - a.i)[0]?.v;
}
export function bindingTarget(s: DemoState, binding: SourceBinding): string | null {
  if (binding.accountId) return binding.accountId;
  const candidate = s.duplicates.find((d) => d.bindingId === binding.id);
  const task = s.reviewTasks.find((r) => r.candidateId === candidate?.id);
  if (!candidate || !task) return null;
  const decision = latest(
    s.resolutions.filter(
      (r) => r.reviewId === task.id && ['bind', 'undo_binding'].includes(r.action),
    ),
    s.cutoff,
  );
  return decision?.action === 'bind' ? candidate.candidateAccountId : null;
}
function selectObservation<T extends { effectiveDate: string; bindingId: string }>(
  s: DemoState,
  items: T[],
): T | undefined {
  const eligible = items.filter((o) => o.effectiveDate <= s.cutoff);
  return eligible
    .map((v, i) => ({
      v,
      i,
      priority: s.sourceBindings.find((b) => b.id === v.bindingId)?.priority ?? 0,
    }))
    .sort(
      (a, b) =>
        b.v.effectiveDate.localeCompare(a.v.effectiveDate) || b.priority - a.priority || b.i - a.i,
    )[0]?.v;
}
const stored = (n: InstanceType<typeof D>) => n.toDecimalPlaces(8).toFixed();
interface Conversion {
  value: string | null;
  steps: ConversionStep[];
  freshness: Freshness;
  reason?: string;
}
export function convert(
  s: DemoState,
  amount: string,
  from: Currency,
  to: ReportingCurrency,
): Conversion {
  if (from === to) return { value: amount, steps: [], freshness: 'current' };
  const all: ExchangeRate[] = [
    ...s.rates,
    ...s.ufValues.map((v) => ({
      id: v.id,
      base: 'CLF' as const,
      quote: 'CLP' as const,
      rate: v.clpValue,
      effectiveDate: v.effectiveDate,
      recordedAt: v.recordedAt,
      source: v.source,
      approved: v.approved,
    })),
  ];
  const edges: ConversionStep[] = [];
  const pairs = new Set(all.map((r) => r.base + '/' + r.quote));
  for (const pair of pairs) {
    const r = latest(
      all.filter((r) => r.base + '/' + r.quote === pair && r.approved),
      s.cutoff,
    );
    if (!r) continue;
    const common = {
      rate: r.rate,
      effectiveDate: r.effectiveDate,
      recordedAt: r.recordedAt,
      source: r.source,
      rateId: r.id,
    };
    edges.push(
      { ...common, from: r.base, to: r.quote, operation: 'multiply' },
      { ...common, from: r.quote, to: r.base, operation: 'divide' },
    );
  }
  const direct = edges.find((r) => r.from === from && r.to === to);
  let path: ConversionStep[] = direct ? [direct] : [];
  if (!direct) {
    const first = edges.find((r) => r.from === from && r.to === 'CLP');
    const second = edges.find((r) => r.from === 'CLP' && r.to === to);
    if (first && second) path = [first, second];
  }
  if (!path.length)
    return {
      value: null,
      steps: [],
      freshness: 'current',
      reason: 'Falta un tipo de cambio aprobado; el valor original no equivale a cero.',
    };
  const f = worstFreshness(
    ...path.map((r) => freshness(r.effectiveDate, s.cutoff, s.policy.rate, s.policy.holidays)),
  );
  if (f === 'expired' || f === 'future')
    return {
      value: null,
      steps: path,
      freshness: f,
      reason: 'El tipo de cambio o la UF supera su antigüedad máxima.',
    };
  const value = path.reduce(
    (v, r) => (r.operation === 'multiply' ? v.mul(r.rate) : v.div(r.rate)),
    new D(amount),
  );
  return { value: value.toFixed(), steps: path, freshness: f };
}

export function calculateSnapshot(
  input: DemoState,
  reportingCurrency?: ReportingCurrency,
): NetWorthSnapshot {
  const s = validateState(input);
  const currency = reportingCurrency ?? s.settings.reportingCurrency;
  const components: ValuationComponent[] = s.accounts.map((a) => {
    const ownership = latest(
      s.ownershipDecisions.filter((d) => d.accountId === a.id),
      s.cutoff,
    );
    const inclusion = latest(
      s.inclusionDecisions.filter((d) => d.accountId === a.id),
      s.cutoff,
    );
    const c: ValuationComponent = {
      id: `value-${a.id}`,
      accountId: a.id,
      side: a.side,
      originalAmount: null,
      originalCurrency: a.currency,
      reportingCurrency: currency,
      reportingValue: null,
      ownershipPercentage: ownership?.householdPercentage ?? null,
      included: true,
      reasons: [],
      freshness: 'current',
      method: a.valuationBasis,
      effectiveDate: null,
      observationIds: [],
      sources: [],
      conversions: [],
      steps: [],
      liquidOriginal: '0',
      liquidReporting: '0',
      decisionIds: [ownership?.id, inclusion?.id].filter((v): v is string => !!v),
    };
    const exclude = (reason: string) => {
      c.included = false;
      c.reasons.push(reason);
    };
    if (!ownership || ownership.status !== 'confirmed')
      exclude('La propiedad del hogar no está confirmada o está en disputa.');
    if (inclusion?.include === false)
      exclude('Excluido por decisión registrada: ' + inclusion.reason);
    if (a.propertyPairId || a.category === 'property')
      exclude(
        'Vivienda e hipoteca excluidas juntas: la valoración de propiedades no está soportada.',
      );
    const bindings = s.sourceBindings.filter((b) => bindingTarget(s, b) === a.id).map((b) => b.id);
    const balances = s.balances.filter(
      (b) => b.accountId === a.id && bindings.includes(b.bindingId),
    );
    const observe = (
      o: { id: string; effectiveDate: string; recordedAt: string; source: string },
      kind: 'manual' | 'statement' | 'quantity' | 'price',
    ) => {
      c.observationIds.push(o.id);
      c.sources.push(o.source);
      c.recordedAt = !c.recordedAt || o.recordedAt > c.recordedAt ? o.recordedAt : c.recordedAt;
      if (kind !== 'price')
        c.effectiveDate =
          !c.effectiveDate || o.effectiveDate < c.effectiveDate ? o.effectiveDate : c.effectiveDate;
      const f = freshness(o.effectiveDate, s.cutoff, s.policy[kind], s.policy.holidays);
      c.freshness = worstFreshness(c.freshness, f);
      if (f === 'expired' || f === 'future')
        exclude(
          `La ${kind === 'quantity' ? 'cantidad' : kind === 'price' ? 'cotización' : 'observación'} supera la antigüedad máxima o tiene fecha futura.`,
        );
    };
    if (a.valuationBasis === 'obligation') {
      const obligation = s.obligations.find((o) => o.accountId === a.id)!;
      const events = s.obligationEvents.filter(
        (e) => e.obligationId === obligation.id && e.effectiveDate <= s.cutoff,
      );
      if (events.length) {
        const outstanding = outstandingFromEvents(events);
        c.originalAmount = outstanding.amount;
        c.observationIds = events.map((e) => e.id);
        c.sources = ['Registro manual ficticio · sin verificación externa'];
        c.effectiveDate = events[events.length - 1].effectiveDate;
        c.recordedAt = events[events.length - 1].recordedAt;
        c.freshness = freshness(c.effectiveDate, s.cutoff, s.policy.manual, s.policy.holidays);
        if (c.freshness === 'expired')
          exclude('La obligación supera la antigüedad máxima de un valor manual.');
        if (outstanding.disputed) exclude('La obligación está en disputa.');
        if (!s.policy.allowUnverifiedObligations)
          exclude('La política no permite obligaciones sin verificación.');
        c.steps.push(
          ...events.map(
            (e) =>
              `${{ initial: 'Capital inicial', repayment: 'Pago', adjustment: 'Ajuste', forgiveness: 'Condonación', write_off: 'Baja', settlement: 'Liquidación', dispute: 'Disputa' }[e.kind]}: ${e.amount} ${e.currency} · ${e.effectiveDate}`,
          ),
          'Saldo pendiente derivado de eventos; no se sobrescribe.',
        );
      } else exclude('No hay capital inicial a la fecha de corte.');
    } else if (a.valuationBasis === 'component_sum') {
      const cash = selectObservation(
        s,
        balances.filter((b) => b.kind === 'cash'),
      );
      if (cash) {
        c.originalAmount = cash.amount;
        c.liquidOriginal = cash.amount;
        observe(cash, 'statement');
        c.steps.push(`Efectivo dentro del broker: ${cash.amount} ${cash.currency}.`);
      } else exclude('Falta una observación de efectivo para completar la cuenta de inversión.');
      const instrumentIds = new Set([
        ...(a.expectedInstrumentIds ?? []),
        ...s.positions
          .filter((p) => p.accountId === a.id && bindings.includes(p.bindingId))
          .map((p) => p.instrumentId),
      ]);
      for (const instrumentId of instrumentIds) {
        const position = selectObservation(
          s,
          s.positions.filter(
            (p) =>
              p.accountId === a.id &&
              p.instrumentId === instrumentId &&
              bindings.includes(p.bindingId),
          ),
        );
        const instrument = s.instruments.find((i) => i.id === instrumentId)!;
        const price = latest(
          s.prices.filter((p) => p.instrumentId === instrumentId && p.approved),
          s.cutoff,
        );
        if (!position || !price || !instrument.confirmed) {
          exclude('Falta una cantidad, instrumento confirmado o precio aprobado.');
          c.originalAmount = null;
          continue;
        }
        observe(position, 'quantity');
        observe({ ...price, source: price.source }, 'price');
        c.quantityDate =
          !c.quantityDate || position.effectiveDate < c.quantityDate
            ? position.effectiveDate
            : c.quantityDate;
        c.priceDate =
          !c.priceDate || price.effectiveDate < c.priceDate ? price.effectiveDate : c.priceDate;
        const value = new D(position.quantity).mul(price.amount);
        if (c.originalAmount !== null)
          c.originalAmount = new D(c.originalAmount).plus(value).toFixed();
        c.steps.push(
          `${instrument.name}: ${position.quantity} unidades × ${price.amount} ${price.currency} = ${value.toFixed()} ${price.currency}.`,
        );
      }
      c.steps.push(
        'Se suman efectivo y posiciones. El total de la cartola sirve como referencia y no se suma otra vez.',
      );
    } else {
      const balance = selectObservation(
        s,
        balances.filter((b) => b.kind === 'balance' || b.kind === 'account_total'),
      );
      if (balance) {
        c.originalAmount = balance.amount;
        const binding = s.sourceBindings.find((b) => b.id === balance.bindingId)!;
        observe(balance, binding.method === 'manual' ? 'manual' : 'statement');
        c.method = binding.method === 'manual' ? 'manual' : 'statement_total';
        c.steps.push(
          `Observación seleccionada: ${balance.amount} ${balance.currency} al ${balance.effectiveDate}.`,
        );
        if (['bank', 'cash'].includes(a.category) && a.side === 'asset')
          c.liquidOriginal = balance.amount;
        if (a.category === 'card')
          c.steps.push(
            'Solo se resta el saldo registrado por pagar. El cupo de crédito es informativo.',
          );
      } else {
        const future = latest(balances, '9999-12-31');
        if (future) {
          c.originalAmount = future.amount;
          observe(future, a.manual ? 'manual' : 'statement');
        }
        exclude('No hay una observación elegible a la fecha de corte.');
      }
    }
    if (c.originalAmount !== null) {
      const conversion = convert(s, c.originalAmount, a.currency, currency);
      c.conversions = conversion.steps;
      c.fxDate = conversion.steps.map((r) => r.effectiveDate).sort()[0];
      c.freshness = worstFreshness(c.freshness, conversion.freshness);
      if (conversion.reason) exclude(conversion.reason);
      if (conversion.value !== null && ownership?.status === 'confirmed') {
        c.reportingValue = stored(
          new D(conversion.value).mul(ownership.householdPercentage).div(100),
        );
        c.steps.push(`Participación del hogar: ${ownership.householdPercentage}%.`);
        for (const r of conversion.steps)
          c.steps.push(
            `${r.from} → ${r.to}: ${r.operation === 'multiply' ? 'multiplicar' : 'dividir'} por ${r.rate}, tasa del ${r.effectiveDate}.`,
          );
        c.steps.push(`Valor del hogar: ${c.reportingValue} ${currency}.`);
        const liquid = convert(s, c.liquidOriginal, a.currency, currency);
        if (c.included && liquid.value !== null)
          c.liquidReporting = stored(
            new D(liquid.value).mul(ownership.householdPercentage).div(100),
          );
      }
    }
    if (c.originalAmount === null)
      exclude('Valor completo no disponible; no se sustituye por cero.');
    if (c.included)
      c.reasons.push(
        a.valuationBasis === 'obligation'
          ? 'Incluido bajo la política sintética explícita para obligaciones no verificadas.'
          : 'Incluido: propiedad confirmada, observación elegible y conversión disponible.',
      );
    c.sources = [...new Set(c.sources)];
    c.reasons = [...new Set(c.reasons)];
    return c;
  });
  const sum = (side: 'asset' | 'liability') =>
    components
      .filter((c) => c.included && c.side === side && c.reportingValue !== null)
      .reduce((v, c) => v.plus(c.reportingValue!), new D(0));
  const assets = sum('asset'),
    liabilities = sum('liability');
  const included = components.filter((c) => c.included);
  return {
    cutoff: s.cutoff,
    valuationTime: s.cutoff + 'T23:59:59Z',
    policyVersion: s.policy.version,
    reportingCurrency: currency,
    assets: assets.toFixed(),
    liabilities: liabilities.toFixed(),
    netWorth: assets.minus(liabilities).toFixed(),
    liquidCash: included.reduce((sum, c) => sum.plus(c.liquidReporting), new D(0)).toFixed(),
    components,
    includedCount: included.length,
    excludedCount: components.length - included.length,
    oldestIncludedDate:
      included
        .map((c) => c.effectiveDate)
        .filter((v): v is string => !!v)
        .sort()[0] ?? null,
    partial: included.length !== components.length,
  };
}

export function reviewQueue(s: DemoState, snapshot = calculateSnapshot(s)) {
  const tasks = [...s.reviewTasks];
  for (const c of snapshot.components) {
    if (
      !c.included &&
      !tasks.some((t) => t.accountId === c.accountId) &&
      !s.accounts.find((a) => a.id === c.accountId)?.propertyPairId
    ) {
      const ownership = latest(
        s.ownershipDecisions.filter((d) => d.accountId === c.accountId),
        s.cutoff,
      );
      if (
        latest(
          s.inclusionDecisions.filter((d) => d.accountId === c.accountId),
          s.cutoff,
        )?.include === false
      )
        continue;
      tasks.push({
        id: `auto-${c.accountId}`,
        householdId: s.household.id,
        accountId: c.accountId,
        kind: !ownership || ownership.status !== 'confirmed' ? 'ownership' : 'inclusion',
        title: `Revisar ${s.accounts.find((a) => a.id === c.accountId)!.name}`,
        detail: c.reasons.join(' ').slice(0, 300),
      });
    }
  }
  return tasks.map((t) => {
    const decision = latest(
      s.resolutions.filter((r) => r.reviewId === t.id),
      s.cutoff,
    );
    const component = snapshot.components.find((c) => c.accountId === t.accountId)!;
    let status: 'pending' | 'acknowledged' | 'resolved' = 'pending';
    if (t.kind === 'duplicate') {
      const binding = s.sourceBindings.find(
        (b) => b.id === s.duplicates.find((d) => d.id === t.candidateId)?.bindingId,
      )!;
      if (bindingTarget(s, binding)) status = 'resolved';
    } else if (component.included) status = 'resolved';
    else if (decision?.action === 'acknowledge') status = 'acknowledged';
    return { ...t, status, decision };
  });
}
