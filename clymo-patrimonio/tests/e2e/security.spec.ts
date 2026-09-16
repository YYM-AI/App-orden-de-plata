import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { authenticate, post, resetA, testAccounts, A, C, origin } from '../support/browser-auth';

test('anonymous login bootstrap scripts are served as JavaScript without redirects', async ({
  page,
}) => {
  const response = await page.request.get('/login');
  const scripts = [...(await response.text()).matchAll(/<script[^>]*src="([^"]+)"/g)];
  expect(scripts.length).toBeGreaterThan(0);
  for (const [, src] of scripts) {
    const asset = await page.request.get(src, { maxRedirects: 0 });
    expect(asset.status()).toBe(200);
    expect(asset.headers()['content-type']).toMatch(/javascript/);
    expect(await asset.text()).not.toContain('60240000');
  }
});

test('unauthenticated pages and API reveal no financial household data', async ({ page }) => {
  for (const path of ['/', '/fuentes', '/revision', '/configuracion']) {
    const r = await page.request.get(path);
    expect(new URL(r.url()).pathname).toBe('/login');
    expect(await r.text()).not.toMatch(/52\.540\.000|60240000|María Demo|Familia Demo Clymo/);
    expect(r.headers()['cache-control']).toContain('no-store');
  }
  for (const path of ['/api/households', `/api/households/${A}`, '/api/diagnostics'])
    expect((await page.request.get(path)).status()).toBe(401);
  await page.goto('/fuentes');
  await expect(page.getByRole('heading', { name: 'Ingresa a tu hogar.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /registr/i })).toHaveCount(0);
});
test('real sign-in, restoration, HttpOnly cookies and sign-out', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo de acceso').fill(testAccounts.ownerA.email);
  await page.getByLabel('Contraseña de acceso').fill(testAccounts.ownerA.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByTestId('net-worth')).toBeVisible();
  const cookies = await page.context().cookies();
  expect(
    cookies
      .filter((c) => c.name.startsWith('sb-'))
      .every((c) => c.httpOnly && c.sameSite === 'Lax'),
  ).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('sb-');
  await page.reload();
  await expect(page.getByTestId('net-worth')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get(`/api/households/${A}`)).status()).toBe(401);
});
test('invalid credentials and non-allowlisted identities show safe errors', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo de acceso').fill(testAccounts.ownerA.email);
  await page.getByLabel('Contraseña de acceso').fill('invalid-synthetic-password');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('net-worth')).toHaveCount(0);
  const a = testAccounts.unapproved;
  const r = await post(page, '/api/auth/login', { email: a.email, password: a.password });
  expect(r.status()).toBe(403);
  expect((await page.request.get('/api/households')).status()).toBe(401);
});
test('invalid callback cannot redirect to a supplied external URL', async ({ page }) => {
  await page.goto('/auth/callback?code=invalid&next=https://example.com');
  await expect(page).toHaveURL(origin + '/login?error=callback');
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
});
test('login without JavaScript cannot submit credentials in the URL', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: origin, javaScriptEnabled: false });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  try {
    await page.goto('/login');
    await page.getByLabel('Correo de acceso').fill('disabled-js@clymo.test');
    await page.getByLabel('Contraseña de acceso').fill('SyntheticOnly-NotAnAccount');
    await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeDisabled();
    await page.getByLabel('Contraseña de acceso').press('Enter');
    expect(
      requests.every((url) => !url.includes('password=') && !url.includes('SyntheticOnly')),
    ).toBe(true);
    expect(new URL(page.url()).search).not.toContain('password');
  } finally {
    await context.close();
  }
});
test('legacy browser records require discard and never override database state', async ({
  page,
}) => {
  await page.goto('/login');
  await page.evaluate(() =>
    localStorage.setItem(
      'clymo-patrimonio:synthetic:v1',
      JSON.stringify({ unknown: 'do not upload' }),
    ),
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Descartar demo local anterior' }).click();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await authenticate(page);
  await resetA(page);
  await page.goto('/');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000');
});
test('helper UI is read-only and every direct household mutation is denied', async ({ page }) => {
  await authenticate(page, 'helperA');
  await page.goto('/');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000');
  await expect(page.getByLabel('Moneda de presentación', { exact: true })).toBeDisabled();
  await page.goto('/fuentes');
  await expect(page.getByRole('button', { name: 'Agregar activo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Agregar pasivo', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ver detalle de Cuenta corriente', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Agregar observación' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirmar propiedad' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar ventana' }).click();
  await page.goto('/configuracion');
  await expect(page.getByRole('button', { name: 'Descargar JSON' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restablecer datos demo' })).toHaveCount(0);
  for (const [endpoint, data] of [
    [
      'command',
      {
        command: { type: 'settings', reportingCurrency: 'USD' },
        revision: 0,
        commandId: randomUUID(),
      },
    ],
    ['reset', { confirm: true }],
    ['members', { userId: testAccounts.outsider.id, role: 'helper', active: true }],
    ['export', { format: 'json' }],
    ['delete', { confirmation: 'Familia Demo Clymo', irreversible: true }],
  ] as const)
    expect((await post(page, `/api/households/${A}/${endpoint}`, data)).status(), endpoint).toBe(
      403,
    );
});
test('Owner B cannot discover A through routes, guessed UUIDs or exports', async ({ page }) => {
  await authenticate(page, 'ownerB');
  await page.goto('/');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 1.900.000');
  await page.getByRole('button', { name: 'Ver cálculo de activos incluidos' }).click();
  await expect(page.getByRole('dialog')).not.toContainText('950');
  await expect(page.getByRole('dialog')).toContainText('tasas ficticias aprobadas de este hogar');
  await page.getByRole('button', { name: 'Cerrar ventana' }).click();
  await page.goto('/fuentes');
  await expect(page.getByRole('heading', { name: 'Cuenta Norte USD' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('María Demo');
  expect((await page.request.get(`/api/households/${A}`)).status()).toBe(403);
  expect((await post(page, `/api/households/${A}/export`, { format: 'json' })).status()).toBe(403);
  await page.goto('/?hogar=' + A);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('No tienes acceso');
  await expect(page.getByTestId('net-worth')).toHaveCount(0);
});
test('owner JSON and UTF-8 CSV exports are downloadable, scoped and audited', async ({ page }) => {
  await authenticate(page);
  await resetA(page);
  await page.goto('/configuracion');
  for (const format of ['json', 'csv']) {
    const r = await post(page, `/api/households/${A}/export`, { format });
    expect(r.status()).toBe(200);
    expect(r.headers()['content-disposition']).toContain('attachment');
    expect(r.headers()['cache-control']).toContain('no-store');
    const content = await r.text();
    expect(content).toContain(A);
    expect(content).not.toMatch(/Banco Norte|password|access_token|service_role/);
    if (format === 'json') {
      const data = JSON.parse(content);
      expect(data.state.household.id).toBe(A);
    }
  }
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar JSON' }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.json$/);
});
test('two browser contexts share server persistence and keep financial data out of localStorage', async ({
  page,
  browser,
}) => {
  await authenticate(page);
  await resetA(page);
  const state = (await (await page.request.get(`/api/households/${A}`)).json()).state;
  expect(
    (
      await post(page, `/api/households/${A}/command`, {
        revision: state.revision,
        commandId: randomUUID(),
        command: {
          type: 'add_manual',
          name: 'Compartido entre sesiones Demo',
          amount: '123000',
          currency: 'CLP',
          percentage: '100',
          effectiveDate: '2026-09-04',
          side: 'asset',
          category: 'cash',
        },
      })
    ).status(),
  ).toBe(200);
  const context = await browser.newContext({ baseURL: origin });
  try {
    const second = await context.newPage();
    await authenticate(second);
    await second.goto('/');
    await expect(second.getByTestId('net-worth')).toHaveText('CLP 52.663.000');
    await second.reload();
    await expect(second.getByTestId('net-worth')).toHaveText('CLP 52.663.000');
    expect(await second.evaluate(() => Object.values(localStorage).join(''))).not.toMatch(
      /123000|accounts|balance|access_token/,
    );
  } finally {
    await context.close();
    await resetA(page);
  }
});
test('helper revocation clears the retained browser view on next validation', async ({
  page,
  browser,
}) => {
  await authenticate(page);
  const context = await browser.newContext({ baseURL: origin });
  const helper = await context.newPage();
  await authenticate(helper, 'helperA');
  await helper.goto('/');
  await expect(helper.getByTestId('net-worth')).toBeVisible();
  try {
    expect(
      (
        await post(page, `/api/households/${A}/members`, {
          userId: testAccounts.helperA.id,
          role: 'helper',
          active: false,
        })
      ).status(),
    ).toBe(200);
    await helper.reload();
    await expect(helper.getByTestId('net-worth')).toHaveCount(0);
    expect((await helper.request.get(`/api/households/${A}`)).status()).toBe(403);
  } finally {
    await post(page, `/api/households/${A}/members`, {
      userId: testAccounts.helperA.id,
      role: 'helper',
      active: true,
    });
    await context.close();
  }
});
test('empty household and first entry remain isolated', async ({ page }) => {
  await authenticate(page, 'ownerC');
  await post(page, `/api/households/${C}/reset`, { confirm: true });
  await page.goto('/');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 0');
  await expect(page.getByRole('main')).not.toContainText('cartola adicional');
  await page.goto('/fuentes');
  await page.getByRole('button', { name: 'Agregar activo', exact: true }).click();
  await page.getByLabel('Nombre ficticio', { exact: true }).fill('Primer ahorro vacío Demo');
  await page.getByLabel('Monto ficticio', { exact: true }).fill('2500');
  await page.getByRole('button', { name: 'Guardar fuente ficticia' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 2.500');
  await post(page, `/api/households/${C}/reset`, { confirm: true });
});
test('household switching and high-friction deletion remove a disposable household', async ({
  page,
}) => {
  test.setTimeout(60000);
  await authenticate(page, 'ownerA', true);
  await page.goto('/configuracion');
  await page.getByLabel('Nombre del nuevo hogar').fill('Hogar desechable E2E');
  await page.getByRole('button', { name: 'Crear hogar vacío' }).click();
  await expect(page).toHaveURL(/\?hogar=[0-9a-f-]{36}$/);
  const id = new URL(page.url()).searchParams.get('hogar')!;
  expect(id).not.toBe(A);
  try {
    expect((await page.request.get('/api/households/' + id)).status()).toBe(200);
    // Full-document navigation includes a fresh server session validation before hydration.
    await expect(page).toHaveURL(new RegExp('hogar=' + id));
    await expect(page.getByTestId('net-worth')).toHaveText('CLP 0', { timeout: 15000 });
    await page.getByLabel('Cambiar hogar').selectOption(A);
    await expect(page).toHaveURL(new RegExp('hogar=' + A));
    await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000', { timeout: 15000 });
    await page.getByLabel('Cambiar hogar').selectOption(id);
    await expect(page).toHaveURL(new RegExp('hogar=' + id));
    await expect(page.getByTestId('net-worth')).toHaveText('CLP 0', { timeout: 15000 });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Configuración', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp('/configuracion\\?hogar=' + id));
    await page.reload();
    await page.getByRole('button', { name: 'Eliminar este hogar' }).click();
    await expect(page.getByRole('button', { name: 'Eliminar definitivamente' })).toBeDisabled();
    await page.getByLabel('Escribe Hogar desechable E2E').fill('Hogar desechable E2E');
    await page
      .getByRole('checkbox', { name: 'Entiendo que esta acción no se puede deshacer.' })
      .check();
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect(page).toHaveURL(origin + '/');
    await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000', { timeout: 15000 });
    expect((await page.request.get('/api/households/' + id)).status()).toBe(403);
  } finally {
    if ((await page.request.get('/api/households/' + id)).ok()) {
      expect(
        (
          await post(page, `/api/households/${id}/delete`, {
            confirmation: 'Hogar desechable E2E',
            irreversible: true,
          })
        ).status(),
      ).toBe(200);
    }
  }
});
test('deleting a last owner account is safely blocked', async ({ page }) => {
  await authenticate(page, 'ownerA', true);
  await page.goto('/configuracion');
  await page.getByRole('button', { name: 'Eliminar mi cuenta de acceso', exact: true }).click();
  await page.getByLabel('Escribe ELIMINAR MI CUENTA').fill('ELIMINAR MI CUENTA');
  await page
    .getByRole('checkbox', { name: 'Entiendo que esta acción no se puede deshacer.' })
    .check();
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('único propietario');
  await page.getByRole('button', { name: 'Cerrar ventana' }).click();
  await page.goto('/');
  await expect(page.getByTestId('net-worth')).toBeVisible();
});
test('lost session cookies redirect without retaining financial content', async ({ page }) => {
  await authenticate(page);
  await page.goto('/');
  await expect(page.getByTestId('net-worth')).toBeVisible();
  await page.context().clearCookies();
  await page.reload();
  await expect(page).toHaveURL(/login/);
  await expect(page.getByTestId('net-worth')).toHaveCount(0);
});
test('cross-site writes and unauthenticated mutation attempts fail closed', async ({ page }) => {
  await authenticate(page);
  const r = await page.request.post(`/api/households/${A}/reset`, {
    headers: { Origin: 'https://untrusted.example' },
    data: { confirm: true },
  });
  expect(r.status()).toBe(403);
  await page.context().clearCookies();
  expect((await post(page, `/api/households/${A}/reset`, { confirm: true })).status()).toBe(401);
});
for (const width of [320, 390, 768, 1440])
  test(`login and deletion dialog accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await authenticate(page);
    await page.goto('/configuracion');
    await page.getByRole('button', { name: 'Eliminar este hogar' }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

test('account deletion removes a disposable real Auth identity and its profile', async ({
  page,
}) => {
  const { disposableIdentity } = await import('../support/disposable-identity');
  const identity = await disposableIdentity();
  try {
    expect(
      (
        await post(page, '/api/auth/login', { email: identity.email, password: identity.password })
      ).status(),
    ).toBe(200);
    await page.goto('/');
    await expect(page.getByText('Todavía no tienes un hogar autorizado.')).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar mi cuenta', exact: true }).click();
    await page.getByLabel('Escribe ELIMINAR MI CUENTA').fill('ELIMINAR MI CUENTA');
    await page
      .getByRole('checkbox', { name: 'Entiendo que esta acción no se puede deshacer.' })
      .check();
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await identity.admin.auth.admin.getUserById(identity.id)).data.user).toBeNull();
    const { connection } = await import('../support/database');
    const pg = connection();
    await pg.connect();
    try {
      expect(
        (await pg.query('select id from public.profiles where id=$1', [identity.id])).rows,
      ).toEqual([]);
    } finally {
      await pg.end();
    }
    expect((await page.request.get('/api/households')).status()).toBe(401);
  } finally {
    await identity.admin.auth.admin.deleteUser(identity.id);
  }
});
test('expired authentication plus unusable refresh redirects and exposes no financial content', async ({
  page,
}) => {
  const { expiredSession } = await import('../support/expired-session');
  // Browser transport fixture only; normal app authentication always uses official SSR cookies.
  await authenticate(page, 'ownerA', true);
  const authCookies = (await page.context().cookies()).filter((c) => c.name.startsWith('sb-'));
  expect(authCookies.length).toBeGreaterThan(0);
  const name = authCookies[0].name.replace(/\.\d+$/, '');
  await page.context().clearCookies();
  const value =
    'base64-' +
    Buffer.from(JSON.stringify(expiredSession(testAccounts.ownerA.id))).toString('base64url');
  await page.context().addCookies([{ name, value, url: origin, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/fuentes');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('net-worth')).toHaveCount(0);
  expect((await page.request.get(`/api/households/${A}`)).status()).toBe(401);
});
