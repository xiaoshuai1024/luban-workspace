import { test as setup, expect } from '@playwright/test';
import 'dotenv/config';

/**
 * 真实登录 setup —— 拿 engine 管理台 storageState
 *
 * 替代 engine Cypress 的 mock-token 假绿（luban-e2e-execution-contract §2.5.1）。
 * 账号由后端预置专用 e2e 账号，env 注入：
 *   LUBAN_E2E_ACCOUNT / LUBAN_E2E_PASSWORD
 * 缺账号 → 直接抛错，禁止 skip 顶替。
 */

const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT;
const PASSWORD = process.env.LUBAN_E2E_PASSWORD;

setup('authenticate as e2e account', async ({ page, baseURL }) => {
  if (!ACCOUNT || !PASSWORD) {
    throw new Error(
      '[e2e] 缺少 LUBAN_E2E_ACCOUNT / LUBAN_E2E_PASSWORD。请在后端预置专用 e2e 账号并通过 .env 或环境变量注入。'
    );
  }

  await page.goto('/login');
  await page.getByPlaceholder('请输入账号').fill(ACCOUNT);
  await page.getByPlaceholder('请输入密码').fill(PASSWORD);
  await page.getByRole('button', { name: '登录' }).click();

  // 真实验证：登录成功后跳 dashboard，且 token 写入 localStorage
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  const token = await page.evaluate(() => localStorage.getItem('luban_token'));
  expect(token, '登录后须写入 luban_token').toBeTruthy();

  await page.context().storageState({ path: 'e2e/.auth/engine.json' });
});
