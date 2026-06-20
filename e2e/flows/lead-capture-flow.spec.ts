import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import 'dotenv/config';

/**
 * 流程 B — 线索闭环（跨项目黄金流程）
 *
 * 链路：website 公开页表单提交 → BFF /api/forms/:id/submit
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
 *      setup 阶段通过 BFF API 准备：建站点→建页面(含form)→发布→拿 formId。
 *      若流程A 已跑过可复用其产物；此处自包含以解耦。
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

  // 准备：建站点 + 含表单的已发布页 + 拿 formId
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
        formId,
        contact: { name: CONTACT_NAME, phone: PHONE, source: 'e2e' },
      },
    });
    expect(submitRes.status(), `提交须成功（2xx），实际 ${submitRes.status()}`).toBeLessThan(300);
    const submitBody = await submitRes.json();
    const leadId = submitBody.leadId;
    expect(leadId, '提交须返回 leadId').toBeTruthy();
    await ctx.dispose();

    // === ② 切换到 engine 线索中心（真实登录态），断言该线索可见 ===
    // storageState 已由 auth-setup 预置真实登录
    await page.goto(`/sites/${siteId}/leads`);
    await expect(page.getByRole('heading', { name: '线索中心' })).toBeVisible();

    // 刚提交的线索（按手机号或姓名定位）须出现在列表
    // 手机号在列表可能脱敏，优先用姓名定位
    await expect(page.getByText(CONTACT_NAME).first()).toBeVisible({ timeout: 20_000 });

    // === ③ 进入详情，断言字段一致 + 脱敏 ===
    await page.locator('tr', { hasText: CONTACT_NAME }).first().getByRole('button', { name: '详情' }).click();
    await expect(page.getByText('线索详情')).toBeVisible();

    // 字段一致：姓名
    await expect(page.getByText(CONTACT_NAME)).toBeVisible();
    // 脱敏：手机号 138****.... 格式（不暴露完整）
    const bodyText = await page.locator('body').textContent();
    expect(bodyText, '详情须显示脱敏手机号 138****').toContain('138****');
    expect(bodyText, '详情不得显示明文完整手机号').not.toContain(PHONE);
  });

  test('重复提交相同手机号 → 去重（dedup=true 或 LEAD_DUPLICATE）', async () => {
    const ctx = await apiRequest.newContext();
    const res = await ctx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.0.1' },
      data: {
        formId,
        contact: { name: `${CONTACT_NAME}-dup`, phone: PHONE },
      },
    });
    await ctx.dispose();

    // 去重：要么 2xx 且 dedup=true，要么 409 LEAD_DUPLICATE
    if (res.status() < 300) {
      const body = await res.json();
      expect(body.dedup === true || body.status === 'duplicate', '去重须标记 dedup').toBeTruthy();
    } else {
      expect(res.status(), '去重冲突须 409').toBe(409);
    }
  });

  test.afterAll(async () => {
    if (!siteId) return;
    try {
      const ctx = await apiRequest.newContext();
      await ctx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: { luban_token: token } }).catch(() => {});
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

/** 准备：建站点 + 含 LubanForm 的已发布页，返回 formId */
async function prepareFormFixture(ctx: APIRequestContext): Promise<{ siteId: string; formId: string }> {
  const headers = { luban_token: token, 'Content-Type': 'application/json' };
  const slug = RUN_ID;

  // 建站点
  const siteRes = await ctx.post(`${BFF_BASE}/api/sites`, {
    headers,
    data: { name: `${RUN_ID}-site`, slug, baseUrl: `http://${slug}.test` },
  });
  const site = await siteRes.json();
  const sid = site.id;

  // 建含 LubanForm 的已发布页
  const schemaWithForm = {
    formState: {},
    root: {
      id: 'root',
      type: 'LubanContainer',
      props: { maxWidth: 'full', padded: true },
      children: [
        {
          id: 'form-1',
          type: 'LubanForm',
          props: {
            formId: 'auto', // 后端自动分配
            fields: [
              { name: 'name', label: '姓名', type: 'text', required: true },
              { name: 'phone', label: '手机号', type: 'tel', required: true },
            ],
          },
          children: [],
        },
      ],
    },
  };

  const pageRes = await ctx.post(`${BFF_BASE}/api/sites/${sid}/pages`, {
    headers,
    data: { name: `${RUN_ID}-page`, path: '/lead', schema: schemaWithForm },
  });
  const page = await pageRes.json();
  const pid = page.id;

  // 发布
  await ctx.put(`${BFF_BASE}/api/sites/${sid}/pages/${pid}`, {
    headers,
    data: { name: `${RUN_ID}-page`, path: '/lead', schema: schemaWithForm, status: 'published' },
  });

  // 拿 formId（页面关联的 form）
  const formsRes = await ctx.get(`${BFF_BASE}/api/forms`, { headers, params: { siteId: sid } });
  const forms = await formsRes.json();
  const fid = Array.isArray(forms) && forms.length ? forms[0].id : '';

  return { siteId: sid, formId: fid };
}
