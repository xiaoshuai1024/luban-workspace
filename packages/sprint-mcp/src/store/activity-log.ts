/**
 * 活动日志工具 — 仿 cardo 的审计模式。
 * 每次写操作产生一条 ActivityEntry，插入 sprint.activityLog 头部（最新的在前）。
 */

import type { ActivityEntry, Sprint } from '../types.js';

const NOW = () => new Date().toISOString();

/** 在 sprint 内存对象上记录一条活动（不写盘；由调用方 mutate 后统一写） */
export function recordActivity(
  sprint: Sprint,
  entry: Omit<ActivityEntry, 'at'> & { at?: string },
): void {
  sprint.activityLog.unshift({
    at: entry.at ?? NOW(),
    actor: entry.actor,
    action: entry.action,
    storyId: entry.storyId,
    from: entry.from,
    to: entry.to,
    detail: entry.detail,
  });
  // 限制活动日志上限（避免无限膨胀）
  if (sprint.activityLog.length > 500) {
    sprint.activityLog.length = 500;
  }
}

/** 批量记录 */
export function recordActivities(sprint: Sprint, entries: ActivityEntry[]): void {
  sprint.activityLog.unshift(...entries);
  if (sprint.activityLog.length > 500) {
    sprint.activityLog.length = 500;
  }
}

/** 查询活动日志（可选过滤） */
export function queryActivity(
  sprint: Sprint,
  filter?: { storyId?: string; action?: string; actor?: string; limit?: number },
): ActivityEntry[] {
  let log = sprint.activityLog;
  if (filter?.storyId) log = log.filter((e) => e.storyId === filter.storyId);
  if (filter?.action) log = log.filter((e) => e.action === filter.action);
  if (filter?.actor) log = log.filter((e) => e.actor === filter.actor);
  if (filter?.limit && filter.limit > 0) log = log.slice(0, filter.limit);
  return log;
}
