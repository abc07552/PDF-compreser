import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.mjs',
  projects: [
    { name: 'engine', testMatch: '**/engine.spec.mjs' },
    { name: 'workspace', testMatch: '**/ui.spec.mjs' },
  ],
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    serviceWorkers: 'block',
    baseURL: 'http://localhost:4198',
    headless: true,
    viewport: { width: 1366, height: 900 },
    launchOptions: {
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 4198 --strictPort',
      url: 'http://localhost:4198/tests/harness.html',
      reuseExistingServer: !process.env.CI,
      timeout: 40000,
    },
    {
      command:
        'npm run build && node node_modules/vite/bin/vite.js preview --base /PDF-compreser/ --host 0.0.0.0 --port 4199 --strictPort',
      url: 'http://localhost:4199/PDF-compreser/',
      reuseExistingServer: !process.env.CI,
      timeout: 100000,
    },
  ],
});
