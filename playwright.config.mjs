import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: '*.spec.mjs', workers: 1, fullyParallel: false,
  timeout: 30_000, reporter: [['list'], ['json', { outputFile: 'reports/browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4179', headless: true, serviceWorkers: 'allow',
    launchOptions: process.env.LABRELAY_BROWSER_EXECUTABLE ? { executablePath: process.env.LABRELAY_BROWSER_EXECUTABLE } : {} },
  webServer: { command: 'node tests/browser/server.mjs', url: 'http://127.0.0.1:4179', reuseExistingServer: false }
});
