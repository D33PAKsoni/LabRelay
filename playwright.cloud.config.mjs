import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/cloud-ui', workers: 1, timeout: 240000, expect: { timeout: 30000 },
  reporter: [['list'], ['json', { outputFile: 'reports/cloud-ui-results.json' }]],
  use: { headless: true, launchOptions: process.env.LABRELAY_BROWSER_EXECUTABLE ? { executablePath: process.env.LABRELAY_BROWSER_EXECUTABLE } : {} },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
