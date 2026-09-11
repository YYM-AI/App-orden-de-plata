import { expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
export const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222',
  C = '33333333-3333-4333-8333-333333333333';
export const origin = 'http://127.0.0.1:3100';
export const testAccounts: Record<string, { id: string; email: string; password: string }> =
  JSON.parse(readFileSync('.local/test-accounts.json', 'utf8'));
const cookies = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();
export async function authenticate(page: Page, key = 'ownerA', fresh = false) {
  if (!fresh && cookies.has(key)) {
    await page.context().addCookies(cookies.get(key)!);
    if ((await page.request.get('/api/households')).ok()) return;
  }
  const a = testAccounts[key];
  const r = await page.request.post('/api/auth/login', {
    headers: { Origin: origin },
    data: { email: a.email, password: a.password },
  });
  expect(r.status(), `authorized synthetic sign-in for ${key}`).toBe(200);
  cookies.set(key, await page.context().cookies());
}
export async function post(page: Page, path: string, data: unknown) {
  return page.request.post(path, { headers: { Origin: origin }, data });
}
export async function resetA(page: Page) {
  expect((await post(page, `/api/households/${A}/reset`, { confirm: true })).status()).toBe(200);
}
