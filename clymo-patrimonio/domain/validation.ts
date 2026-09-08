import { D, stateSchema, type DemoState, type ObligationEvent } from './model';

export function outstandingFromEvents(events: ObligationEvent[]): {
  amount: string;
  disputed: boolean;
} {
  let balance = new D(0);
  let initialized = false;
  let disputed = false;
  for (const event of events) {
    const amount = new D(event.amount);
    if (event.kind === 'initial') {
      if (initialized || !amount.gt(0))
        throw Error('El capital inicial debe existir una sola vez y ser positivo.');
      initialized = true;
      balance = amount;
      continue;
    }
    if (!initialized) throw Error('Falta el capital inicial de la obligación.');
    if (event.kind === 'dispute') {
      if (!amount.isZero()) throw Error('Una disputa no cambia el monto.');
      disputed = true;
      continue;
    }
    if (event.kind === 'adjustment') {
      if (!event.adjustmentDirection || !amount.gt(0))
        throw Error('El ajuste requiere dirección y monto positivo.');
      balance =
        event.adjustmentDirection === 'increase' ? balance.plus(amount) : balance.minus(amount);
    } else {
      if (!amount.gt(0)) throw Error('El evento requiere un monto positivo.');
      if (event.kind === 'settlement' && !balance.eq(amount))
        throw Error('La liquidación debe cerrar el saldo completo.');
      balance = balance.minus(amount);
    }
    if (balance.lt(0)) throw Error('El pago o la reducción supera el saldo pendiente.');
  }
  if (!initialized) throw Error('Falta el capital inicial de la obligación.');
  return { amount: balance.toFixed(), disputed };
}

export function validateState(input: unknown): DemoState {
  const s = stateSchema.parse(input);
  const seen = new Set<string>();
  const records = [
    s.household,
    ...Object.values(s).flatMap((value) =>
      Array.isArray(value)
        ? value.filter((v) => typeof v === 'object' && v !== null && 'id' in v)
        : [],
    ),
  ];
  for (const record of records) {
    if (seen.has(record.id)) throw Error('Identificador duplicado: ' + record.id);
    seen.add(record.id);
    if ('householdId' in record && record.householdId !== s.household.id)
      throw Error('El registro pertenece a otro hogar.');
  }
  if (new Set(s.appliedCommands).size !== s.appliedCommands.length)
    throw Error('Comando duplicado.');
  const account = (id: string) => {
    const a = s.accounts.find((a) => a.id === id);
    if (!a) throw Error('Cuenta inexistente: ' + id);
    return a;
  };
  const party = (id: string) => {
    if (!s.financialParties.some((p) => p.id === id)) throw Error('Parte financiera inexistente.');
  };
  for (const m of s.memberships)
    if (!s.users.some((u) => u.id === m.userId)) throw Error('Miembro inexistente.');
  for (const a of s.accounts) {
    if (!s.institutions.some((i) => i.id === a.institutionId))
      throw Error('Institución inexistente.');
    if (['card', 'loan'].includes(a.category) && a.side !== 'liability')
      throw Error('La deuda debe ser un pasivo.');
  }
  for (const a of s.accounts) {
    for (const id of a.expectedInstrumentIds ?? []) {
      if (!s.instruments.some((i) => i.id === id && i.currency === a.currency))
        throw Error('Instrumento esperado inexistente o en otra moneda.');
    }
  }
  for (const b of s.sourceBindings) if (b.accountId) account(b.accountId);
  for (const o of [...s.balances, ...s.positions]) {
    const a = account(o.accountId);
    const b = s.sourceBindings.find((b) => b.id === o.bindingId);
    if (!b || (b.accountId && b.accountId !== a.id))
      throw Error('Vinculación de observación inválida.');
    if ('currency' in o && o.currency !== a.currency)
      throw Error('La moneda de la observación no coincide con la cuenta.');
    if ('amount' in o && new D(o.amount).decimalPlaces() > 8)
      throw Error('El monto admite hasta ocho decimales.');
    if ('quantity' in o && new D(o.quantity).decimalPlaces() > 12)
      throw Error('La cantidad admite hasta doce decimales.');
    if (
      'instrumentId' in o &&
      !s.instruments.some((i) => i.id === o.instrumentId && i.currency === a.currency)
    )
      throw Error('Instrumento o moneda inválidos.');
  }
  for (const p of s.prices) {
    if (!s.instruments.some((i) => i.id === p.instrumentId && i.currency === p.currency))
      throw Error('Precio con instrumento o moneda inválidos.');
    if (new D(p.amount).decimalPlaces() > 12) throw Error('El precio admite hasta doce decimales.');
  }
  for (const d of [
    ...s.ownershipDecisions,
    ...s.inclusionDecisions,
    ...s.resolutions,
    ...s.obligationEvents,
  ]) {
    if (!s.memberships.some((m) => m.userId === d.actorId && m.role === 'admin' && m.active))
      throw Error('La decisión requiere un administrador del hogar.');
    if ('accountId' in d) account(d.accountId);
    if ('partyId' in d) party(d.partyId);
  }
  for (const d of s.duplicates) {
    const target = account(d.candidateAccountId);
    const binding = s.sourceBindings.find((b) => b.id === d.bindingId);
    if (
      !binding ||
      binding.accountId !== null ||
      !s.balances.some((o) => o.bindingId === binding.id && o.accountId === target.id)
    )
      throw Error('Candidato duplicado inválido.');
  }
  for (const r of s.reviewTasks) account(r.accountId);
  for (const r of s.resolutions) {
    const task = s.reviewTasks.find((t) => t.id === r.reviewId);
    if (!task && !r.reviewId.startsWith('auto-')) throw Error('Revisión inexistente.');
    if (['bind', 'undo_binding'].includes(r.action) && task?.kind !== 'duplicate')
      throw Error('La decisión no corresponde a un duplicado.');
  }
  for (const a of s.manualAssets)
    if (account(a.accountId).side !== 'asset') throw Error('Activo manual inválido.');
  for (const l of s.liabilities)
    if (account(l.accountId).side !== 'liability') throw Error('Pasivo inválido.');
  for (const o of s.obligations) {
    const a = account(o.accountId);
    party(o.counterpartyId);
    if (
      a.valuationBasis !== 'obligation' ||
      a.currency !== o.currency ||
      a.side !== (o.direction === 'receivable' ? 'asset' : 'liability')
    )
      throw Error('Dirección de obligación inválida.');
    const events = s.obligationEvents.filter((e) => e.obligationId === o.id);
    let previous = '';
    for (const e of events) {
      if (e.currency !== o.currency || e.effectiveDate < previous)
        throw Error('Moneda o secuencia de eventos inválida.');
      previous = e.effectiveDate;
      if (e.linkedCashObservationId) {
        const cash = s.balances.find((b) => b.id === e.linkedCashObservationId);
        if (
          !cash ||
          !['bank', 'cash'].includes(account(cash.accountId).category) ||
          cash.currency !== e.currency
        )
          throw Error('Vínculo de pago inválido.');
      }
    }
    outstandingFromEvents(events);
  }
  for (const e of s.obligationEvents)
    if (!s.obligations.some((o) => o.id === e.obligationId)) throw Error('Obligación inexistente.');
  for (const a of s.accounts)
    if (
      a.valuationBasis === 'obligation' &&
      s.obligations.filter((o) => o.accountId === a.id).length !== 1
    )
      throw Error('Una cuenta requiere exactamente una obligación.');
  return s;
}
