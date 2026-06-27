import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import 'dotenv/config';

// ⚠️ 本 spec 尚未在本地全栈环境跑绿验证，待全栈就绪后验证

/**
 * 套餐与用量（J-billing）
 *
 * 链路：登录拿 token → GET /api/billing/plans 查三档套餐
 *      → GET /api/billing/usage 查当月用量
 *
 * 前置：DB 已 seed v02 三档套餐（free/starter/growth）。
 * 参照 v02-funnel.spec.ts 已有的套餐断言（plans.length>=3 + planCode 含三档）。
 */

const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://localhost:3000';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT!;
const PASSWORD = process.env.LUBAN_E2E_PASSWORD!;

let token = '';

test.beforeAll(async () => {
  if (!ACCOUNT || !PASSWORD) throw new Error('[billing] 缺 LUBAN_E2E_ACCOUNT/PASSWORD');
  const ctx = await apiRequest.newContext();
  token = await login(ctx);
  await ctx.dispose();
  expect(token, '登录须返回 token').toBeTruthy();
});

test.describe('套餐与用量 @J-billing', () => {
  // B1：套餐列表返回三档（free/starter/growth）
  test('B1 套餐列表返回三档 free/starter/growth', async ({ request }) => {
    const res = await request.get(`${BFF_BASE}/api/billing/plans`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), `查套餐须 2xx，实际 ${res.status()}`).toBeLessThan(300);
    const plans = await res.json();
    expect(Array.isArray(plans), '套餐须为数组').toBe(true);
    expect(plans.length, '应有三档套餐').toBeGreaterThanOrEqual(3);
    expect(plans.map((p: { planCode: string }) => p.planCode), '应含 free/starter/growth')
      .toEqual(expect.arrayContaining(['free', 'starter', 'growth']));
  });

  // B2：用量查询返回结构（best-effort，断言 200 + 有用量字段）
  test('B2 用量查询返回用量结构（best-effort）', async ({ request }) => {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const res = await request.get(`${BFF_BASE}/api/billing/usage?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const status = res.status();
    // 用量可能因未订阅返回特定结构；只断言 2xx 且返回 JSON 对象
    expect(status, `查用量须 2xx，实际 ${status}`).toBeLessThan(300);
    const body = await res.json().catch(() => null);
    expect(body, '用量须返回 JSON 体').toBeTruthy();
    expect(typeof body, '用量响应须为对象结构').toBe('object');
    // best-effort：若返回对象，至少有一个用量相关字段（不强求具体键名）
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      expect(Object.keys(body as object).length, '用量对象应非空').toBeGreaterThan(0);
    }
  });
});

// ---------- helpers ----------

async function login(ctx: APIRequestContext): Promise<string> {
  const r = await ctx.post(`${BFF_BASE}/api/auth/login`, {
    data: { username: ACCOUNT, password: PASSWORD },
  });
  expect(r.status(), `登录须 200，实际 ${r.status()}`).toBe(200);
  const body = await r.json();
  return body.token ?? body.accessToken ?? '';
}
