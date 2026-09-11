import { z } from 'zod';
import { householdAccess } from '@/server/access';
import { json, failure } from '@/server/http';
import { SupabaseRepository } from '@/persistence/supabase-repository';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    z.uuid().parse(id);
    const { db, role, user } = await householdAccess(id);
    const state = await new SupabaseRepository(db, id).load();
    return json({ state, role, userId: user.id });
  } catch (e) {
    return failure(e);
  }
}
