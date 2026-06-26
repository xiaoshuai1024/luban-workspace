import { test, expect, request } from '@playwright/test';

const BFF = 'http://127.0.0.1:3100';
const ADMIN = { username: 'admin', password: 'password123' };

test.describe('P0 发布闭环 API E2E', () => {
  let adminToken: string;
  let siteId: string;
  let pageId: string;

  test.beforeAll(async () => {
    const ctx = await request.newContext();
    // 登录
    const loginRes = await ctx.post(`${BFF}/api/auth/login`, { data: ADMIN });
    const loginBody = await loginRes.json();
    adminToken = loginBody.token;
    expect(adminToken).toBeTruthy();

    // 创建站点
    const siteRes = await ctx.post(`${BFF}/api/sites`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'API E2E', slug: `api-e2e-${Date.now()}`, baseUrl: 'https://api-e2e.test', status: 'active' },
    });
    const site = await siteRes.json();
    siteId = site.id;
    expect(siteId).toBeTruthy();
  });

  test('create → publish → public → unpublish → 404', async () => {
    const ctx = await request.newContext();
    const headers = { Authorization: `Bearer ${adminToken}` };

    // 1. 创建页面
    const createRes = await ctx.post(`${BFF}/api/sites/${siteId}/pages`, {
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
    const pubRes = await ctx.post(`${BFF}/api/sites/${siteId}/pages/${pageId}/publish`, { headers });
    expect(pubRes.status()).toBe(200);
    const pubBody = await pubRes.json();
    expect(pubBody.status).toBe('published');

    // 3. 公开可见
    const publicRes = await ctx.get(`${BFF}/api/public/sites/${site.slug}/pages?path=${page.path}`);
    expect(publicRes.status()).toBe(200);

    // 4. 下线
    const unpubRes = await ctx.post(`${BFF}/api/sites/${siteId}/pages/${pageId}/unpublish`, { headers });
    expect(unpubRes.status()).toBe(200);
    const unpubBody = await unpubRes.json();
    expect(unpubBody.status).toBe('archived');

    // 5. 公开 404
    const afterUnpub = await ctx.get(`${BFF}/api/public/sites/${site.slug}/pages?path=${page.path}`);
    expect(afterUnpub.status()).toBe(404);
  });

  test('preview returns draft content', async () => {
    const ctx = await request.newContext();
    const headers = { Authorization: `Bearer ${adminToken}` };

    // 创建新页面
    const createRes = await ctx.post(`${BFF}/api/sites/${siteId}/pages`, {
      headers,
      data: {
        name: 'Preview Test',
        path: `/preview-${Date.now()}`,
        schema: { root: { id: 'root', type: 'LubanHero', props: { title: 'Preview' } } },
      },
    });
    const page = await createRes.json();

    // 预览
    const previewRes = await ctx.get(`${BFF}/api/sites/${siteId}/pages/${page.id}/preview`, { headers });
    expect(previewRes.status()).toBe(200);
    const preview = await previewRes.json();
    expect(preview.schema.root.type).toBe('LubanHero');
  });
});
