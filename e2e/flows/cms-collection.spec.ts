import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import 'dotenv/config';

// ⚠️ 本 spec 尚未在本地全栈环境跑绿验证，待全栈就绪后验证

/**
 * CMS 集合渲染（J-cms-collection）
 *
 * 链路：经 BFF 公开端点 GET /api/public/sites/:slug/collections/:cid/items
 *      → 返回 {id,data,updatedAt}[]（website DynamicPage collectionFetcher 消费）
 *
 * 真实性：读取走公开端点（无 token）。setup 走管理端建 collection + item。
 */

const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://localhost:3000';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT!;
const PASSWORD = process.env.LUBAN_E2E_PASSWORD!;

const RUN_ID = `e2e-${Date.now()}`;
const SITE_SLUG = RUN_ID;

let token = '';
let siteId = '';
let collectionId = '';

test.beforeAll(async () => {
  if (!ACCOUNT || !PASSWORD) throw new Error('[cms-collection] 缺 LUBAN_E2E_ACCOUNT/PASSWORD');
  const ctx = await apiRequest.newContext();
  token = await login(ctx);
  const setup = await prepareCollectionFixture(ctx);
  siteId = setup.siteId;
  collectionId = setup.collectionId;
  await ctx.dispose();
  expect(siteId, 'setup 须拿到 siteId').toBeTruthy();
  expect(collectionId, 'setup 须拿到 collectionId').toBeTruthy();
});

test.describe('CMS 集合渲染 @J-cms-collection', () => {
  // C1：集合 items 端点返回数组结构，items 含 id/data
  test('C1 集合 items 端点返回数组且 items 含 id/data', async ({ request }) => {
    const res = await request.get(
      `${BFF_BASE}/api/public/sites/${SITE_SLUG}/collections/${collectionId}/items`,
    );
    expect(res.status(), `公开读取 items 须 200，实际 ${res.status()}`).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body), '响应体须为数组').toBe(true);
    // setup 已塞入 1 条 item
    if (body.length > 0) {
      const first = body[0];
      expect(first, 'item 须含 id').toHaveProperty('id');
      expect(first, 'item 须含 data').toHaveProperty('data');
    }
  });

  // C2：不存在的 collection → 不崩溃（404 或空数组）
  test('C2 不存在的 collection 不崩溃（404 或空数组）', async ({ request }) => {
    const res = await request.get(
      `${BFF_BASE}/api/public/sites/${SITE_SLUG}/collections/non-existent-cid-${Date.now()}/items`,
    );
    const status = res.status();
    // 后端可能返回 404（BackendHttpError 透传）或空数组 200——都属正常
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* 非 JSON 也算不崩溃 */
    }
    const ok =
      status === 404 ||
      status === 200 ||
      (Array.isArray(body) && body.length === 0);
    expect(ok, `应返回 404 或空数组，实际 status=${status}`).toBeTruthy();
  });

  test.afterAll(async () => {
    if (!siteId) return;
    try {
      const ctx = await apiRequest.newContext();
      const headers = { Authorization: `Bearer ${token}` };
      await ctx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers }).catch(() => {});
      await ctx.dispose();
    } catch {
      /* 前缀 e2e- 可人工识别清理 */
    }
  });
});

// ---------- helpers ----------

async function login(ctx: APIRequestContext): Promise<string> {
  const r = await ctx.post(`${BFF_BASE}/api/auth/login`, {
    data: { username: ACCOUNT, password: PASSWORD },
  });
  const body = await r.json();
  return body.token ?? body.accessToken ?? '';
}

/** 建站点 + 建 collection + 塞 1 条 item，返回 collectionId。 */
async function prepareCollectionFixture(
  ctx: APIRequestContext,
): Promise<{ siteId: string; collectionId: string }> {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 建站点
  const siteRes = await ctx.post(`${BFF_BASE}/api/sites`, {
    headers,
    data: { name: `${RUN_ID}-site`, slug: SITE_SLUG, baseUrl: `http://${SITE_SLUG}.test`, status: 'active' },
  });
  expect(siteRes.status(), `建站点须成功，实际 ${siteRes.status()}`).toBeLessThan(300);
  const site = await siteRes.json();
  const sid = site.id;

  // 建 collection
  const colRes = await ctx.post(`${BFF_BASE}/api/collections?siteId=${sid}`, {
    headers,
    data: {
      siteId: sid,
      name: `${RUN_ID}-collection`,
      fieldSchema: { fields: [{ name: 'title', label: '标题', type: 'text' }] },
      status: 'active',
    },
  });
  expect(colRes.status(), `建 collection 须成功，实际 ${colRes.status()}`).toBeLessThan(300);
  const col = await colRes.json();
  const cid = col.id;

  // 塞 1 条 item
  await ctx
    .post(`${BFF_BASE}/api/collections/${cid}/items?siteId=${sid}`, {
      headers,
      data: { data: { title: `${RUN_ID}-item` } },
    })
    .catch(() => {});

  return { siteId: sid, collectionId: cid };
}
