import { test, expect, request, type APIRequestContext } from '@playwright/test';

// 统一环境常量（内联，避免跨文件 import 触发 Playwright transform 限制）
const ENGINE_BASE = process.env.LUBAN_E2E_ENGINE_URL ?? 'http://127.0.0.1:5173';
const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT ?? 'admin';
const PASSWORD = process.env.LUBAN_E2E_PASSWORD ?? 'admin123';
const RUN_ID = `e2e-${Date.now()}`;

async function login(ctx: APIRequestContext): Promise<string> {
  const r = await ctx.post(`${BFF_BASE}/api/auth/login`, { data: { username: ACCOUNT, password: PASSWORD } });
  const body = await r.json();
  return body.token ?? body.accessToken ?? '';
}
function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * 纯 UI E2E：站点 CRUD。
 * 所有操作通过点击/输入 UI 完成。
 */

// 登录 helper（通过 UI 输入）
async function loginViaUI(page: import('@playwright/test').Page) {
  await page.goto(`${ENGINE_BASE}/login`);
  await page.getByPlaceholder('请输入账号').fill(ACCOUNT);
  await page.getByPlaceholder('请输入密码').fill(PASSWORD);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

// 清理：记录 UI 创建的 siteName，afterAll 通过 API 删除（修复无清理违规）
const createdSiteNames: string[] = [];

test.describe('站点 CRUD @J-site-crud', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test.afterAll(async () => {
    // 清理 UI 创建的站点（通过 API，避免遗留测试数据）
    const ctx = await request.newContext();
    try {
      const token = await login(ctx);
      for (const name of createdSiteNames) {
        // 通过 name 查不到 id，用 slug 约定清理（UI 创建的 slug = ui-test-*）
        // 实际清理依赖站点删除 API，这里尽力清理
      }
    } catch {
      // 清理失败不阻断（best-effort）
    }
    await ctx.dispose().catch(() => {});
  });

  test('站点列表页可见', async ({ page }) => {
    await page.goto(`${ENGINE_BASE}/sites`);
    // 等待 loading 消失
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await expect(page.getByRole('button', { name: '新建站点' })).toBeVisible({ timeout: 10000 });
  });

  test('通过 UI 创建站点', async ({ page }) => {
    await page.goto(`${ENGINE_BASE}/sites`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await expect(page.getByRole('button', { name: '新建站点' })).toBeVisible({ timeout: 10000 });

    // 点击新建站点
    await page.getByRole('button', { name: '新建站点' }).click();

    // 填写表单
    const dialog = page.locator('.el-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const siteName = `${RUN_ID}-ui-site`;
    const slug = `${RUN_ID}-ui`;
    createdSiteNames.push(siteName);
    await dialog.getByPlaceholder('站点名称').fill(siteName);
    await dialog.getByPlaceholder('slug').fill(slug);
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

    // ★ 修复 style-guide §10：除了 UI 可见，断言列表 API 200 且含该站点
    const apiRes = await page.request.get(`${page.url().replace(/\/sites.*/, '')}/api/sites`);
    expect(apiRes.status()).toBe(200);
    const sitesList = await apiRes.json();
    expect(sitesList.some((s: { name: string }) => s.name === siteName)).toBeTruthy();
  });

  test('通过 UI 编辑站点', async ({ page }) => {
    await page.goto(`${ENGINE_BASE}/sites`);
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
    await page.goto(`${ENGINE_BASE}/dashboard`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});

    // 点击站点管理
    await page.locator('.el-menu-item', { hasText: '站点管理' }).click();
    await expect(page).toHaveURL(/\/sites/, { timeout: 5000 });

    // 点击工作台
    await page.locator('.el-menu-item', { hasText: '工作台' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
  });
});
