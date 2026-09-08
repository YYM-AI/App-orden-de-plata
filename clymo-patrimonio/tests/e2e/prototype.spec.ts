import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
const go = async (page: Page, name: 'Resumen' | 'Fuentes' | 'Revisión' | 'Configuración') => {
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', {
      name: name === 'Revisión' ? /^Revisión/ : name,
      exact: name !== 'Revisión',
    })
    .click();
};
const close = async (page: Page) => page.getByRole('button', { name: 'Cerrar ventana' }).click();
async function addManual(page: Page, side: 'activo' | 'pasivo', name: string, amount: string) {
  await go(page, 'Fuentes');
  await page.getByRole('button', { name: `Agregar ${side}`, exact: true }).click();
  await page.getByLabel('Nombre ficticio', { exact: true }).fill(name);
  await page.getByLabel('Monto ficticio', { exact: true }).fill(amount);
  await page.getByRole('button', { name: 'Guardar fuente ficticia' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function resetDemo(page: Page) {
  await go(page, 'Configuración');
  await page.getByRole('button', { name: 'Restablecer datos demo' }).click();
  await page.getByRole('button', { name: 'Sí, restablecer datos ficticios' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await go(page, 'Resumen');
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000');
});
test('canonical summary and all four main destinations', async ({ page }) => {
  await expect(page.getByTestId('assets-total')).toHaveText('CLP 60.240.000');
  await expect(page.getByTestId('liabilities-total')).toHaveText('CLP 7.700.000');
  await expect(page.getByTestId('liquid-cash')).toHaveText('CLP 25.250.000');
  for (const [destination, heading] of [
    ['Fuentes', 'Tus fuentes'],
    ['Revisión', 'Revisemos lo pendiente.'],
    ['Configuración', 'Configuración'],
    ['Resumen', 'Tu patrimonio, con claridad.'],
  ] as const) {
    await go(page, destination);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});
test('all four headline calculations open and link to provenance', async ({ page }) => {
  for (const index of [0, 1]) {
    await page.getByRole('button', { name: 'Ver cálculo', exact: true }).nth(index).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await close(page);
  }
  for (const name of ['Ver cálculo de activos incluidos', 'Ver cálculo de pasivos incluidos']) {
    await page.getByRole('button', { name }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await close(page);
  }
  await page.getByRole('button', { name: 'Ver cálculo', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cuenta corriente' }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Cuenta corriente', exact: true }),
  ).toBeVisible();
});
test('source provenance exposes ownership, quantity, price, FX and immutable evidence', async ({
  page,
}) => {
  await go(page, 'Fuentes');
  await page.getByRole('button', { name: 'Ver detalle de Inversión en Estados Unidos' }).click();
  await expect(page.getByTestId('detail-original')).toHaveText('USD 9.200,00');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('CLP 8.740.000');
  await expect(dialog).toContainText('100 unidades × 42 USD');
  await expect(dialog).toContainText('Cantidad conocida al');
  await expect(dialog).toContainText('Precio ficticio al');
  await expect(dialog).toContainText('Tipo de cambio / UF al');
  await dialog.getByText(/Fuentes e historial de observaciones/).click();
  await expect(dialog).toContainText('balance-broker-copy');
});
test('adds a manual asset and persists it after page refresh', async ({ page }) => {
  await addManual(page, 'activo', 'Ahorro Manual Demo', '100000');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ahorro Manual Demo' })).toBeVisible();
  await go(page, 'Resumen');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.640.000');
});
test('adds a manual liability and subtracts it from net worth', async ({ page }) => {
  await addManual(page, 'pasivo', 'Crédito Manual Demo', '200000');
  await go(page, 'Resumen');
  await expect(page.getByTestId('liabilities-total')).toHaveText('CLP 7.900.000');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.340.000');
});
test('partial repayment reduces receivable, updates cash and conserves net worth', async ({
  page,
}) => {
  await go(page, 'Fuentes');
  await page.getByRole('button', { name: 'Ver detalle de María Demo me debe' }).click();
  await page.getByRole('button', { name: 'Registrar pago o evento' }).click();
  await page.getByRole('button', { name: 'Guardar evento ficticio' }).click();
  await expect(page.getByTestId('detail-original')).toHaveText('CLP 2.500.000');
  await close(page);
  await go(page, 'Resumen');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000');
  await expect(page.getByTestId('liquid-cash')).toHaveText('CLP 25.750.000');
  await page.reload();
  await expect(page.getByTestId('liquid-cash')).toHaveText('CLP 25.750.000');
});
test('resolves and reverses duplicate brokerage source without double counting', async ({
  page,
}) => {
  await go(page, 'Revisión');
  await page.getByRole('button', { name: 'Vincular a la cuenta existente' }).click();
  await expect(page.getByTestId('review-duplicate')).toContainText('Resuelta');
  await go(page, 'Resumen');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000');
  await go(page, 'Revisión');
  await page.getByRole('button', { name: 'Deshacer vinculación' }).click();
  await expect(page.getByTestId('review-duplicate')).toContainText('Pendiente');
});
test('switches CLP to USD and back with stable originals and refresh persistence', async ({
  page,
}) => {
  await page.getByLabel('Moneda de presentación', { exact: true }).selectOption('USD');
  await expect(page.getByTestId('net-worth')).toHaveText('USD 55.305,26');
  await page.reload();
  await expect(page.getByTestId('net-worth')).toHaveText('USD 55.305,26');
  await page.getByLabel('Moneda de presentación', { exact: true }).selectOption('CLP');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000');
});
test('reset restores the fixture and clears synthetic edits', async ({ page }) => {
  await addManual(page, 'activo', 'Temporal Demo', '100000');
  await resetDemo(page);
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000');
  await go(page, 'Fuentes');
  await expect(page.getByRole('heading', { name: 'Temporal Demo' })).toHaveCount(0);
});
test('records ownership and updates an account through append-only observations', async ({
  page,
}) => {
  await go(page, 'Fuentes');
  await page.getByRole('button', { name: 'Ver detalle de Ahorro compartido' }).click();
  await page.getByRole('button', { name: 'Confirmar propiedad' }).click();
  await page.getByLabel('Porcentaje del hogar').fill('25');
  await page.getByRole('button', { name: 'Guardar decisión de propiedad' }).click();
  await expect(page.getByRole('dialog')).toContainText('CLP 3.750.000');
  await close(page);
  await page.getByRole('button', { name: 'Ver detalle de Cuenta corriente', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar observación' }).click();
  await page.getByLabel('Monto ficticio', { exact: true }).fill('14000000');
  await page.getByRole('button', { name: 'Guardar observación' }).click();
  await expect(page.getByTestId('detail-original')).toHaveText('CLP 14.000.000');
  await page.getByText(/Fuentes e historial de observaciones/).click();
  await expect(page.getByRole('dialog')).toContainText('CLP 12.000.000');
});
test('obligation interface can be hidden without deleting or excluding its balances', async ({
  page,
}) => {
  await go(page, 'Configuración');
  await page.getByRole('checkbox', { name: 'Mostrar obligaciones personales' }).uncheck();
  await go(page, 'Resumen');
  await expect(page.getByTestId('net-worth')).toHaveText('CLP 52.540.000');
  await go(page, 'Fuentes');
  await expect(page.getByRole('heading', { name: 'María Demo me debe' })).toHaveCount(0);
  await go(page, 'Configuración');
  await page.getByRole('checkbox', { name: 'Mostrar obligaciones personales' }).check();
  await go(page, 'Fuentes');
  await expect(page.getByRole('heading', { name: 'María Demo me debe' })).toBeVisible();
});
test('manual inclusion decision is reversible and eligibility errors remain visible in the dialog', async ({
  page,
}) => {
  await go(page, 'Fuentes');
  await page.getByRole('button', { name: 'Ver detalle de Efectivo en casa' }).click();
  await page.getByRole('button', { name: 'Excluir esta fuente' }).click();
  await expect(page.getByRole('dialog')).toContainText('Excluida');
  await page.getByRole('button', { name: 'Incluir fuente elegible' }).click();
  await expect(page.getByRole('dialog')).toContainText('Incluida');
  await page.getByRole('button', { name: 'Confirmar propiedad' }).click();
  await page.getByLabel('Porcentaje del hogar').fill('101');
  await page.getByRole('button', { name: 'Guardar decisión de propiedad' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('100%');
});
test('filters expose missing rate, stale sources and excluded property pair', async ({ page }) => {
  await go(page, 'Fuentes');
  await page.getByLabel('Estado', { exact: true }).selectOption('excluded');
  await expect(page.getByTestId('source-eur')).toBeVisible();
  await expect(page.getByTestId('source-old')).toBeVisible();
  await expect(page.getByTestId('source-home')).toBeVisible();
  await expect(page.getByTestId('source-mortgage')).toBeVisible();
  await expect(page.getByTestId('source-checking')).toHaveCount(0);
});
test('missing rate acknowledgement does not become a false resolution', async ({ page }) => {
  await go(page, 'Revisión');
  await page
    .getByTestId('review-eur')
    .getByRole('button', { name: 'Entendido: mantener excluida' })
    .click();
  await expect(page.getByTestId('review-eur')).toContainText('Revisada · sigue excluida');
});
test('no live connection, real-document upload or financial credential control exists', async ({
  page,
}) => {
  for (const section of ['Resumen', 'Fuentes', 'Revisión', 'Configuración'] as const) {
    await go(page, section);
    await expect(page.locator('input[type=file], input[type=password]')).toHaveCount(0);
    await expect(
      page.getByRole('button', {
        name: /conectar banco|conectar broker|subir cartola|iniciar sesión/i,
      }),
    ).toHaveCount(0);
  }
});
test('keyboard opens explanations, focus remains in the dialog and Escape closes it', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Ver cálculo', exact: true }).first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test('all four pages and a detail dialog pass automated WCAG AA rules', async ({ page }) => {
  for (const section of ['Resumen', 'Fuentes', 'Revisión', 'Configuración'] as const) {
    await go(page, section);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  await go(page, 'Fuentes');
  await page.getByRole('button', { name: 'Agregar activo', exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
for (const width of [320, 390, 768, 1440]) {
  test(`responsive layout at ${width}px without horizontal page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    for (const section of ['Resumen', 'Fuentes', 'Revisión', 'Configuración'] as const) {
      await go(page, section);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
    }
    await go(page, 'Resumen');
    await mkdir('docs/screenshots', { recursive: true });
    await page.screenshot({ path: `docs/screenshots/summary-${width}.png`, fullPage: true });
  });
}
test('200% text enlargement and reduced motion preserve navigation and content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: ':root { font-size: 32px; }' });
  await expect(page.getByTestId('net-worth')).toBeVisible();
  await go(page, 'Fuentes');
  await expect(page.getByRole('button', { name: 'Agregar activo', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});
test('production browser reports no console errors or external financial requests', async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      external.push(new URL(request.url()).origin);
  });
  await page.reload();
  await expect(page.getByTestId('net-worth')).toBeVisible();
  for (const section of ['Fuentes', 'Revisión', 'Configuración', 'Resumen'] as const)
    await go(page, section);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
