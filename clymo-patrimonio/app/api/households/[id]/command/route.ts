import { z } from 'zod';
import { householdAccess } from '@/server/access';
import { body, origin, json, failure } from '@/server/http';
import { applyCommand, commandSchema } from '@/domain/commands';
import { DatabaseError, SupabaseRepository } from '@/persistence/supabase-repository';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    origin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const { db, user } = await householdAccess(id, true);
    const input = z
      .object({
        command: commandSchema,
        revision: z.number().int().nonnegative(),
        commandId: z.uuid(),
      })
      .parse(await body(request));
    const repo = new SupabaseRepository(db, id, input.commandId, input.command.type);
    const current = await repo.load();
    if (!current) throw new Error('missing');
    if (current.appliedCommands.includes(input.commandId)) return json({ state: current });
    if (current.revision !== input.revision)
      return json({ error: 'Otra sesión cambió el hogar. Recarga antes de guardar.' }, 409);
    let next;
    try {
      next = applyCommand(current, input.command, {
        id: input.commandId,
        actorId: user.id,
        recordedAt: new Date().toISOString(),
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Cambio inválido.' }, 400);
    }
    await repo.save(next, input.revision);
    return json({ state: await repo.load() });
  } catch (e) {
    if (e instanceof DatabaseError && e.code === '40001') return json({ error: e.message }, 409);
    return failure(e);
  }
}
