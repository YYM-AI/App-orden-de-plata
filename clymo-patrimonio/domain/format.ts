import { D, type Currency } from './model';
export function money(value: string | null, currency: Currency): string {
  if (value === null) return 'Conversión no disponible';
  const precision = currency === 'CLP' ? 0 : currency === 'CLF' ? 4 : 2;
  const [integer, fraction] = new D(value).toFixed(precision).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${currency === 'CLF' ? 'UF' : currency} ${grouped}${fraction ? ',' + fraction : ''}`;
}
export function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
}
