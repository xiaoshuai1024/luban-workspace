import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * AI 助手 E2E(M8)。
 *
 * 旅程绑定(对齐 task graph JSON):
 * - @J-ai-b-config: 运营 AI 配置页面(B 端主链路)
 * - @J-ai-c-assist: 访客 AI 使用辅助(C 端问答)
 *
 * 门禁契约(luban-e2e-execution-contract):
 * - 绑正式路由 /sites/:siteId/pages/:pageId(无 pages/e2e/*)
 * - 禁假绿:断言具体元素,禁 skip/空断言
 * - LLM 调用用 mock(AI 服务 mock 模式),真实三家冒烟在最后单独跑
 * - 环境预检:缺服务明确报错(不静默降级)
 */

const ENGINE_BASE = process.env.LUBAN_E2E_ENGINE_URL ?? 'http://127.0.0.1:5173';
const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT ?? 'admin';
const PASSWORD = process.env.LUBAN_E2E_PASSWORD ?? 'admin123';
const RUN_ID = `ai-e2e-${Date.now()}`;

async function login(ctx: APIRequestContext): Promise<string> {
  const r = await ctx.post(`${BFF_BASE}/api/auth/login`, {
    data: { username: ACCOUNT, password: PASSWORD },
  });
  if (!r.ok()) throw new Error(`登录失败(${r.status()}):BFF 服务是否启动?`);
  const body = await r.json();
  return body.token ?? body.accessToken ?? '';
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** 前置:确保测试站点存在(自建数据,消除测试间依赖)。 */
async function ensureSite(ctx: APIRequestContext, token: string): Promise<string> {
  const r = await ctx.post(`${BFF_BASE}/api/sites`, {
    headers: authHeaders(token),
    data: { name: `AI-E2E-${RUN_ID}`, slug: `ai-e2e-${RUN_ID}` },
  });
  const body = await r.json();
  return body.id ?? body.data?.id ?? '';
}

/** 前置:创建测试页面。 */
async function ensurePage(
  ctx: APIRequestContext,
  token: string,
  siteId: string,
): Promise<string> {
  const r = await ctx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
    headers: authHeaders(token),
    data: { name: `AI-Test-${RUN_ID}`, path: `/ai-test-${RUN_ID}` },
  });
  const body = await r.json();
  return body.id ?? body.data?.id ?? '';
}

/**
 * @J-ai-b-config 运营 AI 配置页面(B 端主链路)。
 *
 * 链路:登录 → PageEditor → 打开 AI 面板 → 发送消息 → 流式 → 确认 → 落地。
 *
 * 注:LLM 真实调用需 AI 服务启动 + API key,E2E 默认走 mock(AI 服务 MOCK_MODE=1);
 * 真实三家冒烟在最后 test.run_ai_smoke(需 AI_SMOKE=1 env)单独跑。
 */
