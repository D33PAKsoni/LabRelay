import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/reset'); await page.goto('/');
  await page.evaluate(() => window.harness.ready);
});
test('offline observation survives offline reload and synchronizes once after reconnection', async ({ page, context, request }) => {
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Save observation locally' }).click();
  await expect(page.getByRole('status').or(page.locator('#status'))).toContainText('Pending sync');
  await page.reload(); await page.evaluate(() => window.harness.ready);
  expect(await page.evaluate(() => window.harness.list())).toHaveLength(1);
  await page.evaluate(() => window.harness.sync());
  expect((await page.evaluate(() => window.harness.list()))[0].state).toBe('pending');
  await context.setOffline(false); await page.evaluate(() => window.harness.sync());
  await expect(page.locator('#status')).toContainText('Confirmed by server');
  const stats = await (await request.get('/api/stats')).json();
  expect(stats.events).toBe(1); expect(stats.sample.version).toBe(1);
});
test('stale offline observation is retained for review and pauses subsequent replay', async ({ page, context, request }) => {
  await context.setOffline(true); await page.evaluate(() => window.harness.enqueue());
  await request.post('/api/advance'); await context.setOffline(false);
  await page.evaluate(() => window.harness.sync());
  const items = await page.evaluate(() => window.harness.list());
  expect(items[0].state).toBe('needs_review'); expect(items[0].errorCode).toBe('STALE_VERSION');
  await page.evaluate(() => window.harness.enqueue('dependent_note', 1));
  await page.evaluate(() => window.harness.sync());
  expect((await page.evaluate(() => window.harness.list())).find(x => x.command.operationId === 'dependent_note').state).toBe('pending');
  expect((await (await request.get('/api/stats')).json()).events).toBe(1);
});
test('lost acknowledgment after server commit remains pending, then retries without duplicate history', async ({ page, request }) => {
  await page.evaluate(() => window.harness.enqueue());
  await page.evaluate(() => window.harness.loseAck());
  await page.evaluate(() => window.harness.sync());
  expect((await page.evaluate(() => window.harness.list()))[0].state).toBe('pending');
  expect((await (await request.get('/api/stats')).json()).events).toBe(1);
  await page.reload(); await page.evaluate(() => window.harness.ready);
  await page.evaluate(() => window.harness.sync());
  expect((await page.evaluate(() => window.harness.list()))[0].state).toBe('synced');
  expect((await (await request.get('/api/stats')).json()).events).toBe(1);
});
test('another signed-in identity does not see or replay the first identity pending queue', async ({ page, request }) => {
  await page.evaluate(() => window.harness.enqueue());
  await page.evaluate(() => window.harness.setActor('outsider'));
  expect(await page.evaluate(() => window.harness.list())).toHaveLength(0);
  await page.evaluate(() => window.harness.sync());
  expect((await (await request.get('/api/stats')).json()).events).toBe(0);
  await page.evaluate(() => window.harness.setActor('collector'));
  expect(await page.evaluate(() => window.harness.list())).toHaveLength(1);
});
