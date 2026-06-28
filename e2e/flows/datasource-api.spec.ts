import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * 数据源管理 API E2E @J-datasource
 *
 * 验证 datasource 全链 CRUD + test 连接 + headers 脱敏（engine UI 弹窗的后端契约）。
 */

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

let apiCtx: APIRequestContext;
let token: string;
let siteId: string;

test.beforeAll(async () => {
  apiCtx = await request.newContext();
  token = await login(apiCtx);
  const siteRes = await apiCtx.post(`${BFF_BASE}/api/sites`, {
    headers: authHeaders(token),
    data: { name: `${RUN_ID}-ds`, slug: `${RUN_ID}-ds`, status: 'active' },
  });
  siteId = (await siteRes.json()).id;
});

test.afterAll(async () => {
  if (siteId && apiCtx) {
    await apiCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: authHeaders(token) }).catch(() => {});
    await apiCtx.dispose().catch(() => {});
  }
});

test.describe('数据源管理 API @J-datasource', () => {
  test('DS1: 创建 static 数据源', async () => {
    const r = await apiCtx.post(`${BFF_BASE}/api/datasources?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, name: `${RUN_ID}-static`, type: 'static', config: {} },
    });
    expect(r.status(), `创建应成功，实际 ${r.status()}`).toBeLessThan(300);
    const ds = await r.json();
    expect(ds.id).toBeTruthy();
    expect(ds.type).toBe('static');
  });

  test('DS2: 创建 api 数据源 + headers 脱敏', async () => {
    const r = await apiCtx.post(`${BFF_BASE}/api/datasources?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: {
        siteId, name: `${RUN_ID}-api`, type: 'api',
        config: { url: 'https://httpbin.org/get', method: 'GET', headers: { Authorization: 'Bearer secret123' } },
      },
    });
    expect(r.status()).toBeLessThan(300);
    const dsId = (await r.json()).id;

    // GET 详情 → headers 值应脱敏为 ***
    const detail = await apiCtx.get(`${BFF_BASE}/api/datasources/${dsId}`, { headers: authHeaders(token) });
    const body = await detail.json();
    const headersVal = body.config?.headers?.Authorization ?? body.config?.headers?.authorization;
    expect(headersVal, 'headers 值应脱敏为 ***').toBe('***');
  });

  test('DS3: 测试连接（api 类型）', async () => {
    const createRes = await apiCtx.post(`${BFF_BASE}/api/datasources?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, name: `${RUN_ID}-test`, type: 'api', config: { url: 'https://httpbin.org/get', method: 'GET' } },
    });
    const dsId = (await createRes.json()).id;
    const r = await apiCtx.post(`${BFF_BASE}/api/datasources/${dsId}/test`, { headers: authHeaders(token) });
    expect(r.status()).toBeLessThan(300);
    const result = await r.json();
    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.latencyMs).toBe('number');
  });

  test('DS4: 更新数据源', async () => {
    const createRes = await apiCtx.post(`${BFF_BASE}/api/datasources?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, name: `${RUN_ID}-upd`, type: 'static', config: {} },
    });
    const dsId = (await createRes.json()).id;
    const r = await apiCtx.put(`${BFF_BASE}/api/datasources/${dsId}`, {
      headers: authHeaders(token),
      data: { siteId, name: `${RUN_ID}-upd-renamed`, type: 'static', config: {} },
    });
    expect(r.status()).toBeLessThan(300);
    expect((await r.json()).name).toBe(`${RUN_ID}-upd-renamed`);
  });

  test('DS5: 删除数据源（204）', async () => {
    const createRes = await apiCtx.post(`${BFF_BASE}/api/datasources?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, name: `${RUN_ID}-del`, type: 'static', config: {} },
    });
    const dsId = (await createRes.json()).id;
    const r = await apiCtx.delete(`${BFF_BASE}/api/datasources/${dsId}`, { headers: authHeaders(token) });
    expect(r.status(), `删除应返回 204，实际 ${r.status()}`).toBe(204);
  });

  test('DS6: 列表返回数组', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/datasources?siteId=${siteId}`, { headers: authHeaders(token) });
    expect(r.status()).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });
});
