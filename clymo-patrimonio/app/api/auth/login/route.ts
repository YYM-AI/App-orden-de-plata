import { z } from 'zod';
import { supabaseServer } from '@/server/supabase';
import { body, origin, json, failure, limit } from '@/server/http';
export async function POST(request: Request) {
  try {
    origin(request);
    const input = z
      .object({ email: z.email().max(254), password: z.string().min(1).max(256) })
      .parse(await body(request));
    limit(input.email.toLowerCase());
    const db = await supabaseServer();
    const { data, error } = await db.auth.signInWithPassword(input);
    if (error || !data.user)
      return json({ error: 'No pudimos ingresar. Revisa tus datos o solicita acceso.' }, 401);
    const { data: profile } = await db
      .from('profiles')
      .select('allowlisted')
      .eq('id', data.user.id)
      .single();
    if (!profile?.allowlisted) {
      await db.auth.signOut();
      return json({ error: 'Tu acceso aún no está autorizado.' }, 403);
    }
    const { data: memberships } = await db
      .from('household_memberships')
      .select('household_id')
      .eq('user_id', data.user.id)
      .eq('active', true);
    for (const membership of memberships ?? [])
      await db.rpc('record_audit', { p_household: membership.household_id, p_event: 'session' });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
