import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
export async function proxy(request: NextRequest) {
  // Keep bootstrap assets public even on runtimes that do not apply Next's matcher.
  // Financial pages and every API still perform their own server authorization.
  const path = request.nextUrl.pathname;
  if (path.startsWith('/_next/static/') || path === '/icon.svg' || path === '/favicon.ico')
    return NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const https = process.env.APP_ORIGIN?.startsWith('https://');
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${dev ? ' ws://127.0.0.1:3100' : ''}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';${https ? ' upgrade-insecure-requests;' : ''}`;
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  let response = NextResponse.next({ request: { headers } });
  const finish = (r: NextResponse) => {
    r.headers.set('Content-Security-Policy', csp);
    r.headers.set('Cache-Control', 'private, no-store, max-age=0');
    r.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return r;
  };
  const publicRoute =
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname.startsWith('/api/auth/') ||
    request.nextUrl.pathname === '/auth/callback' ||
    request.nextUrl.pathname === '/robots.txt';
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key)
    return publicRoute
      ? finish(response)
      : finish(NextResponse.redirect(new URL('/login?error=config', request.url)));
  const db = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: !!https, path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        headers.set('cookie', request.cookies.toString());
        response = NextResponse.next({ request: { headers } });
        for (const { name, value, options } of values)
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: 'lax',
            secure: !!https,
          });
      },
    },
  });
  // Fresh Auth validation, never trust a browser-provided user or role.
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user && !publicRoute && !request.nextUrl.pathname.startsWith('/api/')) {
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return finish(redirect);
  }
  return finish(response);
}
export const config = { matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'] };
