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
 * 纯 UI E2E：页面发布闭环。
 * 创建页面 → 发布 → 下线，通过 UI 操作。
 * 修复：凭据统一（env）、去静默降级（硬断言）、去 waitForTimeout、补 afterAll 清理、
 * 每个测试自建数据（消除测试间状态依赖）。
 */

let siteId: string;
let siteSlug: string;
let apiCtx: Awaited<ReturnType<typeof request.newContext>>;
let token: string;

test.beforeAll(async () => {
  apiCtx = await request.newContext();
  token = await login(apiCtx);
  siteSlug = `${RUN_ID}-pub`;
  const siteRes = await apiCtx.post(`${BFF_BASE}/api/sites`, {
    headers: authHeaders(token),
    data: { name: 'E2E 发布闭环', slug: siteSlug, baseUrl: `https://${RUN_ID}.test`, status: 'active' },
  });
  const site = await siteRes.json();
  siteId = site.id;
});

test.afterAll(async () => {
  // 清理站点（级联删页面）。修复无 afterAll 违规（style-guide §11）。
  if (siteId && apiCtx) {
    await apiCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: authHeaders(token) }).catch(() => {});
    await apiCtx.dispose().catch(() => {});
  }
});

async function loginViaUI(page: import('@playwright/test').Page) {
  await page.goto(`${ENGINE_BASE}/login`);
  await page.getByPlaceholder('请输入账号').fill(ACCOUNT);
  await page.getByPlaceholder('请输入密码').fill(PASSWORD);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

/** 用 API 造一个草稿页面（消除测试间状态依赖） */
async function seedDraftPage(name: string): Promise<{ id: string; path: string }> {
  const path = `/pub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const r = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
    headers: authHeaders(token),
    data: { name, path, schema: { root: { id: 'root', type: 'LubanContainer', props: {}, children: [] } } },
  });
  const page = await r.json();
  return { id: page.id, path };
}

test.describe('页面发布闭环 @J-publish', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('通过 UI 创建页面', async ({ page }) => {
    await page.goto(`${ENGINE_BASE}/sites/${siteId}/pages`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});

    await page.getByRole('button', { name: '新建页面' }).click();
    await page.waitForURL(/\/pages\/new/, { timeout: 10000 });

    const pageName = `UI页面-${Date.now()}`;
    await page.getByPlaceholder('页面名称').fill(pageName);
    await page.getByPlaceholder('/path').fill(`/ui-${Date.now()}`);

    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveURL(/\/pages\/[a-z0-9-]+/i, { timeout: 10000 });
  });

  test('通过 UI 发布页面', async ({ page }) => {
    // 自建草稿页（不依赖前序测试）
    const seeded = await seedDraftPage('发布测试');
    await page.goto(`${ENGINE_BASE}/sites/${siteId}/pages`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await page.reload();

    // ★ 硬断言（修复静默降级：去掉 if visible.catch 包裹）
    const draftRow = page.locator('.el-table__row', { hasText: '发布测试' }).first();
    await expect(draftRow).toBeVisible({ timeout: 10000 });
    await draftRow.getByRole('button', { name: '发布' }).click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // 验证状态变为已发布
    await page.reload();
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await expect(page.locator('.el-table__row', { hasText: '已发布' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('通过 UI 下线已发布页面', async ({ page }) => {
    // 自建并先发布一个页面（不依赖前序测试）
    const seeded = await seedDraftPage('下线测试');
    await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages/${seeded.id}/publish`, { headers: authHeaders(token) });

    await page.goto(`${ENGINE_BASE}/sites/${siteId}/pages`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await page.reload();

    // ★ 硬断言（修复静默降级）
    const publishedRow = page.locator('.el-table__row', { hasText: '下线测试' }).first();
    await expect(publishedRow).toBeVisible({ timeout: 10000 });
    await publishedRow.getByRole('button', { name: '下线' }).click();

    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toBeVisible({ timeout: 5000 });
    await msgBox.getByRole('button', { name: '确认下线' }).click();

    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
  });

  test('通过 UI 删除页面', async ({ page }) => {
    // 自建页面
    const seeded = await seedDraftPage('删除测试');
    await page.goto(`${ENGINE_BASE}/sites/${siteId}/pages`);
    await page.locator('.el-loading-mask').waitFor({ state: 'detached' }).catch(() => {});
    await page.reload();

    const row = page.locator('.el-table__row', { hasText: '删除测试' }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: '删除' }).click();

    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toBeVisible({ timeout: 5000 });
    await msgBox.locator('.el-button--primary').click();

    // ★ 修复：用断言替代 waitForTimeout
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
  });

  test('退出登录', async ({ page }) => {
    await page.goto(`${ENGINE_BASE}/dashboard`);
    await page.locator('.default-layout__user').click();
    await page.getByText('退出登录').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
