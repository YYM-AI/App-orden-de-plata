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
      .object({ confirmation: z.string().min(2).max(100), irreversible: z.literal(true) })
      .parse(await body(request));
    const { error } = await db.rpc('delete_household', {
      p_household: id,
      p_confirmation: input.confirmation,
    });
    if (error)
      return json(
        {
          error:
            'No se pudo eliminar. Confirma el nombre e ingresa nuevamente para renovar tu sesión.',
        },
        403,
      );
    return json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
