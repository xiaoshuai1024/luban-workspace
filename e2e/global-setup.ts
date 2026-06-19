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
const GO_API = process.env.LUBAN_E2E_GO_API ?? 'http://127.0.0.1:8081';
const ENGINE_BASE = process.env.LUBAN_E2E_ENGINE_URL ?? 'http://127.0.0.1:5173';
const WEBSITE_BASE = process.env.LUBAN_E2E_WEBSITE_URL ?? 'http://127.0.0.1:3000';

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

/** 可选探活：缺失仅警告（如 Go 后端，单后端模式下不必需） */
async function probeOptional(url: string, label: string) {
  try {
    await probe(url, label);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`[e2e] (可选) ${label} 未起：${(e as Error).message.split('\n')[0]} —— 双后端契约测试将跳过`);
  }
}

export default async function globalSetup() {
  // Java/engine/website 必需；Go 可选（双后端契约测试才需）
  await Promise.all([
    probe(`${JAVA_API}/actuator/health`, 'Java backend'),
    probeOptional(GO_API, 'Go backend'),
    probe(ENGINE_BASE, 'engine'),
    probe(WEBSITE_BASE, 'website'),
  ]);
}
