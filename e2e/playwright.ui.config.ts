import { defineConfig, devices } from '@playwright/test';

/**
 * 纯 UI E2E 配置 — 不依赖 global-setup 和 storageState。
 * 所有登录通过 UI 输入完成。
 */
const ENGINE_BASE = process.env.LUBAN_E2E_ENGINE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './flows',
  testMatch: /ui-.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: ENGINE_BASE,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'engine-ui',
      use: {
        browserName: 'chromium',
        channel: 'chromium',
      },
    },
  ],
});
