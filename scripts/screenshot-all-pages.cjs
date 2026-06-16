// 截图脚本 v2：每个页面访问后确认内容正确再截图。
const path = require('path');
const playwrightPath = '/Users/john/codes/kangdou-fullstack/operation-backend/node_modules/playwright';
const { chromium } = require(playwrightPath);
const fs = require('fs');

const BASE = 'http://localhost:5173';
const BFF = 'http://localhost:3000';
const OUT = '/Users/john/codes/luban-workspace/screenshots';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const SITE_ID = '33111bfc-778d-4efc-a1fa-5c49f0437307';
const PAGE_ID = '5ec7a341-a430-4617-a90f-c0efc766baf7';
const LEAD_ID = 'ba81271a-8803-430c-ab23-26e2876f729c';
const FORM_ID = 'a4e84ac1-69ea-4a3a-a4b8-fd18c2ba7a9d';

const EXECUTABLE = path.join(
  process.env.HOME,
  'Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
);

(async () => {
  // 1. 登录获取 JWT
  const loginResp = await fetch(`${BFF}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const { token } = await loginResp.json();
  if (!token) { console.error('登录失败'); process.exit(1); }
  console.log('JWT token 获取成功');

  const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });

  // 拦截 console error 用于诊断
  context.on('pageerror', (err) => console.error('  [pageerror]', err.message.slice(0, 100)));

  // 先访问一次，在 context 级别注入 localStorage（addInitScript 在 context 上只注册一次）
  await context.addInitScript((t, s) => {
    try {
      localStorage.setItem('luban_token', t);
      localStorage.setItem('luban_current_site_id', s);
    } catch(e) {}
  }, token, SITE_ID);

  const page = await context.newPage();

  // 辅助：访问页面，等待内容确认，再截图
  async function shot(opts) {
    const { name, url, expectSelector, expectText, action, waitMs = 1500, needToken = true } = opts;
    try {
      // 对于需要清 token 的 login 页，单独处理
      if (!needToken) {
        // 新开一个干净的 page（不注入 token）
        const loginPage = await context.newPage();
        await loginPage.addInitScript(() => {
          try { localStorage.removeItem('luban_token'); } catch(e) {}
        });
        await loginPage.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await loginPage.waitForTimeout(waitMs);
        await loginPage.screenshot({ path: `${OUT}/${name}.png` });
        await loginPage.close();
        console.log(`✓ ${name}`);
        return;
      }

      await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

      // 确认 token 在 localStorage（防止被路由守卫踢回 login）
      await page.evaluate(() => {
        const t = localStorage.getItem('luban_token');
        if (!t) {
          // re-inject if lost
        }
      });

      // 等待 Vue 渲染
      await page.waitForTimeout(waitMs);

      // 确认期望内容存在
      if (expectSelector) {
        try {
          await page.waitForSelector(expectSelector, { timeout: 5000 });
        } catch {
          console.warn(`  [warn] ${name}: 未找到选择器 ${expectSelector}`);
        }
      }
      if (expectText) {
        const bodyText = await page.textContent('body').catch(() => '');
        if (!bodyText.includes(expectText)) {
          console.warn(`  [warn] ${name}: 页面未包含文本 "${expectText}"，实际内容前100字: ${bodyText.slice(0, 100)}`);
        }
      }

      // 执行自定义操作（如点击按钮、输入搜索）
      if (action) {
        await action(page);
        await page.waitForTimeout(800);
      }

      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log(`✓ ${name}`);
    } catch (e) {
      console.error(`✗ ${name}: ${e.message.slice(0, 120)}`);
      try { await page.screenshot({ path: `${OUT}/${name}.png` }); } catch {}
    }
  }

  // 逐页截图
  await shot({ name: '01-login', url: '/login', needToken: false, expectText: '登录', waitMs: 1500 });

  await shot({ name: '02-dashboard', url: '/dashboard', expectText: '工作台', waitMs: 2000 });

  await shot({ name: '03-site-list', url: '/sites', expectText: '站点', waitMs: 2000 });

  await shot({ name: '04-site-detail', url: `/sites/${SITE_ID}`, waitMs: 2000 });

  await shot({ name: '05-page-list', url: `/sites/${SITE_ID}/pages`, expectText: '页面', waitMs: 2000 });

  await shot({ name: '06-page-editor', url: `/sites/${SITE_ID}/pages/${PAGE_ID}`, waitMs: 3000 });

  await shot({ name: '07-page-new', url: `/sites/${SITE_ID}/pages/new`, waitMs: 3000 });

  await shot({ name: '08-lead-list', url: `/sites/${SITE_ID}/leads`, expectText: '线索', waitMs: 2000 });

  await shot({ name: '09-lead-detail', url: `/sites/${SITE_ID}/leads/${LEAD_ID}`, waitMs: 2000 });

  await shot({ name: '10-form-list', url: `/sites/${SITE_ID}/forms`, expectText: '表单', waitMs: 2000 });

  await shot({ name: '11-form-editor', url: `/sites/${SITE_ID}/forms/${FORM_ID}`, waitMs: 2000 });

  await shot({ name: '12-user-list', url: '/users', waitMs: 2000 });

  await shot({ name: '13-settings', url: '/settings', waitMs: 2000 });

  // 14. 线索详情-点击状态转移
  await shot({
    name: '14-lead-transit',
    url: `/sites/${SITE_ID}/leads/${LEAD_ID}`,
    waitMs: 2000,
    action: async (p) => {
      // 找到状态转移按钮（联系中/已转化/流失等）
      const btns = p.locator('.el-button:has-text("联系中"), .el-button:has-text("已转化"), .el-button:has-text("流失")');
      const count = await btns.count();
      if (count > 0) {
        await btns.first().click({ force: true }).catch(() => {});
        await p.waitForTimeout(500);
        // 确认弹窗
        const confirm = p.locator('.el-message-box__btns .el-button--primary');
        if (await confirm.count() > 0) await confirm.click({ force: true }).catch(() => {});
        await p.waitForTimeout(1000);
      } else {
        console.warn('  [warn] 未找到状态转移按钮');
      }
    },
  });

  // 15. 线索列表-搜索
  await shot({
    name: '15-lead-search',
    url: `/sites/${SITE_ID}/leads`,
    waitMs: 2000,
    action: async (p) => {
      const search = p.locator('input').filter({ hasText: '' });
      const allInputs = p.locator('input[placeholder*="搜索"], input[placeholder*="线索"], input[placeholder*="关键字"]');
      if (await allInputs.count() > 0) {
        await allInputs.first().fill('张三');
        await p.waitForTimeout(1000);
      } else {
        // fallback: 找 el-input 搜索框
        const elInput = p.locator('.el-input input').first();
        if (await elInput.count() > 0) {
          await elInput.fill('张三');
          await p.waitForTimeout(1000);
        }
      }
    },
  });

  await browser.close();
  console.log('\n=== 截图完成 ===');
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png'));
  console.log(`共 ${files.length} 张`);
})();
