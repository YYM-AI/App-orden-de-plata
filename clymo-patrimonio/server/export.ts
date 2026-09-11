import type { DemoState } from '@/domain/model';
import { calculateSnapshot } from '@/domain/engine';
export function csvCell(value: unknown) {
  const original = String(value ?? '');
  const safe =
    /^[=+\-@\t\r\n]/.test(original.trimStart()) || /^[\t\r\n]/.test(original)
      ? "'" + original
      : original;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function householdCsv(state: DemoState, generatedAt: string) {
  const snapshot = calculateSnapshot(state);
  const header = [
    'versión',
    'generado_UTC',
    'hogar_id',
    'solo_datos_ficticios',
    'moneda_presentación',
    'fuente',
    'institución',
    'lado',
    'moneda_original',
    'valor_original',
    'propiedad_porcentaje',
    'valor_hogar',
    'fecha_efectiva',
    'incluida',
    'motivos',
    'origen',
  ];
  const rows = snapshot.components.map((c) => {
    const a = state.accounts.find((a) => a.id === c.accountId)!;
    return [
      'clymo-export-2',
      generatedAt,
      state.household.id,
      'SÍ',
      snapshot.reportingCurrency,
      a.name,
      state.institutions.find((i) => i.id === a.institutionId)?.name,
      c.side,
      c.originalCurrency,
      c.originalAmount,
      c.ownershipPercentage,
      c.reportingValue,
      c.effectiveDate,
      c.included ? 'SÍ' : 'NO',
      c.reasons.join(' | '),
      c.sources.join(' | '),
    ];
  });
  return (
    '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  );
}
