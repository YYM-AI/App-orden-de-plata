import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { hostedConfig, hostedConnection } from './hosted-config';
import { householdFixture } from '../data/households';
import { calculateSnapshot } from '../domain/engine';
const hosted = hostedConfig();
const url = hosted.supabaseUrl;
const admin = createClient(url, hosted.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pg = hostedConnection();
await pg.connect();
const file = '.local/hosted-test-accounts.json';
type Account = { id: string; email: string; password: string };
const accounts: Record<string, Account> = existsSync(file)
  ? JSON.parse(readFileSync(file, 'utf8'))
  : {};
const names = {
  ownerA: 'Propietario A Demo',
  helperA: 'Ayudante A Demo',
  ownerB: 'Propietario Norte Demo',
  helperB: 'Ayudante Norte Demo',
  ownerC: 'Propietario Vacío Demo',
  outsider: 'Usuario ajeno Demo',
  unapproved: 'Usuario sin autorización',
};
try {
  const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw Error('Hosted Auth admin API unavailable.');
  if (listed.data.users.some((u) => !u.email?.endsWith('@staging.clymo.test')))
    throw Error('Refusing to seed a project containing non-demonstration Auth identities.');
  for (const [key, name] of Object.entries(names)) {
    const email = `${key.toLowerCase()}@staging.clymo.test`;
    const previous = listed.data.users.find((u) => u.email === email);
    const password = accounts[key]?.password ?? randomBytes(30).toString('base64url');
    let id = previous?.id;
    if (!id) {
      const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (r.error || !r.data.user) throw Error(`Could not create hosted test identity ${key}.`);
      id = r.data.user.id;
    } else if (!accounts[key]) {
      const r = await admin.auth.admin.updateUserById(id, { password });
      if (r.error) throw Error('Could not reset hosted-only test identity.');
    }
    accounts[key] = { id, email, password };
    writeFileSync(file, JSON.stringify(accounts, null, 2), { mode: 0o600 });
    chmodSync(file, 0o600);
    await pg.query(
      'insert into public.profiles(id,display_name,allowlisted) values($1,$2,$3) on conflict(id) do update set display_name=excluded.display_name,allowlisted=excluded.allowlisted',
      [id, name, key !== 'unapproved'],
    );
  }
  writeFileSync(file, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
  const households = [
    [
      'A',
      '11111111-1111-4111-8111-111111111111',
      'Familia Demo Clymo',
      'canonical',
      'ownerA',
      'helperA',
    ],
    [
      'B',
      '22222222-2222-4222-8222-222222222222',
      'Familia Norte Demo',
      'north',
      'ownerB',
      'helperB',
    ],
    ['C', '33333333-3333-4333-8333-333333333333', 'Hogar Vacío Demo', 'empty', 'ownerC', null],
  ] as const;
  for (const [label, id, name, kind, owner, helper] of households) {
    const db = createClient(url, hosted.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await db.auth.signInWithPassword(accounts[owner]);
    if (login.error) throw Error(`Hosted sign-in failed for ${owner}.`);
    const state = householdFixture(id, name, accounts[owner].id, kind);
    const created = await db.rpc('create_household', {
      p_household: id,
      p_state: state,
      p_snapshot: calculateSnapshot(state),
      p_kind: kind,
    });
    if (created.error)
      throw Error(`Household ${label} seed failed: ${created.error.code} ${created.error.message}`);
    if (helper) {
      const r = await db.rpc('set_membership', {
        p_household: id,
        p_user: accounts[helper].id,
        p_role: 'helper',
        p_active: true,
      });
      if (r.error) throw Error('Helper authorization failed.');
    }
    console.log(`Household ${label} seeded idempotently (${kind}).`);
    await db.auth.signOut();
  }
  console.log(
    'Seven hosted synthetic Auth identities are ready. Credentials remain only in .local/hosted-test-accounts.json (mode 0600).',
  );
} finally {
  await pg.end();
}
