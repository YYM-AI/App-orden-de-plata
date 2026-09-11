import 'server-only';
import { supabaseServer } from './supabase';
export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function identity() {
  const db = await supabaseServer();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new AccessError(401, 'Tu sesión terminó. Vuelve a ingresar.');
  const { data: profile } = await db
    .from('profiles')
    .select('id,display_name,allowlisted')
    .eq('id', user.id)
    .single();
  if (!profile?.allowlisted) throw new AccessError(403, 'Tu acceso aún no está autorizado.');
  return { db, user, profile };
}
export async function householdAccess(id: string, owner = false) {
  const actor = await identity();
  const { data: membership } = await actor.db
    .from('household_memberships')
    .select('id,role')
    .eq('household_id', id)
    .eq('user_id', actor.user.id)
    .eq('active', true)
    .single();
  if (!membership || (owner && membership.role !== 'owner'))
    throw new AccessError(403, 'No tienes permiso para esta acción o este hogar.');
  return { ...actor, role: membership.role as 'owner' | 'helper' };
}
