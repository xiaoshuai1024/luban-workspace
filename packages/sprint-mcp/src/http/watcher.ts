/**
 * 文件监听 + SSE 广播。
 *
 * chokidar 监听 docs/superpowers/sprints/*.json，变更时向所有 SSE 客户端推送 refresh 事件。
 * 拖拽改状态 → store 写文件 → watcher 推送 → 浏览器自动刷新。
 */

import chokidar from 'chokidar';
import { join } from 'node:path';
import { sprintsDir } from '../store/repo.js';

export interface SSEClient {
  id: number;
  res: { write: (data: string) => boolean; end: () => void };
}

export class BroadcastHub {
  private clients = new Map<number, SSEClient>();
  private nextId = 1;
  private watcher: chokidar.FSWatcher | null = null;

  addClient(res: SSEClient['res']): number {
    const id = this.nextId++;
    this.clients.set(id, { id, res });
    return id;
  }

  removeClient(id: number): void {
    this.clients.delete(id);
  }

  /** 广播 SSE 事件给所有客户端 */
  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [, client] of this.clients) {
      try {
        client.res.write(payload);
      } catch {
        this.clients.delete(client.id);
      }
    }
  }

  /** 启动文件监听（幂等）*/
  startWatching(root: string): void {
    if (this.watcher) return;
    const dir = sprintsDir(root);
    this.watcher = chokidar.watch(join(dir, '*.json'), {
      ignoreInitial: true,
      persistent: true,
    });
    this.watcher.on('all', (event, path) => {
      this.broadcast('change', { event, path, at: new Date().toISOString() });
    });
  }

  stopWatching(): void {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
