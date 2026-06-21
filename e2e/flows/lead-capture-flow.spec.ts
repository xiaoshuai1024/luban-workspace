import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import 'dotenv/config';

/**
 * 流程 B — 线索闭环（跨项目黄金流程）
 *
 * 链路：经 BFF 公开端点提交线索（模拟 website 访客表单）
 *      → backend 入库（去重/防刷/加密）→ engine 线索中心列表可见该条记录
 *
 * 真实性保证（G1/G2 门禁）：
 *   - 表单提交走真实 BFF 公开端点（免 token，模拟访客）
 *   - 线索真实入库 backend（经 BFF callBackend 透传）
 *   - engine 用真实登录账号查线索列表，断言刚提交的记录可见
 *   - 字段一致性（contact 内容）、脱敏（手机号 138****8000）
 *   - 任一环节断（如停 backend）则红
 *
 * 前置：defaultSite 下须有含 LubanForm 物料的已发布页（formId）。
 *      Form 必须显式 POST /api/forms 创建（后端不会因页面 schema 含 LubanForm 而自动建 form）。
 */

const WEBSITE_BASE = process.env.LUBAN_E2E_WEBSITE_URL ?? 'http://127.0.0.1:3000';
const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT!;
const PASSWORD = process.env.LUBAN_E2E_PASSWORD!;

const RUN_ID = `e2e-${Date.now()}`;
const PHONE = `138${Math.floor(10000000 + Math.random() * 89999999)}`;
const CONTACT_NAME = `${RUN_ID}-访客`;

let token = '';
let siteId = '';
let formId = '';

test.beforeAll(async () => {
  if (!ACCOUNT || !PASSWORD) throw new Error('[lead-flow] 缺 LUBAN_E2E_ACCOUNT/PASSWORD');
  const ctx = await apiRequest.newContext();
  token = await login(ctx);

  // 准备：建站点 + 显式建 form（含 name/phone 字段）+ 拿 formId
  const setup = await prepareFormFixture(ctx);
  siteId = setup.siteId;
  formId = setup.formId;
  await ctx.dispose();

  expect(siteId, 'setup 须拿到 siteId').toBeTruthy();
  expect(formId, 'setup 须拿到 formId').toBeTruthy();
});

