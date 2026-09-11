// Local-only adversarial test fixture: a correctly signed, already-expired legacy JWT.
// The signing secret is never returned, logged or committed. No production path imports this.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
export function expiredSession(userId: string) {
  const status = JSON.parse(readFileSync('.local/status.json', 'utf8'));
  if (!['127.0.0.1', 'localhost'].includes(new URL(status.API_URL).hostname))
    throw Error('Expired-session fixture is local-only.');
  const encode = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' }),
    claims = encode({ aud: 'authenticated', role: 'authenticated', sub: userId, iat: 1, exp: 2 });
  const signature = createHmac('sha256', status.JWT_SECRET)
    .update(header + '.' + claims)
    .digest('base64url');
  return {
    access_token: header + '.' + claims + '.' + signature,
    refresh_token: 'expired-synthetic-refresh-token',
    token_type: 'bearer',
    expires_in: 1,
    expires_at: 2,
    user: { id: userId, aud: 'authenticated', role: 'authenticated' },
  };
}
