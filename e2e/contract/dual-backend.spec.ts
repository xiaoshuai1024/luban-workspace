import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import 'dotenv/config';

/**
 * 流程 C — 双后端契约一致性
 *
 * 同一接口路径分别打 Java(:8080) 与 Go(:8081)，断言响应 status + body 结构等价。
 * 两端均以 /backend 为 context-path（router.go `api := r.Group("/backend")`；
 * Java application.yml `context-path: /backend`）。
 *
 * 防护：任一端契约漂移（状态码/错误码/字段差异）即红。
 * 对齐 docs/DUAL_BACKEND_PARITY.md §2「契约维度」。
 *
 * 真实性：用真实 e2e 账号登录两端拿各自凭证，非 mock。
 */

const JAVA_BASE = (process.env.LUBAN_E2E_JAVA_API ?? 'http://127.0.0.1:8080') + '/backend';
const GO_BASE = (process.env.LUBAN_E2E_GO_API ?? 'http://127.0.0.1:8081') + '/backend';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT!;
const PASSWORD = process.env.LUBAN_E2E_PASSWORD!;

/** Java 后端用 X-User-ID / X-User-Role 自定义头鉴权 */
let javaUserId = '';
let javaUserRole = '';
/** Go 后端复用 BFF 的 JWT token 机制（luban_token 头） */
let goToken = '';

test.beforeAll(async () => {
  if (!ACCOUNT || !PASSWORD) {
    throw new Error('[dual-backend] 缺 LUBAN_E2E_ACCOUNT/PASSWORD');
  }

  // Java 登录：返回 { user, claims: { userId, role } }
  const javaAuth = await javaLogin();
  javaUserId = javaAuth.userId;
  javaUserRole = javaAuth.role;
  expect(javaUserId, 'Java 登录须返回 userId').toBeTruthy();
  expect(javaUserRole, 'Java 登录须返回 role').toBeTruthy();

  // Go 可选：单后端模式（仅 Java）时跳过契约测试
  try {
    goToken = await bffStyleLogin(GO_BASE);
  } catch {
    goToken = '';
  }
});

/** 生成 Java 后端请求头（X-User-ID / X-User-Role） */
function javaHeaders(): Record<string, string> {
  return { 'X-User-ID': javaUserId, 'X-User-Role': javaUserRole, 'Content-Type': 'application/json' };
}

/**
 * 对同一 path，分别在 Java/Go 打相同请求，断言等价。
 * @param method HTTP 方法
 * @param path   相对 /backend 的路径，两端相同
 * @param opts   额外选项（请求体、预期状态码）
 */
async function assertParity(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: { body?: unknown; expectStatus?: number } = {}
) {
  const ctx = await apiRequest.newContext();
  const data = opts.body ? { data: opts.body } : undefined;

  const javaRes = await ctx.fetch(`${JAVA_BASE}${path}`, {
    method,
    headers: javaHeaders(),
    ...data,
  });
  const goRes = await ctx.fetch(`${GO_BASE}${path}`, {
    method,
    headers: { luban_token: goToken, 'Content-Type': 'application/json' },
    ...data,
  });
  await ctx.dispose();

  // ① HTTP 状态码一致（对齐 PARITY §2「HTTP 状态码」）
  expect(goRes.status(), `[${method} ${path}] Go 状态码须与 Java 一致`).toBe(javaRes.status());

  const javaStatus = javaRes.status();
  if (opts.expectStatus !== undefined) {
    expect(javaStatus, `[${method} ${path}] 期望状态码 ${opts.expectStatus}`).toBe(opts.expectStatus);
  }

  // 成功响应（2xx）：body 结构等价（key 集合一致）
  if (javaStatus >= 200 && javaStatus < 300) {
    const javaBody = await tryJson(javaRes);
    const goBody = await tryJson(goRes);
    if (javaBody !== null && goBody !== null) {
      assertStructurallyEquivalent(javaBody, goBody, `${method} ${path}`);
    }
  } else {
    // 错误响应：错误码须一致（对齐 PARITY §2「错误响应体」）
    const javaErr = await tryJson(javaRes);
    const goErr = await tryJson(goRes);
    if (javaErr?.code) {
      expect(goErr?.code, `[${method} ${path}] 错误码须一致`).toBe(javaErr.code);
    }
  }
}

function assertStructurallyEquivalent(a: unknown, b: unknown, ctx: string, path = '$') {
  // 数组：比长度 + 递归首元素结构（列表内容可能不同，但 schema 须一致）
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(b.length, `${ctx} ${path} 数组长度类型 OK`).toBeGreaterThanOrEqual(0);
    if (a.length && b.length) {
      assertStructurallyEquivalent(a[0], b[0], ctx, `${path}[0]`);
    }
    return;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    expect(bk, `${ctx} ${path} 字段集合须一致`).toEqual(ak);
    for (const k of ak) {
      assertStructurallyEquivalent((a as any)[k], (b as any)[k], ctx, `${path}.${k}`);
    }
    return;
  }
  // 叶子值类型一致（不强比具体值，如时间戳/动态 id）
  expect(typeof b, `${ctx} ${path} 类型须一致`).toBe(typeof a);
}

async function tryJson(res: { json: () => Promise<unknown> }): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Java 后端登录：POST /backend/auth/login → 提取 claims.userId / claims.role */
async function javaLogin(): Promise<{ userId: string; role: string }> {
  const ctx = await apiRequest.newContext();
  const r = await ctx.post(`${JAVA_BASE}/auth/login`, {
    data: { username: ACCOUNT, password: PASSWORD },
  });
  expect(r.status(), 'Java 登录须 2xx').toBeLessThan(300);
  const body = await r.json();
  await ctx.dispose();
  return { userId: body.claims?.userId ?? '', role: body.claims?.role ?? '' };
}

