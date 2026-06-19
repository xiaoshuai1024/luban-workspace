import { test, expect, request } from '@playwright/test';
import 'dotenv/config';

/**
 * 流程 A — 发布闭环（跨项目黄金流程）
 *
 * 链路：经 BFF API 建站点 → 建页面(schema) → 发布(status=published)
 *      → website 访问 /{slug}/{path} → 断言 SSR 渲染 marker 文本
 *
 * 站点/页面创建走 BFF API（engine 真实 token → BFF → backend 真实入库），
 * 避开脆弱 UI 选择器；「发布产物经 website SSR 可见」用真实浏览器验证，
 * 确保发布闭环端到端打通。
 */

const WEBSITE_BASE = process.env.LUBAN_E2E_WEBSITE_URL ?? 'http://127.0.0.1:3000';
const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100';
const RUN_ID = `e2e-${Date.now()}`;
const SITE_NAME = `${RUN_ID}-site`;
const PAGE_NAME = `${RUN_ID}-page`;
// slug 与 path 由 UI 创建；这里用随机值避免冲突
const SITE_SLUG = RUN_ID;
const PAGE_PATH = '/e2e-publish';

// 最小可渲染 schema（LubanContainer + 一个文本物料）
const MIN_SCHEMA = {
  formState: {},
  root: {
    id: 'root',
    type: 'LubanContainer',
    props: { maxWidth: 'full', padded: true },
    children: [
      {
        id: 'text-1',
        type: 'LubanText',
        props: { content: `${RUN_ID} 发布闭环标记文本` },
        children: [],
      },
    ],
  },
};

let siteId = '';
let pageId = '';
let token = '';

test.beforeAll(async () => {
  const account = process.env.LUBAN_E2E_ACCOUNT;
  const password = process.env.LUBAN_E2E_PASSWORD;
  if (!account || !password) throw new Error('[publish-flow] 缺 LUBAN_E2E_ACCOUNT/PASSWORD');
  const ctx = await request.newContext();
  const r = await ctx.post(`${BFF_BASE}/api/auth/login`, { data: { username: account, password } });
  expect(r.status(), `登录须 200，实际 ${r.status()}`).toBe(200);
  token = (await r.json()).token;
  expect(token, '登录须返回 token').toBeTruthy();
  await ctx.dispose();
});

test.describe('流程A：发布闭环 @cross', () => {
  test('建站点 → 建页面 → 发布 → website SSR 渲染', async ({ page }) => {
    test.setTimeout(120_000);

    // === ① 经 BFF 建站点（engine token → BFF → backend 真实入库）===
    siteId = await createSiteViaBff();
    expect(siteId, '建站点后须拿到 siteId').toBeTruthy();

    // === ② 经 BFF 建页面（带 schema）===
    pageId = await createPageViaBff(siteId);
    expect(pageId, '建页面后须拿到 pageId').toBeTruthy();

    // === ③ 发布 status=published（经 BFF PUT 真实落库）===
    await publishPageViaBff(siteId, pageId);

    // === ④ 切换到 website，访问公开页（真实 SSR）===
    // website 路由：/:site/:path* → DynamicPage → usePageByPath(bff) → LubanPage 渲染
    const publicUrl = `${WEBSITE_BASE}/${SITE_SLUG}${PAGE_PATH}`;
    const res = await page.goto(publicUrl);
    expect(res, 'website 公开页须返回响应').not.toBeNull();
    expect(res!.status(), '已发布页须 200').toBe(200);

    // SSR title = 页面名（DynamicPage useHead title = page.name）
    await expect(page).toHaveTitle(new RegExp(escapeRegex(PAGE_NAME)), { timeout: 15_000 });

    // SSR 渲染了 schema 内容（非 client-only）
    await expect(page.getByText(MIN_SCHEMA.root.children![0].props.content)).toBeVisible();
  });

  test.afterAll(async () => {
    if (!siteId) return;
    try {
      const ctx = await request.newContext();
      const headers = { luban_token: token };
      if (pageId) await ctx.delete(`${BFF_BASE}/api/sites/${siteId}/pages/${pageId}`, { headers }).catch(() => {});
      await ctx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers }).catch(() => {});
      await ctx.dispose();
    } catch {
      /* 前缀 e2e- 可人工识别 */
    }
  });
});

// ---------- helpers ----------

async function createSiteViaBff(): Promise<string> {
  const ctx = await request.newContext();
  const r = await ctx.post(`${BFF_BASE}/api/sites`, {
    headers: { luban_token: token, 'Content-Type': 'application/json' },
    data: { name: SITE_NAME, slug: SITE_SLUG, baseUrl: `http://${SITE_SLUG}.test`, status: 'active' },
  });
  await ctx.dispose();
  expect(r.status(), `建站点须成功，实际 ${r.status()}`).toBeLessThan(300);
  const body = await r.json();
  return body.id ?? body.data?.id ?? '';
}

async function createPageViaBff(sid: string): Promise<string> {
  const ctx = await request.newContext();
  const r = await ctx.post(`${BFF_BASE}/api/sites/${sid}/pages`, {
    headers: { luban_token: token, 'Content-Type': 'application/json' },
    data: { name: PAGE_NAME, path: PAGE_PATH, schema: MIN_SCHEMA, status: 'draft' },
  });
  await ctx.dispose();
  expect(r.status(), `建页面须成功，实际 ${r.status()}`).toBeLessThan(300);
  const body = await r.json();
  return body.id ?? body.data?.id ?? '';
}

async function publishPageViaBff(sid: string, pid: string) {
  const ctx = await request.newContext();
  const r = await ctx.put(`${BFF_BASE}/api/sites/${sid}/pages/${pid}`, {
    headers: { luban_token: token, 'Content-Type': 'application/json' },
    data: { name: PAGE_NAME, path: PAGE_PATH, schema: MIN_SCHEMA, status: 'published' },
  });
  await ctx.dispose();
  expect(r.status(), `发布须成功，实际 ${r.status()}`).toBeLessThan(300);
}
