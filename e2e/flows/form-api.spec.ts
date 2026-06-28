import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * 表单管理 API E2E @J-form-crud
 *
 * 验证 form 全链 CRUD + DELETE 级联校验（有线索 409）+ dedup 策略（engine UI 的后端契约）。
 * 覆盖本期新增的 DELETE 端点（Java+BFF+engine 三端）。
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
let pageId: string;

test.beforeAll(async () => {
  apiCtx = await request.newContext();
  token = await login(apiCtx);
  const siteRes = await apiCtx.post(`${BFF_BASE}/api/sites`, {
    headers: authHeaders(token),
    data: { name: `${RUN_ID}-form`, slug: `${RUN_ID}-form`, status: 'active' },
  });
  siteId = (await siteRes.json()).id;
  const pageRes = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
    headers: authHeaders(token),
    data: { name: 'form-page', path: `/f-${Date.now()}` },
  });
  pageId = (await pageRes.json()).id;
});

test.afterAll(async () => {
  if (siteId && apiCtx) {
    await apiCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: authHeaders(token) }).catch(() => {});
    await apiCtx.dispose().catch(() => {});
  }
});

test.describe('表单管理 API @J-form-crud', () => {
  test('FM1: 创建表单（默认 dedupPolicy=reject）', async () => {
    const r = await apiCtx.post(`${BFF_BASE}/api/forms?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, pageId, name: `${RUN_ID}-form1` },
    });
    expect(r.status(), `创建应成功，实际 ${r.status()}`).toBeLessThan(300);
    const form = await r.json();
    expect(form.id).toBeTruthy();
    expect(form.dedupPolicy).toBe('reject');
    expect(form.status).toBe('active');
  });

  test('FM2: 创建表单指定 dedupPolicy=merge', async () => {
    const r = await apiCtx.post(`${BFF_BASE}/api/forms?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, pageId, name: `${RUN_ID}-form2`, dedupPolicy: 'merge' },
    });
    expect(r.status()).toBeLessThan(300);
    expect((await r.json()).dedupPolicy).toBe('merge');
  });

  test('FM3: 更新表单（PATCH 部分更新）', async () => {
    const createRes = await apiCtx.post(`${BFF_BASE}/api/forms?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, pageId, name: `${RUN_ID}-upd` },
    });
    const formId = (await createRes.json()).id;
    const r = await apiCtx.patch(`${BFF_BASE}/api/forms/${formId}?siteId=${siteId}`, {
      headers: authHeaders(token),
      // FormSaveRequest @Valid 要求 siteId/pageId/name 非空（即使不改也须传）
      data: { siteId, pageId, name: `${RUN_ID}-upd-renamed`, status: 'disabled' },
    });
    expect(r.status()).toBeLessThan(300);
    const body = await r.json();
    expect(body.name).toBe(`${RUN_ID}-upd-renamed`);
    expect(body.status).toBe('disabled');
  });

  test('FM4: ★ DELETE 无线索 → 204（本期新增端点）', async () => {
    const createRes = await apiCtx.post(`${BFF_BASE}/api/forms?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, pageId, name: `${RUN_ID}-del` },
    });
    const formId = (await createRes.json()).id;
    const r = await apiCtx.delete(`${BFF_BASE}/api/forms/${formId}?siteId=${siteId}`, { headers: authHeaders(token) });
    expect(r.status(), `DELETE 无线索应返回 204，实际 ${r.status()}`).toBe(204);
  });

  test('FM5: ★ DELETE 有线索 → 409 FORM_HAS_LEADS（级联校验）', async () => {
    const createRes = await apiCtx.post(`${BFF_BASE}/api/forms?siteId=${siteId}`, {
      headers: authHeaders(token),
      data: { siteId, pageId, name: `${RUN_ID}-hasleads` },
    });
    const formId = (await createRes.json()).id;
    // 造一条线索
    await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '线索1', phone: `139${Date.now().toString().slice(-8)}` } },
    });
    // 删除应被拒
    const r = await apiCtx.delete(`${BFF_BASE}/api/forms/${formId}?siteId=${siteId}`, { headers: authHeaders(token) });
    expect(r.status(), `有线索时应返回 409，实际 ${r.status()}`).toBe(409);
    const body = await r.json();
    expect(body.code).toBe('FORM_HAS_LEADS');
  });

  test('FM6: 列表返回数组', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/forms?siteId=${siteId}`, { headers: authHeaders(token) });
    expect(r.status()).toBe(200);
    expect(Array.isArray(await r.json())).toBe(true);
  });
});
