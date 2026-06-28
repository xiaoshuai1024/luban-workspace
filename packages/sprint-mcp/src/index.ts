#!/usr/bin/env node
/**
 * Sprint MCP 入口 — 同时启动 MCP stdio + HTTP 看板。
 *
 * 用法：
 *   node dist/index.js               # stdio MCP + HTTP :7777 看板
 *   SPRINT_MCP_PORT=8888 node dist/index.js
 *   SPRINT_MCP_NO_HTTP=1 node dist/index.js   # 仅 MCP（CI/headless）
 *
 * 日志走 stderr（不污染 stdio JSON-RPC）。
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './mcp/server.js';
import { startHttpServer } from './http/server.js';

const log = (...args: unknown[]) => process.stderr.write(`[sprint-mcp] ${args.join(' ')}\n`);

async function main(): Promise<void> {
  const root = process.env.SPRINT_MCP_ROOT ?? process.cwd();
  log(`仓库根: ${root}`);

  // 1. 启动 HTTP 看板（除非显式禁用）
  if (!process.env.SPRINT_MCP_NO_HTTP) {
    try {
      const http = await startHttpServer({ root });
      log(`看板: ${http.url}`);
      process.on('SIGINT', () => { http.close(); process.exit(0); });
      process.on('SIGTERM', () => { http.close(); process.exit(0); });
    } catch (e) {
      log(`HTTP 看板启动失败（继续仅 MCP 模式）: ${(e as Error).message}`);
    }
  }

  // 2. 启动 MCP stdio
  const server = createServer({ root });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP stdio 已就绪（22 个 tool）');
}

main().catch((e) => {
  log('致命错误:', (e as Error).message);
  process.exit(1);
});
