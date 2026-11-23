import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  timeout: 120000,
  reporter: [['list']],
  // KS_BASE_URL lets the same tests run against another server, e.g. the Pages build under /keyshift/
  use: { baseURL: process.env.KS_BASE_URL ?? 'http://localhost:4173/', acceptDownloads: true, ignoreHTTPSErrors: true,
    // a self-signed local HTTPS server needs this for the service worker to register (GitHub Pages has a real cert)
    launchOptions: process.env.KS_BASE_URL?.startsWith('https://localhost') ? { args: ['--ignore-certificate-errors'] } : undefined },
  webServer: process.env.KS_BASE_URL ? undefined : { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'mobile-390x844', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } },
    { name: 'desktop-1366x900', use: { viewport: { width: 1366, height: 900 } } },
  ],
});
