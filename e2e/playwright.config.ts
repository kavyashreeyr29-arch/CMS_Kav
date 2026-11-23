import { defineConfig, devices } from '@playwright/test';

// Runs against the app started via `docker compose up` at the repo root —
// this suite does not start its own servers, since the whole point is to
// test the same containers the app actually runs in.
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  // This dev host is genuinely memory-constrained: VS Code, Docker Desktop,
  // and multiple other Electron/browser apps run alongside it, often
  // leaving well under 1GB free for the whole Compose stack + Chromium.
  // Under that pressure, `net::ERR_CONNECTION_RESET` shows up as a host
  // network hiccup, not an app bug — see CLAUDE.md. Single worker + long
  // timeouts trades speed for not chasing environment noise; turn workers
  // back up on a machine with real headroom.
  workers: 1,
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  retries: 2,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 45000,
    actionTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Fake mic/camera devices so MediaRecorderCapture (voice/video note
        // recording on ticket creation) can be exercised headlessly — real
        // getUserMedia() would otherwise hang waiting on a permission prompt.
        permissions: ['microphone', 'camera'],
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
  ],
});
