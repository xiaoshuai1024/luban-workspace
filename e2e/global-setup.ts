import { request } from '@playwright/test';

/**
 * 全局健康检查（globalSetup）
 *
 * 在跑任何流程前验证各依赖服务在线。任一不可达即抛错（红），
 * 绝不静默跳过——对齐 luban-e2e-execution-contract §2.5.1（禁止假绿）。
 *
 * auth.setup（真实登录拿 storageState）在下方 auth 项目独立完成；
 * 本 setup 只做 liveness probe。
 */

const JAVA_API = process.env.LUBAN_E2E_JAVA_API ?? 'http://127.0.0.1:8080';
const ENGINE_BASE = process.env.LUBAN_E2E_ENGINE_URL ?? 'http://127.0.0.1:5173';
const WEBSITE_BASE = process.env.LUBAN_E2E_WEBSITE_URL ?? 'http://127.0.0.1:3000';
// @paused: Go 后端已移除（commit e9b0abc），探活暂停。

async function probe(url: string, label: string) {
  try {
    const ctx = await request.newContext({ timeout: 5_000 });
    const res = await ctx.get(url);
    await ctx.dispose();
    // 200/302/401/404 都算"服务在线"；5xx/连接失败才算挂
    if (res.status() >= 500) throw new Error(`HTTP ${res.status()}`);
    // eslint-disable-next-line no-console
    console.log(`[e2e] ${label} OK (${res.status()}) @ ${url}`);
  } catch (e) {
    throw new Error(
      `[e2e] ${label} 不可达 @ ${url}：${(e as Error).message}\n` +
        `请先运行 \`make e2e-up\` 启动服务编排。禁止以"服务没起"为由 skip 测试。`
    );
  }
}

/** 可选探活：缺失仅警告（保留供未来可选依赖复用） */
async function probeOptional(url: string, label: string) {
  try {
    await probe(url, label);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`[e2e] (可选) ${label} 未起：${(e as Error).message.split('\n')[0]}`);
  }
}

export default async function globalSetup() {
  // @paused: Go backend 探活已移除（commit e9b0abc）。恢复时加回 probeOptional(GO_API, 'Go backend')。
  // Java/engine/website 必需
  await Promise.all([
    probe(`${JAVA_API}/actuator/health`, 'Java backend'),
    probe(ENGINE_BASE, 'engine'),
    probe(WEBSITE_BASE, 'website'),
  ]);

  // 预热 website SSR：Nuxt dev 按需编译，首次访问动态路由（/:site/:path）会触发
  // DynamicPage 编译，期间可能返回 500。提前访问一次让编译完成，避免后续 spec
  // 首请求命中编译窗口。prod build 无此问题（已预编译）。
  await warmupWebsiteSSR();
}

/** 预热 website 的 DynamicPage 路由编译（仅 dev 模式需要，失败不阻断）。 */
async function warmupWebsiteSSR() {
  try {
    const ctx = await request.newContext({ timeout: 30_000 });
    // 访问任意 slug/path 触发 DynamicPage 编译（404 也算编译完成）
    await ctx.get(`${WEBSITE_BASE}/__e2e_warmup__/warmup`, { timeout: 30_000 });
    await ctx.dispose();
    // eslint-disable-next-line no-console
    console.log('[e2e] website SSR 预热完成（DynamicPage 已编译）');
  } catch {
    // 预热失败不阻断（prod 模式无需预热）；后续 spec 自行处理
  }
}
