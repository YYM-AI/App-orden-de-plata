import { z } from 'zod';
import { householdAccess } from '@/server/access';
import { body, origin, json, failure } from '@/server/http';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    origin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const { db } = await householdAccess(id, true);
    const input = z
      .object({ userId: z.uuid(), role: z.enum(['owner', 'helper']), active: z.boolean() })
      .parse(await body(request));
    const { error } = await db.rpc('set_membership', {
      p_household: id,
      p_user: input.userId,
      p_role: input.role,
      p_active: input.active,
    });
    if (error)
      return json(
        {
          error:
            error.code === '23514'
              ? 'El hogar debe conservar al menos un propietario.'
              : 'No pudimos autorizar ese usuario. Verifica su código de acceso.',
        },
        400,
      );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
