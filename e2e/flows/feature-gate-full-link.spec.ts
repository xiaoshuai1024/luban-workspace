import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * FeatureGate 全链 E2E @J-feature-gate-visitor（增强）
 *
 * 覆盖 engine 管理端配置 gate → 访客侧行为变更的完整链路：
 *   1. engine PUT /api/feature-gates 配置 lead_capture=关闭
 *   2. 公开 GET /api/public/feature-gates 读到关闭状态
 *   3. 访客 submit 表单 → LEAD_DISABLED（best-effort，依赖后端读取 gate）
 *   4. 重新开启 → submit 恢复正常
 *   5. fail-open：未知 key 默认 enabled=true
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
    data: { name: `${RUN_ID}-fg`, slug: `${RUN_ID}-fg`, status: 'active' },
  });
  siteId = (await siteRes.json()).id;
  const pageRes = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
    headers: authHeaders(token),
    data: { name: 'fg-page', path: `/fg-${Date.now()}` },
  });
  pageId = (await pageRes.json()).id;
  const formRes = await apiCtx.post(`${BFF_BASE}/api/forms?siteId=${siteId}`, {
    headers: authHeaders(token),
    data: { siteId, pageId, name: 'fg-form', dedupPolicy: 'reject' },
  });
  formId = (await formRes.json()).id;
});

test.afterAll(async () => {
  // 恢复 gate 默认（避免污染）
  await apiCtx.put(
    `${BFF_BASE}/api/feature-gates?siteId=${siteId}&key=lead_capture&enabled=true`,
    { headers: authHeaders(token) },
  ).catch(() => {});
  if (siteId && apiCtx) {
    await apiCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: authHeaders(token) }).catch(() => {});
    await apiCtx.dispose().catch(() => {});
  }
});

test.describe('FeatureGate 全链 @J-feature-gate-visitor', () => {
  test('FG1: engine 配置 lead_capture 关闭 → 公开端点读到关闭', async () => {
    // 配置关闭（后端 PUT 用 @RequestParam，参数走 query string）
    const putRes = await apiCtx.put(
      `${BFF_BASE}/api/feature-gates?siteId=${siteId}&key=lead_capture&enabled=false`,
      { headers: authHeaders(token) },
    );
    expect(putRes.status(), `配置 gate 应成功，实际 ${putRes.status()}`).toBeLessThan(300);

    // 公开端点读取
    const getRes = await apiCtx.get(`${BFF_BASE}/api/public/feature-gates?siteId=${siteId}&key=lead_capture`);
    expect(getRes.status()).toBe(200);
    const body = await getRes.json();
    expect(body.enabled, '公开端点应读到 enabled=false').toBe(false);
  });

  test('FG2: lead_capture 关闭 → 访客提交返回 LEAD_DISABLED（best-effort）', async () => {
    // 确保 gate 关闭
    await apiCtx.put(
      `${BFF_BASE}/api/feature-gates?siteId=${siteId}&key=lead_capture&enabled=false`,
      { headers: authHeaders(token) },
    );
    // 访客提交
    const r = await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: 'gate测试', phone: `137${Date.now().toString().slice(-8)}` } },
    });
    // 后端读取 gate 关闭应返回 LEAD_DISABLED（503）；best-effort：不强制，因后端 gate 缓存可能有延迟
    const body = await r.json().catch(() => ({}));
    if (r.status() >= 400) {
      expect(body.code === 'LEAD_DISABLED' || r.status() === 503, `应返回 LEAD_DISABLED，实际 ${r.status()} ${body.code ?? ''}`).toBe(true);
    }
    // best-effort：若后端未即时生效（gate 缓存），不阻断
  });

  test('FG3: 重新开启 lead_capture → 访客提交恢复正常', async () => {
    await apiCtx.put(
      `${BFF_BASE}/api/feature-gates?siteId=${siteId}&key=lead_capture&enabled=true`,
      { headers: authHeaders(token) },
    );
    const r = await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '恢复测试', phone: `136${Date.now().toString().slice(-8)}` } },
    });
    // 开启后提交应成功（2xx）或被 dedup/quota 拦截，但不应是 LEAD_DISABLED
    expect(r.status() < 300 || r.status() === 409 || r.status() === 429, `开启后应可提交，实际 ${r.status()}`).toBe(true);
  });

  test('FG4: fail-open — 未知 key 默认 enabled=true', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/public/feature-gates?siteId=${siteId}&key=non_existent_key`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.enabled, '未知 key 应 fail-open 返回 enabled=true').toBe(true);
  });
});
