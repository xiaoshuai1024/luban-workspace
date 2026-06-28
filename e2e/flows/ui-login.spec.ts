import { test, expect } from '@playwright/test';

// 统一环境常量（内联，避免跨文件 import 触发 Playwright transform 限制）
const ENGINE_BASE = process.env.LUBAN_E2E_ENGINE_URL ?? 'http://127.0.0.1:5173';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT ?? 'admin';
const PASSWORD = process.env.LUBAN_E2E_PASSWORD ?? 'admin123';

/**
 * 纯 UI E2E：登录流程。
 * 所有操作通过点击/输入 UI 完成，禁止 API 调用。
 */

test.describe('登录流程 @J-auth', () => {
  test.beforeEach(async ({ page }) => {
    // 清除登录态：engine-flows project 注入 storageState（已登录），
    // 访问 /login 会被重定向到 /dashboard，须先清 token 确保未登录态。
    await page.goto(`${ENGINE_BASE}/login`);
    await page.evaluate(() => {
      localStorage.removeItem('luban_token');
      localStorage.removeItem('luban_user');
    });
  });

  test('登录表单可见', async ({ page }) => {
    await page.goto(`${ENGINE_BASE}/login`);
    await expect(page.getByText('Luban 管理后台')).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('正确账号密码登录成功跳转 Dashboard', async ({ page }) => {
    await page.goto(`${ENGINE_BASE}/login`);
    await page.getByPlaceholder('请输入账号').fill(ACCOUNT);
    await page.getByPlaceholder('请输入密码').fill(PASSWORD);
    await page.getByRole('button', { name: '登录' }).click();

    // 等待跳转到 Dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('站点数')).toBeVisible({ timeout: 10000 });
  });

  test('错误密码显示错误提示', async ({ page }) => {
    await page.goto(`${ENGINE_BASE}/login`);
    await page.getByPlaceholder('请输入账号').fill(ACCOUNT);
    await page.getByPlaceholder('请输入密码').fill('wrongpassword');
    await page.getByRole('button', { name: '登录' }).click();

    // 应显示错误提示（ElMessage toast）
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 5000 });
  });

  test('未登录访问 Dashboard 重定向到登录页', async ({ page }) => {
    // 清除 token
    await page.goto(`${ENGINE_BASE}/login`);
    await page.evaluate(() => {
      localStorage.removeItem('luban_token');
      localStorage.removeItem('luban_user');
    });

    // 直接访问 dashboard
    await page.goto(`${ENGINE_BASE}/dashboard`);
    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
