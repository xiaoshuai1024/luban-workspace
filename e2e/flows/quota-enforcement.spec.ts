import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * 用量上报与套餐超限拦截 @J-quota-enforcement
 *
 * 覆盖 QuotaService 拦截链路的可观测部分：
 *   1. billing plans 端点返回含 quota 字段（quota_leads/pages/visits）
 *   2. billing usage 端点返回当前用量结构（可用于进度条）
 *   3. subscribe 端点可切换套餐（quota 拦截的前提）
 *   4. 公开 lead submit 端点可达（拦截发生点）
 *
 * 注：完整"超额→429"需要 seed 一个 quota_leads=1 的 plan 并订阅，
 * 当前 plans 表为空（FREE_PLAN 默认 quota=0 无限制），故本期测契约层；
 * 待 plans seed 后补完整超限场景（见 plan §7.3 T7 场景）。
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
let formId: string;

test.beforeAll(async () => {
  apiCtx = await request.newContext();
  token = await login(apiCtx);
  const siteRes = await apiCtx.post(`${BFF_BASE}/api/sites`, {
    headers: authHeaders(token),
    data: { name: `${RUN_ID}-quota`, slug: `${RUN_ID}-quota`, status: 'active' },
  });
  siteId = (await siteRes.json()).id;
  const pageRes = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
    headers: authHeaders(token),
    data: { name: 'quota-page', path: `/q-${Date.now()}` },
  });
  pageId = (await pageRes.json()).id;
  const formRes = await apiCtx.post(`${BFF_BASE}/api/forms?siteId=${siteId}`, {
    headers: authHeaders(token),
    data: { siteId, pageId, name: 'quota-form', dedupPolicy: 'reject' },
  });
  formId = (await formRes.json()).id;
});

test.afterAll(async () => {
  if (siteId && apiCtx) {
    await apiCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: authHeaders(token) }).catch(() => {});
    await apiCtx.dispose().catch(() => {});
  }
});

test.describe('用量上报与套餐超限拦截 @J-quota-enforcement', () => {
  test('QE1: billing plans 返回套餐列表（含 quota 字段）', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/billing/plans`, { headers: authHeaders(token) });
    expect(r.status()).toBe(200);
    const plans = await r.json();
    expect(Array.isArray(plans)).toBe(true);
    // 若有 plan，每个含 planCode + quota_* 字段
    if (plans.length > 0) {
      const p = plans[0];
      expect(p.planCode || p.plan_code).toBeTruthy();
      // quota 字段存在（值可能 0=无限制）
      expect('quotaLeads' in p || 'quota_leads' in p).toBe(true);
    }
  });

  test('QE2: billing usage 返回当前用量结构', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/billing/usage`, { headers: authHeaders(token) });
    expect(r.status()).toBeLessThan(300);
    const usage = await r.json();
    // 用量结构须是对象（非空）
    expect(typeof usage).toBe('object');
    expect(usage).not.toBeNull();
  });

  test('QE3: 公开 lead submit 端点可达（quota 拦截发生点）', async () => {
    // 提交一条线索（走公开端点，触发 QuotaService.checkAndIncrement）
    const r = await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '配额测试', phone: `139${Date.now().toString().slice(-8)}` } },
    });
    // 成功 2xx 或被 quota 拦截 429 都是合法行为（取决于当前 plan quota）
    const status = r.status();
    expect(status < 300 || status === 429, `submit 应返回 2xx 或 429，实际 ${status}`).toBe(true);
  });

  test('QE4: 重复提交相同手机号被去重（dedup 与 quota 独立工作）', async () => {
    const phone = `138${Date.now().toString().slice(-8)}`;
    const r1 = await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '去重测试', phone } },
    });
    expect(r1.status()).toBeLessThan(300);
    const r2 = await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '去重测试', phone } },
    });
    // dedup 策略 reject → 409 LEAD_DUPLICATE（与 quota 拦截 429 区分）
    expect([409, 429].includes(r2.status()), `重复提交应被去重(409)或限流(429)，实际 ${r2.status()}`).toBe(true);
  });
});
