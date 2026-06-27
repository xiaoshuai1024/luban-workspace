import { test, expect } from '@playwright/test';

/**
 * 纯 UI E2E：登录流程。
 * 所有操作通过点击/输入 UI 完成，禁止 API 调用。
 */

const ENGINE = 'http://localhost:5173';

test.describe('登录流程 @J-auth', () => {
  test('登录表单可见', async ({ page }) => {
    await page.goto(`${ENGINE}/login`);
    await expect(page.getByText('Luban 管理后台')).toBeVisible();
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('正确账号密码登录成功跳转 Dashboard', async ({ page }) => {
    await page.goto(`${ENGINE}/login`);
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('password123');
    await page.getByRole('button', { name: '登录' }).click();

    // 等待跳转到 Dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('站点数')).toBeVisible({ timeout: 10000 });
  });

  test('错误密码显示错误提示', async ({ page }) => {
    await page.goto(`${ENGINE}/login`);
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('wrongpassword');
    await page.getByRole('button', { name: '登录' }).click();

    // 应显示错误提示（ElMessage toast）
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 5000 });
  });

  test('未登录访问 Dashboard 重定向到登录页', async ({ page }) => {
    // 清除 token
    await page.goto(`${ENGINE}/login`);
    await page.evaluate(() => {
      localStorage.removeItem('luban_token');
      localStorage.removeItem('luban_user');
    });

    // 直接访问 dashboard
    await page.goto(`${ENGINE}/dashboard`);
    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
