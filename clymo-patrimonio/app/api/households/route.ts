import { z } from 'zod';
import { identity } from '@/server/access';
import { json, failure, body, origin } from '@/server/http';
import { householdFixture } from '@/data/households';
import { calculateSnapshot } from '@/domain/engine';
export async function GET() {
  try {
    const { db, user, profile } = await identity();
    const { data, error } = await db
      .from('household_memberships')
      .select('household_id,role,households(id,name,fixture_kind)')
      .eq('user_id', user.id)
      .eq('active', true);
    if (error) throw error;
    return json({ user: { id: user.id, displayName: profile.display_name }, memberships: data });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    origin(request);
    const { name } = z
      .object({ name: z.string().trim().min(2).max(80) })
      .parse(await body(request));
    const { db, user } = await identity();
    const id = crypto.randomUUID();
    const s = householdFixture(id, name, user.id, 'empty');
    const { error } = await db.rpc('create_household', {
      p_household: id,
      p_state: s,
      p_snapshot: calculateSnapshot(s),
      p_kind: 'empty',
    });
    if (error) throw error;
    return json({ id }, 201);
  } catch (e) {
    return failure(e);
  }
}
