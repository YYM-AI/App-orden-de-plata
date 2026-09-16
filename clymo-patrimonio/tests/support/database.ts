import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { hostedConfig, hostedConnection } from '../../scripts/hosted-config';
const hosted = process.env.CLYMO_DB_TEST_TARGET === 'hosted-synthetic';
if (hosted) {
  const c = hostedConfig();
  process.env.SUPABASE_URL = c.supabaseUrl;
  process.env.SUPABASE_ANON_KEY = c.anonKey;
} else {
  process.loadEnvFile('.env.local');
  if (!['localhost', '127.0.0.1'].includes(new URL(process.env.SUPABASE_URL!).hostname))
    throw Error('Default database tests are restricted to the isolated local synthetic stack.');
}
export const accounts: Record<string, { id: string; email: string; password: string }> = JSON.parse(
  readFileSync(hosted ? '.local/hosted-test-accounts.json' : '.local/test-accounts.json', 'utf8'),
);
export const households = {
  A: '11111111-1111-4111-8111-111111111111',
  B: '22222222-2222-4222-8222-222222222222',
  C: '33333333-3333-4333-8333-333333333333',
};
export const connection = () =>
  hosted ? hostedConnection() : new Client({ connectionString: process.env.DATABASE_URL });
export const client = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export async function signedIn(key: string) {
  const db = client(),
    a = accounts[key];
  const { data, error } = await db.auth.signInWithPassword({
    email: a.email,
    password: a.password,
  });
  if (error || !data.session) throw Error(`Synthetic sign-in failed (${key}, ${error?.code}).`);
  const claims = JSON.parse(
    Buffer.from(data.session.access_token.split('.')[1], 'base64url').toString(),
  );
  return { db, claims };
}
