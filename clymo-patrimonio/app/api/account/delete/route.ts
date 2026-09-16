import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer, config } from '@/server/supabase';
import { body, origin, json, failure } from '@/server/http';
export async function POST(request: Request) {
  try {
    origin(request);
    z.object({
      confirmation: z.literal('ELIMINAR MI CUENTA'),
      irreversible: z.literal(true),
    }).parse(await body(request));
    const db = await supabaseServer();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return json({ error: 'Ingresa nuevamente para continuar.' }, 401);
    const { data: profile } = await db
      .from('profiles')
      .select('allowlisted,deletion_requested_at')
      .eq('id', user.id)
      .single();
    if (!profile) return json({ error: 'Acceso no autorizado.' }, 403);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key)
      return json(
        {
          error:
            'La eliminación de cuenta requiere la configuración administrativa segura del servidor.',
        },
        503,
      );
    if (!profile.deletion_requested_at) {
      const { error } = await db.rpc('prepare_account_deletion');
      if (error)
        return json(
          {
            error:
              'Ingresa nuevamente y resuelve primero los hogares donde eres el único propietario.',
          },
          403,
        );
    }
    const admin = createClient(config().url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error)
      return json(
        { error: 'Tu acceso quedó desactivado. Vuelve a intentar la eliminación de la cuenta.' },
        503,
      );
    await db.auth.signOut();
    return json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
