import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  timeout: 180000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/', acceptDownloads: true },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'mobile-390x844', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } },
    { name: 'desktop-1366x900', use: { viewport: { width: 1366, height: 900 } } },
  ],
});