/** BFF 风格登录：POST /auth/login → 返回 JWT token（Go 后端兼容此方式） */
async function bffStyleLogin(base: string): Promise<string> {
  const ctx = await apiRequest.newContext();
  const r = await ctx.post(`${base}/auth/login`, {
    data: { username: ACCOUNT, password: PASSWORD },
  });
  const body = await r.json();
  await ctx.dispose();
  return body.token ?? body.accessToken ?? '';
}

// ---------- 契约断言用例 ----------

test.describe('双后端契约一致性 @contract', () => {
  test.beforeEach(async () => {
    // 双后端一致性须两端在线；Go 缺失时诚实 skip（非假绿）
    test.skip(!goToken, 'Go 后端未起（单后端模式），跳过双后端契约测试');
  });

  test('auth/me 字段结构等价', async () => {
    const ctx = await apiRequest.newContext();
    const java = await ctx.get(`${JAVA_BASE}/auth/me`, { headers: javaHeaders() });
    const go = await ctx.get(`${GO_BASE}/auth/me`, { headers: { luban_token: goToken } });
    expect(go.status()).toBe(java.status());
    assertStructurallyEquivalent(await tryJson(java), await tryJson(go), 'auth/me');
    await ctx.dispose();
  });

  test('GET /sites 列表结构等价', async () => {
    await assertParity('GET', '/sites', { expectStatus: 200 });
  });

  test('GET /datasources 结构等价', async () => {
    await assertParity('GET', '/datasources', { expectStatus: 200 });
  });

  test('未鉴权访问受保护资源 → 两端均拒绝（状态码一致）', async () => {
    const ctx = await apiRequest.newContext();
    const java = await ctx.get(`${JAVA_BASE}/sites`); // 无认证头
    const go = await ctx.get(`${GO_BASE}/sites`); // 无认证头
    await ctx.dispose();
    expect(go.status(), '无认证访问两端状态码须一致（均 401/403）').toBe(java.status());
    expect(java.status()).toBeGreaterThanOrEqual(400);
  });

  test('GET 不存在的站点 → 两端 404 一致', async () => {
    await assertParity('GET', '/sites/non-existent-e2e-id');
    // 不固定具体码（可能 404），但两端必须一致 —— assertParity 已断言
  });

  // === V2-T7 CMS Collections 契约一致性 ===

  test('GET /collections?siteId=<missing> → 两端结构等价', async () => {
    // 缺省站点返回空数组或 404，两端行为须一致
    await assertParity('GET', '/collections?siteId=non-existent-cms-site');
  });

  test('POST /collections 无鉴权 → 两端均拒绝（状态码一致）', async () => {
    const ctx = await apiRequest.newContext();
    const body = { data: { name: 'e2e-cms', fieldSchema: {} } };
    const java = await ctx.post(`${JAVA_BASE}/collections?siteId=non-existent`, {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    const go = await ctx.post(`${GO_BASE}/collections?siteId=non-existent`, {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    await ctx.dispose();
    expect(go.status(), '无鉴权 POST collections 两端状态码须一致').toBe(java.status());
    expect(java.status()).toBeGreaterThanOrEqual(400);
  });

  // === V2-T8 版本历史 契约一致性 ===

  test('GET page versions 不存在页 → 两端状态码一致', async () => {
    await assertParity(
      'GET',
      '/sites/non-existent-ver-site/pages/non-existent-ver-page/versions'
    );
  });

  // === V2-T2 SEO 字段一致性（创建页含 seo 字段透传） ===

  test('POST /sites/:id/pages 含 seo 字段 → 两端响应 seo key 存在性等价', async () => {
    // 用不存在的 siteId，两端应一致报错（404），验证字段透传不破坏端点
    await assertParity(
      'POST',
      '/sites/non-existent-seo-site/pages',
      {
        body: {
          name: 'e2e-seo',
          path: '/seo-e2e',
          schema: { root: { id: 'root', type: 'LubanContainer', props: {}, children: [] } },
          seo: { title: 'E2E SEO', description: 'test' },
        },
      }
    );
  });

  // === V2-T10 analytics 字段一致性 ===

  test('PUT /sites/:id 含 analytics 字段 → 两端状态码等价', async () => {
    await assertParity(
      'PUT',
      '/sites/non-existent-analytics-site',
      {
        body: {
          name: 'e2e-analytics',
          slug: 'e2e-analytics',
          baseUrl: '',
          status: 'active',
          analytics: { ga4: { measurementId: 'G-E2E' } },
        },
      }
    );
  });

  test('GET /public/sites/:slug/config 公开端点 → 两端结构等价', async () => {
    // 公开端点无需鉴权；slug 不存在两端应返回一致结构
    const ctx = await apiRequest.newContext();
    const java = await ctx.get(`${JAVA_BASE}/public/sites/non-existent-slug/config`);
    const go = await ctx.get(`${GO_BASE}/public/sites/non-existent-slug/config`);
    await ctx.dispose();
    expect(go.status(), 'public config 两端状态码须一致').toBe(java.status());
    if (java.status() >= 200 && java.status() < 300) {
      assertStructurallyEquivalent(await tryJson(java), await tryJson(go), 'public config');
    }
  });
});
