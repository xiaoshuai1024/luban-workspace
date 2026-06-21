import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

/**
 * Luban 跨项目流程性 E2E — Playwright 配置
 *
 * 多 project 编排 engine→BFF→backend→website 全链路。
 * 服务由 `make e2e-up`（docker-compose.e2e.yml）在外部启动，
 * 此处不内嵌 webServer，避免与编排冲突。健康检查见 globalSetup。
 *
 * baseURL 默认指向 engine 管理台；website/后端地址通过环境变量覆盖。
 */
const ENGINE_BASE = process.env.LUBAN_E2E_ENGINE_URL ?? 'http://127.0.0.1:5173';
const WEBSITE_BASE = process.env.LUBAN_E2E_WEBSITE_URL ?? 'http://127.0.0.1:3000';
const JAVA_API = process.env.LUBAN_E2E_JAVA_API ?? 'http://127.0.0.1:8080';
const GO_API = process.env.LUBAN_E2E_GO_API ?? 'http://127.0.0.1:8081';

export default defineConfig({
  testDir: './',
  fullyParallel: false, // 跨项目流程有状态依赖，串行更稳
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // 流程间共享后端状态，单 worker
  maxFailures: 1, // 首个失败即停（对齐 luban-e2e-execution-contract §2）
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: require.resolve('./global-setup.ts'),

  use: {
    baseURL: ENGINE_BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 使用 Playwright 内置 Chromium（系统无 Chrome 时的回退）
    // 如需使用系统 Chrome，设置 LUBAN_E2E_USE_CHROME=1
    channel: process.env.LUBAN_E2E_USE_CHROME ? 'chrome' : undefined,
    launchOptions: { slowMo: process.env.LUBAN_E2E_HEADED ? 100 : 0 },
  },

  projects: [
    // 0. 真实登录拿 storageState（必须最先跑）
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'engine-flows',
      testDir: './flows',
      dependencies: ['auth-setup'],
      use: {
        storageState: 'e2e/.auth/engine.json',
        // 各 spec 内按需切到 website
      },
    },
    {
      name: 'dual-backend',
      testDir: './contract',
      testMatch: /dual-backend\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        storageState: 'e2e/.auth/engine.json',
      },
    },
  ],

  // 暴露给 spec 的全局变量
  metadata: {
    ENGINE_BASE,
    WEBSITE_BASE,
    JAVA_API,
    GO_API,
  },
});