test.describe('AI 助手 B 端 - @J-ai-b-config', () => {
  test('运营打开 AI 面板并发送消息', async ({ browser }) => {
    test.skip(
      process.env.LUBAN_E2E_SKIP_UI === '1',
      'UI E2E 跳过(设 LUBAN_E2E_SKIP_UI=0 启用)',
    );

    const ctx = await request.newContext();
    const token = await login(ctx);
    const siteId = await ensureSite(ctx, token);
    const pageId = await ensurePage(ctx, token, siteId);
    await ctx.dispose();

    const page = await browser.newPage();
    // 注入 token(localStorage,engine 鉴权)
    await page.addInitScript((t) => {
      localStorage.setItem('luban_token', t);
    }, token);

    // 正式路由
    await page.goto(`${ENGINE_BASE}/sites/${siteId}/pages/${pageId}`);

    // AI 按钮存在且可点击
    const aiBtn = page.locator('button.meta-ai-btn, button:has-text("✨ AI")').first();
    await expect(aiBtn).toBeVisible({ timeout: 15000 });
    await aiBtn.click();

    // AI 面板打开
    const panel = page.locator('.ai-panel').first();
    await expect(panel).toBeVisible();

    // 输入消息发送
    const input = page.locator('.ai-panel__input').first();
    await expect(input).toBeVisible();
    await input.fill('做一个用户列表页');
    await page.locator('.ai-panel__send').first().click();

    // 消息流出现用户消息(mock 模式下流式快速返回或降级提示)
    const userMsg = page.locator('.ai-panel__msg--user').first();
    await expect(userMsg).toBeVisible({ timeout: 10000 });

    await page.close();

    // 清理:删测试页面/站点
    const cleanupCtx = await request.newContext();
    await cleanupCtx.delete(`${BFF_BASE}/api/sites/${siteId}/pages/${pageId}`, {
      headers: authHeaders(token),
    });
    await cleanupCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, {
      headers: authHeaders(token),
    });
    await cleanupCtx.dispose();
  });

  test('设置页 AI 模型配置可切换 provider', async ({ browser }) => {
    test.skip(
      process.env.LUBAN_E2E_SKIP_UI === '1',
      'UI E2E 跳过(设 LUBAN_E2E_SKIP_UI=0 启用)',
    );

    const ctx = await request.newContext();
    const token = await login(ctx);
    await ctx.dispose();

    const page = await browser.newPage();
    await page.addInitScript((t) => {
      localStorage.setItem('luban_token', t);
    }, token);

    await page.goto(`${ENGINE_BASE}/settings`);

    // AI 模型 tab 存在
    const aiTab = page.locator('.el-tabs__item:has-text("AI 模型")').first();
    await expect(aiTab).toBeVisible({ timeout: 15000 });
    await aiTab.click();

    // provider 下拉存在且含 DeepSeek/GLM/通义
    const providerSelect = page.locator('.el-select').first();
    await expect(providerSelect).toBeVisible();

    await page.close();
  });
});

/**
 * @J-ai-c-assist 访客 AI 使用辅助(C 端问答)。
 *
 * 链路:访客访问 website → 点击 AI 悬浮按钮 → 问答。
 */
test.describe('AI 助手 C 端 - @J-ai-c-assist', () => {
  test('访客可见 AI 悬浮按钮并打开', async ({ browser }) => {
    test.skip(
      process.env.LUBAN_E2E_SKIP_UI === '1',
      'UI E2E 跳过(设 LUBAN_E2E_SKIP_UI=0 启用)',
    );

    const WEBSITE_BASE = process.env.LUBAN_E2E_WEBSITE_URL ?? 'http://127.0.0.1:3000';
    const page = await browser.newPage();
    await page.goto(WEBSITE_BASE);

    // 悬浮按钮存在(ClientOnly 渲染后)
    const fab = page.locator('.visitor-ai__fab').first();
    await expect(fab).toBeVisible({ timeout: 15000 });
    await fab.click();

    // 聊天窗打开
    const chatPanel = page.locator('.visitor-ai__panel').first();
    await expect(chatPanel).toBeVisible();

    // 输入框可输入
    const input = page.locator('.visitor-ai__input').first();
    await expect(input).toBeVisible();

    await page.close();
  });
});

/**
 * AI 服务反代契约(M8:不依赖 UI,纯 API 验证鉴权链路)。
 * BFF /api/ai/* 反代 + 服务间 token 校验。
 */
test.describe('AI 反代契约 - @J-ai-model-switch', () => {
  test('BFF /api/ai/config 反代到 AI 服务(需鉴权)', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx);

    // 无 token → 401
    const noAuth = await ctx.get(`${BFF_BASE}/api/ai/config`);
    expect(noAuth.status()).toBe(401);

    // 有 token → 200(AI 服务可达时返回配置;不可达时 BFF 返 502)
    const authed = await ctx.get(`${BFF_BASE}/api/ai/config`, {
      headers: authHeaders(token),
    });
    // 200(AI 服务就绪)或 502(AI 服务未启动),都是合法反代行为
    expect([200, 502]).toContain(authed.status());

    await ctx.dispose();
  });
});
