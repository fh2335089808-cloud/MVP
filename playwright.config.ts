import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'order-first-success.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    channel: 'msedge',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npm.cmd exec vite -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
});
