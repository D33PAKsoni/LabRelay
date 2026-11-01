import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
test('real browser sign-in, registration, both handoffs and custody history use hosted Appwrite', async ({ browser }) => {
  const { accounts } = JSON.parse(await readFile('.local/demo-accounts.json', 'utf8'));
  const contexts = [];
  async function login(role) {
    const account = accounts.find(account => account.role === role);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 } });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    try {
      await page.getByLabel('Email address').fill(account.email);
      await page.getByLabel('Password', { exact: true }).fill(account.password);
      await page.getByRole('button', { name: 'Open workspace' }).click();
    } catch { throw new Error('Could not submit the fictional demo sign-in form.'); }
    await expect(page.getByRole('heading', { name: 'A clear path from field to lab.' })).toBeVisible();
    await expect(page.getByLabel('Preview role')).toHaveCount(0);
    return page;
  }
  async function openSample(page, sampleId) {
    await page.getByRole('button', { name: 'Dispatch', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh workspace' }).click();
    await page.getByRole('button', { name: 'Open handoff for ' + sampleId }).click();
  }
  try {
    const collector = await login('collector');
    const courier = await login('courier');
    const receiver = await login('receiver');
    const sampleId = 'ui_' + Date.now().toString(36);
    await collector.getByRole('button', { name: 'Register sample', exact: true }).click();
    const dialog = collector.getByRole('dialog');
    await dialog.getByLabel('Sample label').fill('Fictional online field-to-lab journey');
    await dialog.getByLabel('Sample ID', { exact: true }).fill(sampleId);
    await dialog.getByRole('button', { name: 'Register sample', exact: true }).click();
    await expect(collector.getByText('Sample registered. You retain confirmed custody.')).toBeVisible();
    await openSample(courier, sampleId);
    await courier.getByRole('button', { name: 'Claim pickup', exact: true }).click();
    await expect(courier.getByText('Saved and confirmed by the server.')).toBeVisible();
    await openSample(collector, sampleId);
    await expect(collector.getByRole('heading', { name: 'Offer the next handoff.' })).toBeVisible();
    await collector.getByRole('button', { name: 'Offer handoff', exact: true }).click();
    await expect(collector.getByRole('heading', { name: 'Waiting for the receiver.' })).toBeVisible();
    await openSample(courier, sampleId);
    await expect(courier.getByRole('heading', { name: 'Ready to accept this sample?' })).toBeVisible();
    await courier.getByRole('button', { name: 'I have this sample · accept custody' }).click();
    await expect(courier.getByRole('heading', { name: 'Offer the next handoff.' })).toBeVisible();
    await courier.getByRole('button', { name: 'Offer handoff', exact: true }).click();
    await expect(courier.getByRole('heading', { name: 'Waiting for the receiver.' })).toBeVisible();
    await openSample(receiver, sampleId);
    await expect(receiver.getByRole('heading', { name: 'Ready to accept this sample?' })).toBeVisible();
    await receiver.getByRole('button', { name: 'I have this sample · accept custody' }).click();
    await expect(receiver.getByRole('heading', { name: 'Receipt confirmed.' })).toBeVisible();
    await receiver.getByRole('button', { name: 'Inspect the custody history' }).click();
    await expect(receiver.locator('.timeline li')).toHaveCount(6);
    await expect(receiver.getByText('Field collector → Courier 01', { exact: true })).toBeVisible();
    await expect(receiver.getByText('Courier 01 → You · Lab receiver', { exact: true })).toBeVisible();
    await receiver.screenshot({ path: 'reports/hosted-product-history.png', fullPage: true });
    for (const page of [collector, courier, receiver]) {
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    }
  } finally {
    for (const context of contexts) await context.close();
  }
});
