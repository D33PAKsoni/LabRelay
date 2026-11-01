import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/product', testMatch: '*.spec.mjs', workers: 1, fullyParallel: false,
  timeout: 45000, reporter: [['list'], ['json', { outputFile: 'reports/product-browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, viewport: { width: 1440, height: 1000 }, serviceWorkers: 'allow',
    launchOptions: process.env.LABRELAY_BROWSER_EXECUTABLE ? { executablePath: process.env.LABRELAY_BROWSER_EXECUTABLE } : {} },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
