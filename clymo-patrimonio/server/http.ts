import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AccessError } from './access';
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' },
  });
}
export function origin(request: Request) {
  const trusted = process.env.APP_ORIGIN;
  if (!trusted || request.headers.get('origin') !== trusted)
    throw new AccessError(403, 'Solicitud no autorizada.');
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new AccessError(403, 'Solicitud no autorizada.');
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AccessError(415, 'Formato no admitido.');
  if (Number(request.headers.get('content-length') ?? 0) > 32000)
    throw new AccessError(413, 'Solicitud demasiado grande.');
  const text = await request.text();
  if (text.length > 32000) throw new AccessError(413, 'Solicitud demasiado grande.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AccessError(400, 'Solicitud inválida.');
  }
}
export function failure(error: unknown) {
  if (error instanceof AccessError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError) {
    const message = error.issues.find((issue) => issue.code === 'custom')?.message;
    return json({ error: message ?? 'Revisa los datos ingresados.' }, 400);
  }
  return json({ error: 'No pudimos completar la operación. Recarga e inténtalo nuevamente.' }, 400);
}
// Best-effort process limiter supplements Supabase Auth's provider-enforced limits.
const attempts = new Map<string, { count: number; until: number }>();
export function limit(key: string, max = 12) {
  const now = Date.now();
  if (attempts.size > 1000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const entry = attempts.get(key);
  if (!entry || entry.until < now) {
    attempts.set(key, { count: 1, until: now + 60000 });
    return;
  }
  if (++entry.count > max)
    throw new AccessError(429, 'Espera un minuto antes de volver a intentar.');
}
