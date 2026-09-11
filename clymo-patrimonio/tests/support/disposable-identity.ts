// Node-only E2E fixture provisioning. Never imported by application routes or browser code.
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { connection } from './database';
export async function disposableIdentity() {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `disposable-${randomUUID()}@clymo.test`,
    password = randomBytes(30).toString('base64url');
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error || !r.data.user) throw Error('Local disposable identity setup failed.');
  const id = r.data.user.id;
  const pg = connection();
  await pg.connect();
  try {
    await pg.query(
      "insert into public.profiles(id,display_name,allowlisted) values($1,'Cuenta desechable Demo',true)",
      [id],
    );
  } finally {
    await pg.end();
  }
  return { id, email, password, admin };
}