test.describe('流程B：线索闭环 @cross', () => {
  test('website 表单提交 → backend 入库 → engine 线索中心可见', async ({ page }) => {
    test.setTimeout(120_000);

    // === ① 通过 BFF 公开端点提交线索（模拟 website 访客表单）===
    const ctx = await apiRequest.newContext();
    const submitRes = await ctx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.0.1' },
      data: {
        // 后端 @Valid 校验要求 body.formId 非空（URL path :id 在校验后才覆盖）
        formId,
        contact: { name: CONTACT_NAME, phone: PHONE, source: 'e2e' },
      },
    });
    const submitStatus = submitRes.status();
    expect(submitStatus, `提交须成功（2xx），实际 ${submitStatus}`).toBeLessThan(300);
    const submitBody = await submitRes.json();
    const dedup = submitBody.dedup;
    // 安全：公开 API 不返回 leadId，只返回入库状态
    expect(submitBody.status, '提交须返回入库状态').toBeTruthy();
    // 如返回 dedup 标记，确认其为布尔值
    if (dedup !== undefined) {
      expect(typeof dedup, 'dedup 须为布尔值').toBe('boolean');
    }
    await ctx.dispose();

    // === ② 切换到 engine 线索中心（真实登录态），断言该线索可见 ===
    // storageState 已由 auth-setup 预置真实登录；engine 按当前站点查线索
    await page.goto(`/sites/${siteId}/leads`);
    await expect(page.getByRole('heading', { name: '线索中心' })).toBeVisible();

    // 刚提交的线索（按姓名定位，手机号在列表可能脱敏）须出现在列表
    await expect(page.getByText(CONTACT_NAME).first()).toBeVisible({ timeout: 20_000 });

    // === ③ 进入详情，断言字段一致 + 脱敏 ===
    await page.locator('tr', { hasText: CONTACT_NAME }).first().getByRole('button', { name: '详情' }).click();
    await expect(page.getByRole('heading', { name: '线索详情' })).toBeVisible();

    // 字段一致：姓名
    await expect(page.getByText(CONTACT_NAME)).toBeVisible();
    // 脱敏：手机号 138****.... 格式（不暴露完整）
    const bodyText = await page.locator('body').textContent();
    expect(bodyText, '详情须显示脱敏手机号 138****').toContain('138****');
    expect(bodyText, '详情不得显示明文完整手机号').not.toContain(PHONE);
  });

  test('重复提交相同手机号 → 去重（默认 REJECT → 409 LEAD_DUPLICATE）', async () => {
    const ctx = await apiRequest.newContext();
    const res = await ctx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.0.1' },
      data: {
        formId,
        contact: { name: `${CONTACT_NAME}-dup`, phone: PHONE },
      },
    });
    const status = res.status();
    // 默认策略 REJECT：重复同手机号 → 409 LEAD_DUPLICATE
    // （若 form 配 MARK：2xx 且 dedup=true；这里默认 reject 走 409 分支）
    let body: any = null;
    if (status < 300) {
      body = await res.json();
    }
    await ctx.dispose();

    if (status < 300) {
      expect(body?.dedup === true || body?.status === 'invalid', '去重须标记 dedup').toBeTruthy();
    } else {
      expect(status, `去重冲突须 409，实际 ${status}`).toBe(409);
    }
  });

  test.afterAll(async () => {
    if (!siteId) return;
    try {
      const ctx = await apiRequest.newContext();
      await ctx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
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

/**
 * 准备：建站点 + 建 page + 显式建含 name/phone 字段的 form，返回 formId。
 * 后端不会因页面 schema 含 LubanForm 而自动建 form（PageService 不扫描 schema），
 * 故必须显式 POST /api/forms。forms.page_id 为 NOT NULL 且有外键，须传有效 pageId。
 * submit 只认 formId，页面 schema 物料对 lead 入库无影响。
 */
async function prepareFormFixture(ctx: APIRequestContext): Promise<{ siteId: string; formId: string }> {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 建站点
  const siteRes = await ctx.post(`${BFF_BASE}/api/sites`, {
    headers,
    data: { name: `${RUN_ID}-site`, slug: RUN_ID, baseUrl: `http://${RUN_ID}.test`, status: 'active' },
  });
  expect(siteRes.status(), `建站点须成功，实际 ${siteRes.status()}`).toBeLessThan(300);
  const site = await siteRes.json();
  const sid = site.id;

  // 建 page（form.page_id NOT NULL + 外键，须先有 page）
  const EMPTY_SCHEMA = { formState: {}, root: { id: 'root', type: 'LubanContainer', props: {}, children: [] } };
  const pageRes = await ctx.post(`${BFF_BASE}/api/sites/${sid}/pages`, {
    headers,
    data: { name: `${RUN_ID}-page`, path: '/lead', schema: EMPTY_SCHEMA, status: 'published' },
  });
  expect(pageRes.status(), `建 page 须成功，实际 ${pageRes.status()}`).toBeLessThan(300);
  const page = await pageRes.json();
  const pageId = page.id;

  // 显式建 form（含 name/phone 字段，dedup 默认 phone/reject）
  const formRes = await ctx.post(`${BFF_BASE}/api/forms`, {
    headers,
    data: {
      siteId: sid,
      pageId,
      name: `${RUN_ID}-form`,
      fieldSchema: {
        fields: [
          { name: 'name', label: '姓名', type: 'text', required: true },
          { name: 'phone', label: '手机号', type: 'tel', required: true },
        ],
      },
      dedupKeys: ['phone'],
      dedupPolicy: 'reject',
      status: 'active',
    },
  });
  expect(formRes.status(), `建 form 须成功，实际 ${formRes.status()}`).toBeLessThan(300);
  const form = await formRes.json();
  const fid = form.id;

  return { siteId: sid, formId: fid };
}
