/**
 * Git branch 检测 — 仿 gablabelle/mcp-kanban 的 session 自动绑定。
 *
 * 从当前 git branch 推导对应 sprint（约定：branch 名含 sprintId 则匹配）。
 * 也支持显式 sprint.branch 字段绑定。
 */

import { execFileSync } from 'node:child_process';
import type { Sprint } from '../types.js';

/** 获取当前 git branch（失败返回 null） */
export function detectGitBranch(cwd: string = process.cwd()): string | null {
  try {
    const out = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out === 'HEAD' ? null : out;
  } catch {
    return null;
  }
}

/** 从 branch 名提取候选 sprintId */
export function extractSprintIdFromBranch(branch: string): string | null {
  // 约定：S-<year>-<month>-W<n> 形式
  const m = /(S-\d{4}-\d{2}-W\d+)/.exec(branch);
  return m ? m[1] : null;
}

/** 在 sprint 列表中找匹配当前 branch 的（先 sprintId 包含，再 sprint.branch 等于） */
export function matchSprintByBranch(branch: string | null, sprints: Sprint[]): Sprint | null {
  if (!branch) return null;
  const candidate = extractSprintIdFromBranch(branch);
  if (candidate) {
    const byId = sprints.find((s) => s.sprintId === candidate);
    if (byId) return byId;
  }
  return sprints.find((s) => s.branch === branch) ?? null;
}
