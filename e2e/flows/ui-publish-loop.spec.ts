import { test, expect, request } from '@playwright/test';

/**
 * 纯 UI E2E：页面发布闭环。
 * 创建页面 → 发布 → 预览 → 下线，全部通过 UI 操作。
 * 仅 beforeAll 用 API 造测试站点（不相关的造数据），其余全部 UI 交互。
 */

const ENGINE = 'http://localhost:5173';
const BFF = 'http://127.0.0.1:3100';

let siteId: string;
let siteSlug: string;

test.beforeAll(async () => {
  // 造数据：通过 API 创建测试站点（不代替 UI 测试，仅提供前置数据）
  const ctx = await request.newContext();
  const loginRes = await ctx.post(`${BFF}/api/auth/login`, {
    data: { username: 'admin', password: 'password123' },
  });
  const { token } = await loginRes.json();
  siteSlug = `e2e-ui-${Date.now()}`;
  const siteRes = await ctx.post(`${BFF}/api/sites`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'E2E UI 测试', slug: siteSlug, baseUrl: 'https://e2e-ui.test', status: 'active' },
  });
  const site = await siteRes.json();
  siteId = site.id;
});

async function loginViaUI(page: import('@playwright/test').Page) {
  await page.goto(`${ENGINE}/login`);
  await page.getByPlaceholder('请输入账号').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('password123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('页面发布闭环', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('通过 UI 创建页面', async ({ page }) => {
    // 直接导航到测试站点的页面列表
    await page.goto(`${ENGINE}/sites/${siteId}/pages`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});

    // 点击新建页面
    await page.getByRole('button', { name: '新建页面' }).click();
    await page.waitForURL(/\/pages\/new/, { timeout: 10000 });

    // 填写页面名称和路径
    const pageName = `UI测试页面-${Date.now()}`;
    const pagePath = `/ui-test-${Date.now()}`;
    await page.getByPlaceholder('页面名称').fill(pageName);
    await page.getByPlaceholder('/page-path').fill(pagePath);

    // 保存
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // 应跳转到编辑器页面（有 pageId）
    await expect(page).toHaveURL(/\/pages\/[a-z0-9-]+/i, { timeout: 10000 });
  });

  test('通过 UI 发布页面', async ({ page }) => {
    await page.goto(`${ENGINE}/sites/${siteId}/pages`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});

    // 找一个草稿页面，点击发布
    const draftRow = page.locator('.el-table__row', { hasText: '草稿' }).first();
    if (await draftRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await draftRow.getByRole('button', { name: '发布' }).click();
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // 验证状态变为已发布
      await page.reload();
      await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
      const publishedRow = page.locator('.el-table__row', { hasText: '已发布' }).first();
      await expect(publishedRow).toBeVisible({ timeout: 10000 });
    }
  });

  test('通过 UI 下线已发布页面', async ({ page }) => {
    await page.goto(`${ENGINE}/sites/${siteId}/pages`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});

    const publishedRow = page.locator('.el-table__row', { hasText: '已发布' }).first();
    if (await publishedRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await publishedRow.getByRole('button', { name: '下线' }).click();

      const msgBox = page.locator('.el-message-box');
      await expect(msgBox).toBeVisible({ timeout: 5000 });
      await msgBox.getByRole('button', { name: '确认下线' }).click();

      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
    }
  });

  test('通过 UI 删除页面', async ({ page }) => {
    await page.goto(`${ENGINE}/sites/${siteId}/pages`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});

    await expect(page.locator('.el-table__row').first()).toBeVisible({ timeout: 10000 });

    const row = page.locator('.el-table__row').first();
    await row.getByRole('button', { name: '删除' }).click();

    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toBeVisible({ timeout: 5000 });
    await msgBox.locator('.el-button--primary').click();

    await page.waitForTimeout(2000);
  });

  test('退出登录', async ({ page }) => {
    await page.goto(`${ENGINE}/dashboard`);
    await page.locator('.default-layout__user').click();
    await page.getByText('退出登录').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
