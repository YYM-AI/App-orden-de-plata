import { z } from 'zod';
import Decimal from 'decimal.js';

export const D = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_UP });
export const idSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Fecha inválida');
export const timestampSchema = z.iso.datetime();
export const decimalSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,29})(\.\d{1,16})?$/,
    'Usa un valor positivo con punto decimal y sin separadores de miles.',
  );
export const positiveSchema = decimalSchema.refine(
  (v) => new D(v).gt(0),
  'El monto debe ser mayor que cero.',
);
export const percentageSchema = decimalSchema.refine(
  (v) => new D(v).lte(100),
  'La propiedad debe estar entre 0 y 100%.',
);
export const currencySchema = z.enum(['CLP', 'USD', 'EUR', 'CLF']);
export const reportingCurrencySchema = z.enum(['CLP', 'USD']);
export type Currency = z.infer<typeof currencySchema>;
export type ReportingCurrency = z.infer<typeof reportingCurrencySchema>;
const label = z.string().trim().min(2).max(100);
const reason = z.string().trim().min(3).max(300);
const identified = { id: idSchema };
const householdOwned = { ...identified, householdId: idSchema };
const dated = { effectiveDate: dateSchema, recordedAt: timestampSchema };
const decision = { ...householdOwned, ...dated, actorId: idSchema, reason };

export const householdSchema = z.object({ ...identified, name: label, synthetic: z.literal(true) });
export const userSchema = z.object({ ...identified, displayName: label });
export const financialPartySchema = z.object({
  ...householdOwned,
  label,
  role: z.enum(['owner', 'counterparty']),
});
export const membershipSchema = z.object({
  ...householdOwned,
  userId: idSchema,
  role: z.enum(['admin', 'viewer']),
  active: z.boolean(),
});
export const institutionSchema = z.object({
  ...identified,
  name: label,
  country: z.string().length(2),
  synthetic: z.literal(true),
});
export const accountSchema = z.object({
  ...householdOwned,
  institutionId: idSchema,
  name: label,
  maskedIdentifier: z.string().startsWith('DEMO-'),
  currency: currencySchema,
  side: z.enum(['asset', 'liability']),
  category: z.enum([
    'bank',
    'cash',
    'investment',
    'deposit',
    'obligation',
    'property',
    'loan',
    'card',
    'other',
  ]),
  valuationBasis: z.enum(['statement_total', 'component_sum', 'manual', 'obligation']),
  propertyPairId: idSchema.optional(),
  expectedInstrumentIds: z.array(idSchema).optional(),
  manual: z.boolean(),
});
export const sourceBindingSchema = z.object({
  ...householdOwned,
  accountId: idSchema.nullable(),
  name: label,
  method: z.enum(['synthetic_statement', 'manual']),
  priority: z.number().int().nonnegative(),
});
export const rawObservationSchema = z.object({
  ...householdOwned,
  ...dated,
  accountId: idSchema,
  bindingId: idSchema,
  source: label,
  synthetic: z.literal(true),
  entryReason: reason.optional(),
});
export const balanceObservationSchema = rawObservationSchema.extend({
  amount: decimalSchema,
  currency: currencySchema,
  kind: z.enum(['balance', 'cash', 'account_total', 'credit_limit']),
});
export const instrumentSchema = z.object({
  ...identified,
  name: label,
  currency: currencySchema,
  fictionalTicker: z.string().startsWith('DEMO'),
  confirmed: z.boolean(),
});
export const positionObservationSchema = rawObservationSchema.extend({
  instrumentId: idSchema,
  quantity: decimalSchema,
});
export const priceObservationSchema = z.object({
  ...identified,
  ...dated,
  instrumentId: idSchema,
  amount: positiveSchema,
  currency: currencySchema,
  source: label,
  approved: z.boolean(),
});
export const exchangeRateSchema = z
  .object({
    ...identified,
    ...dated,
    base: currencySchema,
    quote: currencySchema,
    rate: positiveSchema,
    source: label,
    approved: z.boolean(),
  })
  .refine((v) => v.base !== v.quote, 'El par debe tener monedas distintas.');
export const ufValueSchema = z.object({
  ...identified,
  ...dated,
  unit: z.literal('CLF'),
  clpValue: positiveSchema,
  source: label,
  approved: z.boolean(),
});
export const ownershipDecisionSchema = z.object({
  ...decision,
  accountId: idSchema,
  partyId: idSchema,
  householdPercentage: percentageSchema,
  status: z.enum(['confirmed', 'unknown', 'disputed']),
});
export const inclusionDecisionSchema = z.object({
  ...decision,
  accountId: idSchema,
  include: z.boolean(),
});
export const manualAssetSchema = z.object({
  ...householdOwned,
  accountId: idSchema,
  description: label,
});
export const liabilitySchema = z.object({
  ...householdOwned,
  accountId: idSchema,
  principalOnly: z.literal(true),
});
export const obligationSchema = z.object({
  ...householdOwned,
  accountId: idSchema,
  counterpartyId: idSchema,
  direction: z.enum(['receivable', 'payable']),
  currency: currencySchema,
  unverified: z.literal(true),
  shared: z.literal(false),
});
export const obligationEventSchema = z.object({
  ...decision,
  obligationId: idSchema,
  currency: currencySchema,
  kind: z.enum([
    'initial',
    'repayment',
    'adjustment',
    'forgiveness',
    'write_off',
    'settlement',
    'dispute',
  ]),
  amount: decimalSchema,
  adjustmentDirection: z.enum(['increase', 'decrease']).optional(),
  linkedCashObservationId: idSchema.optional(),
});
export const duplicateCandidateSchema = z.object({
  ...householdOwned,
  bindingId: idSchema,
  candidateAccountId: idSchema,
  evidence: z.array(reason).min(1),
});
export const reviewTaskSchema = z.object({
  ...householdOwned,
  accountId: idSchema,
  kind: z.enum([
    'duplicate',
    'missing_rate',
    'stale',
    'property',
    'ownership',
    'missing_price',
    'inclusion',
  ]),
  title: label,
  detail: reason,
  candidateId: idSchema.optional(),
});
export const resolutionDecisionSchema = z.object({
  ...decision,
  reviewId: idSchema,
  action: z.enum(['bind', 'undo_binding', 'acknowledge', 'reopen']),
});
export const freshnessRuleSchema = z
  .object({
    currentDays: z.number().int().nonnegative(),
    warningDays: z.number().int().nonnegative(),
    maxDays: z.number().int().nonnegative(),
    businessDays: z.boolean(),
  })
  .refine((r) => r.currentDays <= r.warningDays && r.warningDays <= r.maxDays);
