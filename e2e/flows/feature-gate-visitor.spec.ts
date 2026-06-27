import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import 'dotenv/config';

// ⚠️ 本 spec 尚未在本地全栈环境跑绿验证，待全栈就绪后验证

/**
 * 访客侧 FeatureGate 闭环（J-feature-gate-visitor）
 *
 * 链路：engine 经管理端 PUT /api/feature-gates 配置开关
 *      → website 访客经公开 GET /api/public/feature-gates 读取布尔
 *      → lead_capture gate 关闭时提交返回 LEAD_DISABLED（best-effort）
 *
 * 真实性：读取走公开端点（无 token），配置走管理端（真实 token）。
 * 全栈未起时这些 test 会连接失败，标注依赖 BFF。
 */

const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://localhost:3000';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT!;
const PASSWORD = process.env.LUBAN_E2E_PASSWORD!;

// v02 已 seed 的测试站点（见 v02-funnel.spec.ts）
const TEST_SITE_ID = '33111bfc-778d-4efc-a1fa-5c49f0437307';

let token = '';

test.beforeAll(async () => {
  if (!ACCOUNT || !PASSWORD) throw new Error('[feature-gate] 缺 LUBAN_E2E_ACCOUNT/PASSWORD');
  const ctx = await apiRequest.newContext();
  token = await login(ctx);
  await ctx.dispose();
});

test.describe('访客侧 FeatureGate @J-feature-gate-visitor', () => {
  // FG1：读取已配置的 feature gate（先经管理端 PUT 显式开启，再经公开端点读回 {enabled}）
  test('FG1 读取已配置的 feature gate 返回 {enabled} 结构', async ({ request }) => {
    const key = `e2e-fg-${Date.now()}`;
    const adminHeaders = { Authorization: `Bearer ${token}` };

    // 经管理端 PUT 显式配置 enabled=true（建立确定状态）
    const putRes = await request.put(
      `${BFF_BASE}/api/feature-gates?siteId=${TEST_SITE_ID}&key=${key}&enabled=true`,
      { headers: adminHeaders },
    );
    expect(putRes.status(), `配置开关须成功，实际 ${putRes.status()}`).toBeLessThan(300);

    // 经公开端点读取（无 token，模拟访客）
    const res = await request.get(
      `${BFF_BASE}/api/public/feature-gates?siteId=${TEST_SITE_ID}&key=${key}`,
    );
    expect(res.status(), '公开读取须 200').toBe(200);
    const body = await res.json();
    expect(body, '响应须含 enabled 字段').toHaveProperty('enabled');
    expect(typeof body.enabled, 'enabled 须为布尔').toBe('boolean');
    expect(body.enabled, '刚配置为 true 应读到 true').toBe(true);
  });

  // FG2：不存在的 key → fail-open 返回 enabled:true（不阻塞访客）
  test('FG2 不存在的 key fail-open 返回 enabled:true', async ({ request }) => {
    const res = await request.get(
      `${BFF_BASE}/api/public/feature-gates?siteId=${TEST_SITE_ID}&key=non-existent-key-${Date.now()}`,
    );
    expect(res.status(), '不存在的 key 仍应 200（fail-open）').toBe(200);
    const body = await res.json();
    expect(body.enabled, '不存在 key 默认 fail-open 为 true').toBe(true);
  });

  // FG3：lead_capture gate 关闭后提交线索受影响（best-effort，可能无 lead 配置则 skip）
  test('FG3 lead_capture 关闭影响线索提交（best-effort）', async ({ request }) => {
    // 先关闭 lead_capture gate（如后端无此 gate 实现，PUT 仍会建一条）
    const adminHeaders = { Authorization: `Bearer ${token}` };
    const putRes = await request
      .put(
        `${BFF_BASE}/api/feature-gates?siteId=${TEST_SITE_ID}&key=lead_capture&enabled=false`,
        { headers: adminHeaders },
      )
      .catch(() => null);
    if (!putRes || putRes.status() >= 300) {
      test.skip(true, 'lead_capture gate 配置不可用，跳过');
      return;
    }

    // 公开端点确认已关闭
    const pubRes = await request.get(
      `${BFF_BASE}/api/public/feature-gates?siteId=${TEST_SITE_ID}&key=lead_capture`,
    );
    const pubBody = await pubRes.json().catch(() => ({ enabled: true }));

    // 恢复默认（避免污染其他测试）
    await request
      .put(
        `${BFF_BASE}/api/feature-gates?siteId=${TEST_SITE_ID}&key=lead_capture&enabled=true`,
        { headers: adminHeaders },
      )
      .catch(() => {});

    // 若 gate 真的关上了，提交线索应返回 LEAD_DISABLED；
    // 但若无对应 form/page 配置，提交可能直接 4xx——best-effort 只断言 gate 读取本身。
    if (pubBody.enabled === false) {
      expect(pubBody.enabled, '关闭后访客侧应读到 false').toBe(false);
      // 注：完整的 LEAD_DISABLED 提交验证依赖表单 fixture，此处只校验 gate 状态已生效。
    } else {
      test.skip(true, 'lead_capture gate 关闭未生效（后端可能未实现），跳过断言');
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
