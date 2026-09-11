import { z } from 'zod';
import { householdAccess } from '@/server/access';
import { body, origin, json, failure } from '@/server/http';
import { SupabaseRepository } from '@/persistence/supabase-repository';
import { householdFixture, type FixtureKind } from '@/data/households';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    origin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const { db, user } = await householdAccess(id, true);
    z.object({ confirm: z.literal(true) }).parse(await body(request));
    const { data: h, error } = await db
      .from('households')
      .select('name,fixture_kind')
      .eq('id', id)
      .single();
    if (error || !h) throw error;
    const repo = new SupabaseRepository(db, id);
    await repo.reset(householdFixture(id, h.name, user.id, h.fixture_kind as FixtureKind));
    return json({ state: await repo.load() });
  } catch (e) {
    return failure(e);
  }
}
