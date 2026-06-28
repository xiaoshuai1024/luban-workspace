/**
 * HTTP server — 提供看板 UI + REST API + SSE 实时推送。
 *
 * 用 Node 原生 http（零额外依赖，对齐 e2e/ 包风格）。
 * 端口默认 7777，env SPRINT_MCP_PORT 可覆盖。
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { BroadcastHub } from './watcher.js';
import { listSprints, getSprint, getCurrentSprint } from '../store/sprint-store.js';
import { buildSprintBoard, buildBacklogBoard } from '../util/board.js';
import { computeMetrics, computeBurndown } from '../util/burndown.js';
import { listReleases, getRelease } from '../store/release-store.js';
import { moveStory } from '../store/story-store.js';
import type { StoryStatus } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 编译后在 dist/http/，dev 在 src/http/；public/ 都在包根（上两级）
const PUBLIC_DIR = join(__dirname, '..', '..', 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export interface HttpServerOptions {
  root: string;
  port?: number;
  host?: string;
}

export async function startHttpServer(options: HttpServerOptions): Promise<{ url: string; close: () => void }> {
  const port = options.port ?? Number(process.env.SPRINT_MCP_PORT ?? 7777);
  const host = options.host ?? '127.0.0.1';
  const root = options.root;
  const hub = new BroadcastHub();
  hub.startWatching(root);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${host}`);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    // CORS（本地开发）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // ── SSE 端点 ──
      if (path === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        const clientId = hub.addClient(res);
        res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);
        req.on('close', () => hub.removeClient(clientId));
        return;
      }

      // ── 健康检查 ──
      if (path === '/healthz') {
        return json(res, 200, { ok: true, service: 'luban-sprint-mcp', clients: hub.clientCount });
      }

      // ── REST API ──
      if (path === '/api/sprints' && method === 'GET') {
        return json(res, 200, { sprints: await listSprints(root) });
      }

      const sprintMatch = /^\/api\/sprints\/([^/]+)$/.exec(path);
      if (sprintMatch && method === 'GET') {
        const s = await getSprint(root, sprintMatch[1]);
        if (!s) return json(res, 404, { error: 'sprint 不存在' });
        return json(res, 200, { sprint: s });
      }

      const boardMatch = /^\/api\/sprints\/([^/]+)\/board$/.exec(path);
      if (boardMatch && method === 'GET') {
        const s = await getSprint(root, boardMatch[1]);
        if (!s) return json(res, 404, { error: 'sprint 不存在' });
        return json(res, 200, { board: buildSprintBoard(s) });
      }

      const burndownMatch = /^\/api\/sprints\/([^/]+)\/burndown$/.exec(path);
      if (burndownMatch && method === 'GET') {
        const s = await getSprint(root, burndownMatch[1]);
        if (!s) return json(res, 404, { error: 'sprint 不存在' });
        return json(res, 200, { burndown: computeBurndown(s) });
      }

      const metricsMatch = /^\/api\/sprints\/([^/]+)\/metrics$/.exec(path);
      if (metricsMatch && method === 'GET') {
        const s = await getSprint(root, metricsMatch[1]);
        if (!s) return json(res, 404, { error: 'sprint 不存在' });
        return json(res, 200, { metrics: computeMetrics(s) });
      }

      if (path === '/api/backlog' && method === 'GET') {
        const all = await Promise.all((await listSprints(root)).map((x) => getSprint(root, x.sprintId)));
        const backlog = buildBacklogBoard(all.filter(Boolean) as NonNullable<typeof all[number]>[]);
        return json(res, 200, { backlog, count: backlog.length });
      }

      if (path === '/api/current' && method === 'GET') {
        return json(res, 200, { current: await getCurrentSprint(root) });
      }

      if (path === '/api/releases' && method === 'GET') {
        return json(res, 200, { releases: await listReleases(root) });
      }

      // 拖拽改状态
      const moveMatch = /^\/api\/stories\/([^/]+)\/move$/.exec(path);
      if (moveMatch && method === 'PUT') {
        const body = await readBody(req);
        const { sprintId, to } = JSON.parse(body) as { sprintId: string; to: StoryStatus };
        await moveStory(root, sprintId, moveMatch[1], to);
        hub.broadcast('story.moved', { sprintId, storyId: moveMatch[1], to });
        return json(res, 200, { ok: true });
      }

      // ── 静态文件（看板 UI）──
      if (method === 'GET' && !path.startsWith('/api/')) {
        return serveStatic(req, res, path);
      }

      return json(res, 404, { error: `未找到: ${method} ${path}` });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const url = `http://${host}:${port}`;
  return {
    url,
    close: () => {
      hub.stopWatching();
      server.close();
    },
  };
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function serveStatic(_req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  let rel = path === '/' ? '/kanban.html' : path;
  // 防路径穿越
  rel = rel.replace(/\.\./g, '');
  const filePath = join(PUBLIC_DIR, rel);
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(content);
  } catch {
    json(res, 404, { error: `静态文件未找到: ${rel}` });
  }
}
