import { test, expect } from '@playwright/test';

/**
 * 纯 UI E2E：站点 CRUD。
 * 所有操作通过点击/输入 UI 完成。
 */

const ENGINE = 'http://localhost:5173';

// 登录 helper（通过 UI 输入）
async function loginViaUI(page: import('@playwright/test').Page) {
  await page.goto(`${ENGINE}/login`);
  await page.getByPlaceholder('请输入账号').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('password123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('站点 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('站点列表页可见', async ({ page }) => {
    await page.goto(`${ENGINE}/sites`);
    // 等待 loading 消失
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await expect(page.getByRole('button', { name: '新建站点' })).toBeVisible({ timeout: 10000 });
  });

  test('通过 UI 创建站点', async ({ page }) => {
    await page.goto(`${ENGINE}/sites`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await expect(page.getByRole('button', { name: '新建站点' })).toBeVisible({ timeout: 10000 });

    // 点击新建站点
    await page.getByRole('button', { name: '新建站点' }).click();

    // 填写表单
    const dialog = page.locator('.el-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const siteName = `UI测试站点-${Date.now()}`;
    await dialog.getByPlaceholder('站点名称').fill(siteName);
    await dialog.getByPlaceholder('slug').fill(`ui-test-${Date.now()}`);
    await dialog.getByPlaceholder('https://...').fill('https://ui-test.example.com');
    await dialog.getByPlaceholder('active / inactive').fill('active');

    // 提交
    await dialog.getByRole('button', { name: '确定' }).click();

    // 等待成功提示
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 5000 });

    // 验证站点出现在列表
    await page.reload();
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await expect(page.getByText(siteName)).toBeVisible({ timeout: 10000 });
  });

  test('通过 UI 编辑站点', async ({ page }) => {
    await page.goto(`${ENGINE}/sites`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});

    // 找到第一行的编辑按钮
    const firstRow = page.locator('.el-table__row').first();
    await firstRow.getByRole('button', { name: '编辑' }).click();

    // 修改名称
    const dialog = page.locator('.el-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const nameInput = dialog.getByPlaceholder('站点名称');
    await nameInput.clear();
    await nameInput.fill(`已编辑-${Date.now()}`);
    await dialog.getByRole('button', { name: '确定' }).click();

    // 等待成功提示
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 5000 });
  });

  test('侧边栏导航到各页面', async ({ page }) => {
    await page.goto(`${ENGINE}/dashboard`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});

    // 点击站点管理
    await page.locator('.el-menu-item', { hasText: '站点管理' }).click();
    await expect(page).toHaveURL(/\/sites/, { timeout: 5000 });

    // 点击工作台
    await page.locator('.el-menu-item', { hasText: '工作台' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
  });
});
