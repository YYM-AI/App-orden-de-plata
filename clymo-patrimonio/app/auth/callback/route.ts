import { NextResponse } from 'next/server';
import { supabaseServer } from '@/server/supabase';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = new URL('/login?error=callback', process.env.APP_ORIGIN ?? url.origin);
  // No caller-controlled redirect target is accepted.
  if (code && code.length < 2048) {
    const db = await supabaseServer();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: p } = await db
        .from('profiles')
        .select('allowlisted')
        .eq('id', data.user.id)
        .single();
      if (p?.allowlisted) {
        destination.pathname = '/';
        destination.search = '';
      } else await db.auth.signOut();
    }
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
