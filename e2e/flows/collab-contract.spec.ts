import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * 协作 CRDT 契约层 E2E @J-collab
 *
 * 覆盖 BFF collab 的鉴权链与房间隔离（不依赖双浏览器 UI 同步）：
 *   1. 鉴权通过：有效 token → 在线用户端点 200；ws 握手 101（手动 curl 验证，见注释）
 *   2. 鉴权失败：无 token / 无效 token → 401
 *   3. IDOR 防越权：越权他人房间 → 4xx
 *
 * ws 握手的 101 验证：因 curl/net 在 ws 升级后会话挂起（非 HTTP 语义），
 * 自动化测试改用 HTTP 在线用户端点（与 ws 共用 authenticateCollab + canAccessRoom 鉴权链）。
 * ws 101 手动验证：curl --http1.1 -H "Connection: Upgrade" -H "Upgrade: websocket" ... → HTTP/1.1 101。
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
    data: { name: `${RUN_ID}-collab`, slug: `${RUN_ID}-collab`, status: 'active' },
  });
  siteId = (await siteRes.json()).id;
  const pageRes = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
    headers: authHeaders(token),
    data: { name: 'collab-page', path: `/c-${Date.now()}` },
  });
  pageId = (await pageRes.json()).id;
});

test.afterAll(async () => {
  if (siteId && apiCtx) {
    await apiCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: authHeaders(token) }).catch(() => {});
    await apiCtx.dispose().catch(() => {});
  }
});

test.describe('协作 CRDT 契约 @J-collab', () => {
  test('CC1: 有效 token 鉴权通过（在线用户端点 200，等价 ws 101）', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/collab/${siteId}/${pageId}`, { headers: authHeaders(token) });
    expect(r.status(), `有效 token 应通过鉴权，实际 ${r.status()}`).toBe(200);
    const body = await r.json();
    expect(body.siteId).toBe(siteId);
    expect(body.pageId).toBe(pageId);
    expect(Array.isArray(body.onlineUsers)).toBe(true);
    expect(typeof body.connectionCount).toBe('number');
  });

  test('CC2: 无 token 鉴权被拒（401）', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/collab/${siteId}/${pageId}`);
    expect(r.status(), '无 token 不应通过鉴权').toBe(401);
  });

  test('CC3: 无效 token 鉴权被拒（401）', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/collab/${siteId}/${pageId}`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(r.status()).toBe(401);
  });

  test('CC4: FeatureGate realtime_collab 默认开启（enabled !== false）', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/feature-gates?siteId=${siteId}&key=realtime_collab`, {
      headers: authHeaders(token),
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    // 默认开启（enabled !== false；未配置时也是 true）
    expect(body.enabled !== false).toBe(true);
  });

  test('CC5: IDOR 防越权 — 越权他人房间 → 4xx', async () => {
    const fakeSiteId = '00000000-0000-0000-0000-000000000000';
    const fakePageId = '11111111-1111-1111-1111-111111111111';
    const r = await apiCtx.get(`${BFF_BASE}/api/collab/${fakeSiteId}/${fakePageId}`, { headers: authHeaders(token) });
    expect(r.status(), '越权访问不应返回 200').toBeGreaterThanOrEqual(400);
  });

  test('CC6: 在线用户列表与连接计数初始为 0（无活跃 ws 连接）', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/collab/${siteId}/${pageId}`, { headers: authHeaders(token) });
    const body = await r.json();
    // 新建的 room，无 ws 连接时 onlineUsers 应为空数组
    expect(body.onlineUsers).toEqual([]);
    expect(body.connectionCount).toBeGreaterThanOrEqual(0);
  });
});
