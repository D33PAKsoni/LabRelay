import { test, expect } from '@playwright/test';
const id = label => label + '_' + Date.now().toString(36);
async function open(page) {
  await page.goto('/?preview=1');
  await expect(page.getByRole('heading', { name: 'A clear path from field to lab.' })).toBeVisible();
}
async function role(page, value) {
  await page.getByLabel('Preview role').selectOption(value);
  await expect(page.getByLabel('Preview role')).toHaveValue(value);
  await expect(page.getByRole('heading', { name: 'A clear path from field to lab.' })).toBeVisible();
}
async function register(page, sampleId, label) {
  await page.getByRole('button', { name: 'Register sample', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Sample label').fill(label);
  await dialog.getByLabel('Sample ID', { exact: true }).fill(sampleId);
  await dialog.getByRole('button', { name: 'Register sample', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open handoff for ' + sampleId })).toBeVisible();
}
async function sample(page, sampleId) { await page.getByRole('button', { name: 'Open handoff for ' + sampleId }).click(); }

test('a collector registers a sample and both acknowledged handoffs reach the lab', async ({ page }) => {
  const sampleId = id('journey');
  await open(page); await page.screenshot({ path: 'reports/product-dispatch.png', fullPage: true }); await register(page, sampleId, 'Test river collection');
  await role(page, 'courier_0'); await sample(page, sampleId);
  await page.getByRole('button', { name: 'Claim pickup', exact: true }).click();
  await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible();
  await role(page, 'collector'); await sample(page, sampleId);
  await page.getByRole('button', { name: 'Offer handoff', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for the receiver.' })).toBeVisible();
  await role(page, 'courier_0'); await sample(page, sampleId);
  await page.getByRole('button', { name: 'I have this sample · accept custody' }).click();
  await expect(page.getByRole('heading', { name: 'Offer the next handoff.' })).toBeVisible();
  await page.getByRole('button', { name: 'Offer handoff', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for the receiver.' })).toBeVisible();
  await role(page, 'receiver'); await sample(page, sampleId);
  await page.getByRole('button', { name: 'I have this sample · accept custody' }).click();
  await expect(page.getByRole('heading', { name: 'Receipt confirmed.' })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect the custody history' }).click();
  await expect(page.getByRole('heading', { name: 'Chain of custody' })).toBeVisible();
  await expect(page.locator('.timeline li')).toHaveCount(6);
  await expect(page.getByText('Field collector → Courier 01', { exact: true })).toBeVisible();
  await expect(page.getByText('Courier 01 → You · Lab receiver', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'reports/product-history.png', fullPage: true });
});

test('couriers cannot register samples and a collector cannot claim a pickup', async ({ page }) => {
  const sampleId = id('roles');
  await open(page); await register(page, sampleId, 'Role boundaries');
  await sample(page, sampleId);
  await expect(page.getByRole('button', { name: 'Claim pickup', exact: true })).toHaveCount(0);
  await role(page, 'courier_0');
  await expect(page.getByRole('button', { name: 'Register sample', exact: true })).toHaveCount(0);
  await page.getByLabel('Search samples').fill(sampleId);
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('a pending observation survives offline refresh and is confirmed once on reconnect', async ({ page, context }) => {
  page.on('pageerror', error => console.log('Offline page error:', error.message));
  page.on('requestfailed', request => console.log('Offline request failed:', request.url()));
  const sampleId = id('offline');
  await open(page); await register(page, sampleId, 'Offline persistence');
  await sample(page, sampleId);
  await expect.poll(() => page.evaluate(() => window.__labrelayShellReady === true)).toBe(true);
  await context.setOffline(true);
  await page.getByLabel('Handling observation').fill('Seal intact during the connection gap.');
  await page.getByRole('button', { name: 'Save pending observation' }).click();
  await expect(page.getByRole('region', { name: 'Pending actions' })).toContainText('Pending sync');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Pending actions' })).toContainText('Pending sync');
  await context.setOffline(false);
  await expect(page.getByRole('region', { name: 'Pending actions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sample history', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(sampleId) }).click();
  await expect(page.getByText('Seal intact during the connection gap.', { exact: true })).toBeVisible();
});

test('a stale offline note stays visible for review without replacing confirmed custody', async ({ page, context, request }) => {
  const sampleId = id('stale');
  await open(page); await register(page, sampleId, 'Stale note review'); await sample(page, sampleId);
  await context.setOffline(true);
  await page.getByLabel('Handling observation').fill('Outdated note from the field');
  await page.getByRole('button', { name: 'Save pending observation' }).click();
  await expect(page.getByRole('region', { name: 'Pending actions' })).toContainText('Pending sync');
  const response = await request.post('/__preview/commands', { headers: { 'x-preview-actor': 'collector' },
    data: { kind: 'claim', sampleId, operationId: id('remote'), expectedVersion: 0 } });
  // The collector is forbidden to claim; advance with a valid collector observation instead.
  expect(response.status()).toBe(403);
  const advanced = await request.post('/__preview/commands', { headers: { 'x-preview-actor': 'collector' },
    data: { kind: 'observe', sampleId, operationId: id('advance'), expectedVersion: 0,
      note: 'Confirmed on another device', capturedAt: new Date().toISOString() } });
  expect(advanced.status()).toBe(200);
  await context.setOffline(false);
  await expect(page.getByRole('region', { name: 'Pending actions' })).toContainText('Needs review');
  await expect(page.locator('.specimen-meta')).toContainText('You · Field collector');
  await page.getByRole('button', { name: 'Archive rejected action' }).click();
  await expect(page.getByRole('region', { name: 'Pending actions' })).toHaveCount(0);
});

test('mobile dispatch and handoff fit the viewport with accessible navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByRole('heading', { name: 'Sample dispatch' })).toBeVisible();
  await page.screenshot({ path: 'reports/product-mobile.png', fullPage: true });
  expect(await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= innerWidth, overflow: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, cls: String(el.className), right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })).slice(0, 10) }))).toMatchObject({ fits: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Handoff', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'Make the next handoff count.' })).toBeVisible();
  expect(await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= innerWidth, overflow: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, cls: String(el.className), right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })).slice(0, 10) }))).toMatchObject({ fits: true });
});

test('product sign-in is separated from the fictional preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Preview role')).toHaveCount(0);
});
