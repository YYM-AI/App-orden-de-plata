import { supabaseServer } from '@/server/supabase';
import { origin, json, failure } from '@/server/http';
export async function POST(request: Request) {
  try {
    origin(request);
    const db = await supabaseServer();
    await db.auth.signOut();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