export const policySchema = z.object({
  version: z.string(),
  allowUnverifiedObligations: z.boolean(),
  statement: freshnessRuleSchema,
  quantity: freshnessRuleSchema,
  price: freshnessRuleSchema,
  rate: freshnessRuleSchema,
  manual: freshnessRuleSchema,
  holidays: z.array(dateSchema),
});
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  cutoff: dateSchema,
  household: householdSchema,
  users: z.array(userSchema),
  financialParties: z.array(financialPartySchema),
  memberships: z.array(membershipSchema),
  institutions: z.array(institutionSchema),
  accounts: z.array(accountSchema),
  sourceBindings: z.array(sourceBindingSchema),
  balances: z.array(balanceObservationSchema),
  instruments: z.array(instrumentSchema),
  positions: z.array(positionObservationSchema),
  prices: z.array(priceObservationSchema),
  rates: z.array(exchangeRateSchema),
  ufValues: z.array(ufValueSchema),
  ownershipDecisions: z.array(ownershipDecisionSchema),
  inclusionDecisions: z.array(inclusionDecisionSchema),
  manualAssets: z.array(manualAssetSchema),
  liabilities: z.array(liabilitySchema),
  obligations: z.array(obligationSchema),
  obligationEvents: z.array(obligationEventSchema),
  duplicates: z.array(duplicateCandidateSchema),
  reviewTasks: z.array(reviewTaskSchema),
  resolutions: z.array(resolutionDecisionSchema),
  policy: policySchema,
  settings: z.object({
    reportingCurrency: reportingCurrencySchema,
    obligationsVisible: z.boolean(),
  }),
  appliedCommands: z.array(idSchema),
});
export type Household = z.infer<typeof householdSchema>;
export type User = z.infer<typeof userSchema>;
export type FinancialParty = z.infer<typeof financialPartySchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type Institution = z.infer<typeof institutionSchema>;
export type LogicalAccount = z.infer<typeof accountSchema>;
export type SourceBinding = z.infer<typeof sourceBindingSchema>;
export type RawObservation = z.infer<typeof rawObservationSchema>;
export type BalanceObservation = z.infer<typeof balanceObservationSchema>;
export type Instrument = z.infer<typeof instrumentSchema>;
export type PositionObservation = z.infer<typeof positionObservationSchema>;
export type PriceObservation = z.infer<typeof priceObservationSchema>;
export type ExchangeRate = z.infer<typeof exchangeRateSchema>;
export type UFValue = z.infer<typeof ufValueSchema>;
export type OwnershipDecision = z.infer<typeof ownershipDecisionSchema>;
export type InclusionDecision = z.infer<typeof inclusionDecisionSchema>;
export type ManualAsset = z.infer<typeof manualAssetSchema>;
export type Liability = z.infer<typeof liabilitySchema>;
export type PersonalObligation = z.infer<typeof obligationSchema>;
export type ObligationEvent = z.infer<typeof obligationEventSchema>;
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;
export type ReviewTask = z.infer<typeof reviewTaskSchema>;
export type ResolutionDecision = z.infer<typeof resolutionDecisionSchema>;
export type FreshnessRule = z.infer<typeof freshnessRuleSchema>;
export type Policy = z.infer<typeof policySchema>;
export type DemoState = z.infer<typeof stateSchema>;
export type Freshness = 'current' | 'stale' | 'urgent' | 'expired' | 'future';
export interface ConversionStep {
  from: Currency;
  to: Currency;
  rate: string;
  operation: 'multiply' | 'divide';
  effectiveDate: string;
  recordedAt: string;
  source: string;
  rateId: string;
}
export interface ValuationComponent {
  id: string;
  accountId: string;
  side: 'asset' | 'liability';
  originalAmount: string | null;
  originalCurrency: Currency;
  reportingValue: string | null;
  reportingCurrency: ReportingCurrency;
  ownershipPercentage: string | null;
  included: boolean;
  reasons: string[];
  freshness: Freshness;
  method: string;
  effectiveDate: string | null;
  quantityDate?: string;
  priceDate?: string;
  fxDate?: string;
  recordedAt?: string;
  observationIds: string[];
  sources: string[];
  conversions: ConversionStep[];
  steps: string[];
  liquidOriginal: string;
  liquidReporting: string;
  decisionIds: string[];
}
export interface NetWorthSnapshot {
  cutoff: string;
  valuationTime: string;
  policyVersion: string;
  reportingCurrency: ReportingCurrency;
  assets: string;
  liabilities: string;
  netWorth: string;
  liquidCash: string;
  components: ValuationComponent[];
  includedCount: number;
  excludedCount: number;
  oldestIncludedDate: string | null;
  partial: boolean;
}
