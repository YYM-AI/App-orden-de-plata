import { z } from 'zod';
import {
  D,
  dateSchema,
  decimalSchema,
  currencySchema,
  idSchema,
  percentageSchema,
  reportingCurrencySchema,
  timestampSchema,
  type DemoState,
} from './model';
import { calculateSnapshot, latest, reviewQueue } from './engine';
import { validateState, outstandingFromEvents } from './validation';
const amount = decimalSchema.refine((v) => new D(v).decimalPlaces() <= 8, 'Usa hasta 8 decimales.');
const reason = z.string().trim().min(3).max(300);
const entry = {
  name: z.string().trim().min(2).max(80),
  amount: amount.refine((v) => new D(v).gt(0), 'El monto debe ser mayor que cero.'),
  currency: currencySchema,
  percentage: percentageSchema,
  effectiveDate: dateSchema,
};
export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_manual'),
    ...entry,
    side: z.enum(['asset', 'liability']),
    category: z.enum([
      'bank',
      'cash',
      'investment',
      'deposit',
      'obligation',
      'loan',
      'card',
      'other',
    ]),
  }),
  z.object({
    type: z.literal('observe'),
    accountId: idSchema,
    amount,
    effectiveDate: dateSchema,
    reason,
  }),
  z.object({
    type: z.literal('ownership'),
    accountId: idSchema,
    percentage: percentageSchema,
    status: z.enum(['confirmed', 'unknown', 'disputed']),
    effectiveDate: dateSchema,
    reason,
  }),
  z.object({
    type: z.literal('inclusion'),
    accountId: idSchema,
    include: z.boolean(),
    effectiveDate: dateSchema,
    reason,
  }),
  z.object({
    type: z.literal('obligation_event'),
    obligationId: idSchema,
    kind: z.enum(['repayment', 'adjustment', 'forgiveness', 'write_off', 'settlement', 'dispute']),
    amount,
    effectiveDate: dateSchema,
    reason,
    adjustmentDirection: z.enum(['increase', 'decrease']).optional(),
    cashAccountId: idSchema.optional(),
  }),
  z.object({
    type: z.literal('review'),
    reviewId: idSchema,
    action: z.enum(['bind', 'undo_binding', 'acknowledge', 'reopen']),
    effectiveDate: dateSchema,
    reason,
  }),
  z.object({
    type: z.literal('settings'),
    reportingCurrency: reportingCurrencySchema.optional(),
    obligationsVisible: z.boolean().optional(),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export interface CommandContext {
  id: string;
  recordedAt: string;
  actorId: string;
}

export function applyCommand(input: DemoState, raw: Command, context: CommandContext): DemoState {
  const current = validateState(input);
  const command = commandSchema.parse(raw);
  idSchema.parse(context.id);
  timestampSchema.parse(context.recordedAt);
  if (
    !current.memberships.some((m) => m.userId === context.actorId && m.active && m.role === 'admin')
  )
    throw Error('El ayudante tiene acceso de lectura; no puede registrar cambios.');
  if (current.appliedCommands.includes(context.id)) return current;
  if ('effectiveDate' in command && command.effectiveDate > current.cutoff)
    throw Error('La fecha no puede ser posterior al corte ficticio del 4 de septiembre de 2026.');
  const s = structuredClone(current);
  const base = {
    householdId: s.household.id,
    actorId: context.actorId,
    recordedAt: context.recordedAt,
    effectiveDate: 'effectiveDate' in command ? command.effectiveDate : s.cutoff,
  };
  const account = (id: string) => {
    const a = s.accounts.find((a) => a.id === id);
    if (!a) throw Error('No encontramos esa fuente.');
    return a;
  };
  const ensureManualBinding = (accountId: string) => {
    const existing = s.sourceBindings.find(
      (b) => b.accountId === accountId && b.method === 'manual',
    );
    if (existing) return existing.id;
    const id = `${context.id}-binding`;
    s.sourceBindings.push({
      id,
      householdId: s.household.id,
      accountId,
      name: 'Actualización manual ficticia',
      method: 'manual',
      priority: 20,
    });
    return id;
  };
  const addBalance = (accountId: string, value: string, id: string) => {
    const a = account(accountId);
    const bindingId = ensureManualBinding(accountId);
    s.balances.push({
      id,
      householdId: s.household.id,
      accountId,
      bindingId,
      amount: value,
      currency: a.currency,
      kind: a.valuationBasis === 'component_sum' ? 'cash' : 'balance',
      effectiveDate: base.effectiveDate,
      recordedAt: base.recordedAt,
      source: 'Ingreso manual ficticio',
      entryReason: 'reason' in command ? command.reason : 'Nueva fuente Demo',
      synthetic: true,
    });
  };
  switch (command.type) {
    case 'add_manual': {
      if (['card', 'loan'].includes(command.category) && command.side !== 'liability')
        throw Error('Tarjetas y créditos son pasivos.');
      if (
        ['bank', 'cash', 'deposit', 'investment'].includes(command.category) &&
        command.side !== 'asset'
      )
        throw Error('Esa categoría corresponde a un activo.');
      const id = `${context.id}-account`;
      s.accounts.push({
        id,
        householdId: s.household.id,
        institutionId: 'manual',
        name: command.name,
        maskedIdentifier: 'DEMO-MANUAL',
        currency: command.currency,
        side: command.side,
        category: command.category,
        manual: true,
        valuationBasis: command.category === 'obligation' ? 'obligation' : 'manual',
      });
      s.ownershipDecisions.push({
        ...base,
        id: `${context.id}-ownership`,
        accountId: id,
        partyId: 'party-household',
        householdPercentage: command.percentage,
        status: 'confirmed',
        reason: 'Propiedad confirmada al crear una fuente ficticia.',
      });
      if (command.side === 'asset')
        s.manualAssets.push({
          id: `${context.id}-asset`,
          householdId: s.household.id,
          accountId: id,
          description: command.name,
        });
      else
        s.liabilities.push({
          id: `${context.id}-liability`,
          householdId: s.household.id,
          accountId: id,
          principalOnly: true,
        });
      if (command.category === 'obligation') {
        if (!s.settings.obligationsVisible)
          throw Error('Activa primero las obligaciones personales.');
        const obligationId = `${context.id}-obligation`,
          partyId = `${context.id}-party`;
        s.financialParties.push({
          id: partyId,
          householdId: s.household.id,
          label: command.name,
          role: 'counterparty',
        });
        s.obligations.push({
          id: obligationId,
          householdId: s.household.id,
          accountId: id,
          counterpartyId: partyId,
          direction: command.side === 'asset' ? 'receivable' : 'payable',
          currency: command.currency,
          unverified: true,
          shared: false,
        });
        s.obligationEvents.push({
          ...base,
          id: `${context.id}-initial`,
          obligationId,
          kind: 'initial',
          amount: command.amount,
          currency: command.currency,
          reason: 'Capital inicial de una obligación ficticia.',
        });
        ensureManualBinding(id);
      } else addBalance(id, command.amount, `${context.id}-balance`);
      break;
    }
    case 'observe': {
      const a = account(command.accountId);
      if (a.valuationBasis === 'obligation')
        throw Error('El saldo de una obligación se cambia mediante eventos.');
      addBalance(a.id, command.amount, `${context.id}-observation`);
      break;
    }
    case 'ownership':
      account(command.accountId);
      s.ownershipDecisions.push({
        ...base,
        id: `${context.id}-ownership`,
        accountId: command.accountId,
        partyId: 'party-household',
        householdPercentage: command.percentage,
        status: command.status,
        reason: command.reason,
      });
      break;
    case 'inclusion': {
      const a = account(command.accountId);
      if (!a.manual) throw Error('Esta acción está disponible para fuentes manuales.');
      s.inclusionDecisions.push({
        ...base,
        id: `${context.id}-inclusion`,
        accountId: a.id,
        include: command.include,
        reason: command.reason,
      });
      if (
        command.include &&
        !calculateSnapshot(s).components.find((c) => c.accountId === a.id)?.included
      )
        throw Error(
          'La fuente debe tener propiedad, fecha y conversión elegibles antes de incluirla.',
        );
      break;
    }
    case 'obligation_event': {
      if (!s.settings.obligationsVisible)
        throw Error('Activa las obligaciones personales para registrar eventos.');
      const o = s.obligations.find((o) => o.id === command.obligationId);
      if (!o) throw Error('No encontramos la obligación.');
      const events = s.obligationEvents.filter((e) => e.obligationId === o.id);
      if (events.some((e) => e.effectiveDate > command.effectiveDate))
        throw Error('La fecha debe ser igual o posterior al último evento.');
      const event = {
        ...base,
        id: `${context.id}-event`,
        obligationId: o.id,
        kind: command.kind,
        amount: command.amount,
        currency: o.currency,
        reason: command.reason,
        adjustmentDirection: command.adjustmentDirection,
        linkedCashObservationId: undefined as string | undefined,
      };
      outstandingFromEvents([...events, event]);
      if (command.cashAccountId) {
        if (!['repayment', 'settlement'].includes(command.kind))
          throw Error('Solo un pago o liquidación puede vincularse a efectivo.');
        const cash = account(command.cashAccountId);
        const snapshot = calculateSnapshot(s);
        const c = snapshot.components.find((c) => c.accountId === cash.id)!;
        const own = latest(
          s.ownershipDecisions.filter((d) => d.accountId === o.accountId),
          s.cutoff,
        );
        if (
          !['bank', 'cash'].includes(cash.category) ||
          cash.side !== 'asset' ||
          cash.currency !== o.currency ||
          !c.included ||
          !new D(c.ownershipPercentage ?? '0').eq(100) ||
          !new D(own?.householdPercentage ?? '0').eq(100) ||
          own?.status !== 'confirmed'
        )
          throw Error(
            'Vincula una cuenta de efectivo vigente, de la misma moneda y con 100% de propiedad, igual que la obligación.',
          );
        if (command.effectiveDate < (c.effectiveDate ?? s.cutoff))
          throw Error('El pago no puede anteceder al saldo de efectivo seleccionado.');
        const next =
          o.direction === 'receivable'
            ? new D(c.originalAmount!).plus(command.amount)
            : new D(c.originalAmount!).minus(command.amount);
        if (next.lt(0)) throw Error('La cuenta no tiene suficiente efectivo ficticio.');
        event.linkedCashObservationId = `${context.id}-cash`;
        addBalance(cash.id, next.toFixed(), event.linkedCashObservationId);
      }
      s.obligationEvents.push(event);
      break;
    }
    case 'review': {
      const task = reviewQueue(s).find((t) => t.id === command.reviewId);
      if (!task) throw Error('No encontramos la revisión.');
      if (['bind', 'undo_binding'].includes(command.action) && task.kind !== 'duplicate')
        throw Error('Esta revisión no corresponde a un duplicado.');
      s.resolutions.push({
        ...base,
        id: `${context.id}-resolution`,
        reviewId: task.id,
        action: command.action,
        reason: command.reason,
      });
      break;
    }
    case 'settings':
      if (command.reportingCurrency) s.settings.reportingCurrency = command.reportingCurrency;
      if (command.obligationsVisible !== undefined)
        s.settings.obligationsVisible = command.obligationsVisible;
      break;
  }
  s.appliedCommands.push(context.id);
  s.revision++;
  return validateState(s);
}
