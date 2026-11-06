import { defineConfig, devices } from '@playwright/test';

const PORT = 8597;
const CI = !!process.env.CI;

// End-to-end tests: the reader in a real browser, against a server reading the
// test litanies in e2e/litanies. `npm run test:e2e`.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/serve.js',
    url: `http://127.0.0.1:${PORT}/api/index.json`,
    env: { E2E_PORT: String(PORT) },
    reuseExistingServer: !CI,
  },
});
