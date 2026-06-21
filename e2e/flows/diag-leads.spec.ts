import { test, expect } from '@playwright/test';
import 'dotenv/config';

// 临时诊断：用 storageState 访问线索中心，捕获网络请求与 siteId
const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100';

test('diag: engine leads network', async ({ page }) => {
  // 先建一个 site + form + lead（API），拿 siteId
  const ctx = await page.request;
  const loginRes = await ctx.post(`${BFF_BASE}/api/auth/login`, {
    data: { username: process.env.LUBAN_E2E_ACCOUNT, password: process.env.LUBAN_E2E_PASSWORD },
  });
  const { token } = await loginRes.json();
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const uniq = Date.now();
  const siteRes = await ctx.post(`${BFF_BASE}/api/sites`, { headers: H, data: { name: `diag${uniq}`, slug: `diag${uniq}`, baseUrl: 'http://d.test', status: 'active' } });
  const site = await siteRes.json();
  const sid = site.id;
  const pageRes = await ctx.post(`${BFF_BASE}/api/sites/${sid}/pages`, { headers: H, data: { name: 'p', path: '/l', schema: { formState: {}, root: { id: 'r', type: 'LubanContainer', props: {}, children: [] } }, status: 'published' } });
  const pg = await pageRes.json();
  const formRes = await ctx.post(`${BFF_BASE}/api/forms`, { headers: H, data: { siteId: sid, pageId: pg.id, name: 'df', fieldSchema: { fields: [{ name: 'name', type: 'text' }, { name: 'phone', type: 'tel' }] }, dedupKeys: ['phone'], status: 'active' } });
  const form = await formRes.json();
  await ctx.post(`${BFF_BASE}/api/forms/${form.id}/submit`, { headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.0.1' }, data: { formId: form.id, contact: { name: `DIAG访客${uniq}`, phone: '13800000000' } } });
  console.log('DIAG siteId=', sid, 'formId=', form.id);

  // 拦截 leads 请求
  page.on('request', (r) => {
    if (r.url().includes('/leads') || r.url().includes('/api/')) console.log('REQ:', r.method(), r.url());
  });
  page.on('response', async (r) => {
    if (r.url().includes('/leads')) {
      try { console.log('RES leads:', r.status(), (await r.text()).slice(0, 300)); } catch { console.log('RES leads:', r.status()); }
    }
  });

  await page.goto(`/sites/${sid}/leads`);
  await page.waitForTimeout(3000);
  console.log('URL after goto:', page.url());
  console.log('localStorage luban_current_site_id:', await page.evaluate(() => localStorage.getItem('luban_current_site_id')));
  console.log('localStorage luban_token (first20):', (await page.evaluate(() => localStorage.getItem('luban_token')))?.slice(0, 20));

  // cleanup
  await ctx.delete(`${BFF_BASE}/api/sites/${sid}`, { headers: { Authorization: `Bearer ${token}` } });
});
