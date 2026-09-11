import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export function config() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Database configuration unavailable');
  return { url, key };
}
export async function supabaseServer() {
  const jar = await cookies();
  const { url, key } = config();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.APP_ORIGIN?.startsWith('https://') ?? false,
      path: '/',
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        for (const { name, value, options } of values) {
          try {
            jar.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.APP_ORIGIN?.startsWith('https://') ?? false,
            });
          } catch {
            /* Server component: proxy refreshes cookies. */
          }
        }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
