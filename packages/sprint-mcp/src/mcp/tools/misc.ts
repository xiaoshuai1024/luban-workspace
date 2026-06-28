/**
 * Tool 实现：复盘 / 活动日志 / git branch（20-22）。
 */

import { getSprint, mutateSprint } from '../../store/sprint-store.js';
import { queryActivity } from '../../store/activity-log.js';
import { listSprints } from '../../store/sprint-store.js';
import { detectGitBranch, matchSprintByBranch } from '../../util/branch-detect.js';
import { updateSprint } from '../../store/sprint-store.js';
import type { RetroItemKind } from '../../types.js';
import type { ToolContext } from './sprint.js';

const NOW = () => new Date().toISOString();
let retroCounter = 0;

// ── Tool 20: sprint_retrospective ───────────────────────────
export async function sprintRetrospective(ctx: ToolContext, args: {
  action: 'start' | 'add_item' | 'close' | 'list';
  sprintId: string;
  kind?: RetroItemKind;
  content?: string;
}): Promise<unknown> {
  const { root } = ctx;
  switch (args.action) {
    case 'start': {
      // 标记 sprint 进入复盘阶段：在 activityLog 记录
      await mutateSprint(root, args.sprintId, () => {});
      return { ok: true, message: '复盘已开始，使用 add_item 添加 keep/start/stop 项' };
    }
    case 'add_item': {
      if (!args.kind || !args.content) throw new Error('add_item 需要 kind 和 content');
      retroCounter += 1;
      const id = `R-${Date.now().toString(36)}-${retroCounter}`;
      const item = { id, kind: args.kind, content: args.content, at: NOW(), author: 'agent' };
      await mutateSprint(root, args.sprintId, (s) => {
        s.retrospective.push(item);
        return [{ at: NOW(), actor: 'agent', action: 'retro.item_added', detail: `${args.kind}: ${args.content}` }];
      });
      return { ok: true, item };
    }
    case 'close': {
      await mutateSprint(root, args.sprintId, (s) => {
        return [{ at: NOW(), actor: 'agent', action: 'retro.closed', detail: `${s.retrospective.length} items` }];
      });
      return { ok: true, message: '复盘已关闭' };
    }
    case 'list': {
      const sprint = await getSprint(root, args.sprintId);
      if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
      return { retrospective: sprint.retrospective };
    }
  }
}

// ── Tool 21: activity_log ───────────────────────────────────
export async function activityLog(ctx: ToolContext, args: {
  action: 'list' | 'filter';
  sprintId: string;
  storyId?: string;
  actor?: string;
  limit?: number;
}): Promise<unknown> {
  const sprint = await getSprint(ctx.root, args.sprintId);
  if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
  const log = queryActivity(sprint, {
    storyId: args.storyId,
    actor: args.actor,
    limit: args.limit,
  });
  return { count: log.length, activity: log };
}

// ── Tool 22: git_branch_sync ────────────────────────────────
export async function gitBranchSync(ctx: ToolContext, args: {
  action: 'detect' | 'set_default';
  sprintId?: string;
  branch?: string;
}): Promise<unknown> {
  const { root } = ctx;
  switch (args.action) {
    case 'detect': {
      const branch = args.branch ?? detectGitBranch(root);
      if (!branch) return { detected: false, message: '无法检测当前 git branch' };
      const all = await Promise.all((await listSprints(root)).map((x) => getSprint(root, x.sprintId)));
      const sprints = all.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getSprint>>>[];
      const matched = matchSprintByBranch(branch, sprints);
      return { detected: true, branch, matchedSprint: matched?.sprintId ?? null };
    }
    case 'set_default': {
      if (!args.sprintId) throw new Error('set_default 需要 sprintId');
      const branch = args.branch ?? detectGitBranch(root);
      if (!branch) throw new Error('无法检测当前 git branch，请显式传 branch');
      await updateSprint(root, args.sprintId, { branch });
      return { ok: true, sprintId: args.sprintId, branch };
    }
  }
}
