import { execFileSync } from 'node:child_process';
import { defineConfig } from '@playwright/test';

/**
 * Real-browser journeys (four-puzzle brief 12, user decision 8): `npm run test:e2e`.
 * Chromium only, at the two sizes the canvas designs for: phone 390x844 and tablet 834x1194.
 * The Vite dev server starts on a free port for each run, so it never meets a dev server already
 * running on this machine. Vitest keeps the logic tests; these files only drive the app.
 */

/** A free TCP port, found once in the main process and handed to the workers through the environment. */
function freePort(): number {
  const script =
    "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close();});";
  return Number(execFileSync(process.execPath, ['-e', script]).toString().trim());
}

const port = Number(process.env.BRICKWISE_E2E_PORT || (process.env.BRICKWISE_E2E_PORT = String(freePort())));
const baseURL = `http://127.0.0.1:${port}`;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  reporter: ci ? [['list'], ['github']] : 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    {
      name: 'tablet',
      use: { viewport: { width: 834, height: 1194 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
