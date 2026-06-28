import { test, expect, request, type APIRequestContext } from '@playwright/test';

// 统一环境常量（内联，避免跨文件 import 触发 Playwright transform 限制）
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

test.describe('P0 发布闭环 API E2E @J-publish', () => {
  let ctx: Awaited<ReturnType<typeof request.newContext>>;
  let adminToken: string;
  let siteId: string;
  let siteSlug: string;
  let pageId: string;

  test.beforeAll(async () => {
    ctx = await request.newContext();
    adminToken = await login(ctx);
    expect(adminToken).toBeTruthy();

    // 创建站点
    const siteRes = await ctx.post(`${BFF_BASE}/api/sites`, {
      headers: authHeaders(adminToken),
      data: { name: `${RUN_ID}-api-site`, slug: `${RUN_ID}-api`, baseUrl: `https://${RUN_ID}.test`, status: 'active' },
    });
    const site = await siteRes.json();
    siteId = site.id;
    siteSlug = site.slug;
    expect(siteId).toBeTruthy();
  });

  test.afterAll(async () => {
    // 清理：删站点（级联删页面）。修复无 afterAll 违规（style-guide §11）。
    if (siteId && ctx) {
      await ctx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: authHeaders(adminToken) }).catch(() => {});
      await ctx.dispose().catch(() => {});
    }
  });

  test('create → publish → public → unpublish → 404', async () => {
    const headers = authHeaders(adminToken);

    // 1. 创建页面
    const createRes = await ctx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
      headers,
      data: {
        name: 'E2E Page',
        path: `/e2e-${Date.now()}`,
        schema: { root: { id: 'root', type: 'LubanContainer', props: {}, children: [] } },
      },
    });
    expect(createRes.status()).toBe(201);
    const page = await createRes.json();
    pageId = page.id;
    expect(page.status).toBe('draft');

    // 2. 发布
    const pubRes = await ctx.post(`${BFF_BASE}/api/sites/${siteId}/pages/${pageId}/publish`, { headers });
    expect(pubRes.status()).toBe(200);
    const pubBody = await pubRes.json();
    expect(pubBody.status).toBe('published');

    // 3. 公开可见
    const publicRes = await ctx.get(`${BFF_BASE}/api/public/sites/${siteSlug}/pages/by-path?path=${page.path}`);
    expect(publicRes.status()).toBe(200);

    // 4. 下线
    const unpubRes = await ctx.post(`${BFF_BASE}/api/sites/${siteId}/pages/${pageId}/unpublish`, { headers });
    expect(unpubRes.status()).toBe(200);
    const unpubBody = await unpubRes.json();
    expect(unpubBody.status).toBe('archived');

    // 5. 公开 404
    const afterUnpub = await ctx.get(`${BFF_BASE}/api/public/sites/${siteSlug}/pages/by-path?path=${page.path}`);
    expect(afterUnpub.status()).toBe(404);
  });

  test('preview returns draft content', async () => {
    const headers = authHeaders(adminToken);

    // 创建新页面
    const createRes = await ctx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
      headers,
      data: {
        name: 'Preview Test',
        path: `/preview-${Date.now()}`,
        schema: { root: { id: 'root', type: 'LubanHero', props: { title: 'Preview' } } },
      },
    });
    const page = await createRes.json();

    // 预览
    const previewRes = await ctx.get(`${BFF_BASE}/api/sites/${siteId}/pages/${page.id}/preview`, { headers });
    expect(previewRes.status()).toBe(200);
    const preview = await previewRes.json();
    expect(preview.schema.root.type).toBe('LubanHero');
  });
});
