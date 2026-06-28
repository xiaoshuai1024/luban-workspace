/**
 * Tool 实现：sprint 生命周期（1-3）。
 */

import type { Sprint, BurndownData } from '../../types.js';
import {
  createSprint,
  getSprint,
  listSprints,
  getCurrentSprint,
  transitionSprint,
  updateSprint,
  deleteSprint,
} from '../../store/sprint-store.js';
import { clearSprintRefs } from '../../store/taskgraph-bridge.js';
import { computeMetrics, computeBurndown, computeVelocity, computeReadiness } from '../../util/burndown.js';
import { buildSprintBoard } from '../../util/board.js';

export interface ToolContext {
  root: string;
}

// ── Tool 1: sprint_manager ──────────────────────────────────
export async function sprintManager(ctx: ToolContext, args: {
  action: 'create' | 'start' | 'close' | 'cancel' | 'get' | 'list' | 'get_current' | 'update';
  sprintId?: string;
  name?: string; goal?: string; startDate?: string; endDate?: string;
  teamCapacity?: number; branch?: string;
}): Promise<unknown> {
  const { root } = ctx;
  switch (args.action) {
    case 'create': {
      if (!args.sprintId || !args.name) throw new Error('create 需要 sprintId 和 name');
      const s = await createSprint(root, args.sprintId, {
        name: args.name, goal: args.goal, startDate: args.startDate,
        endDate: args.endDate, teamCapacity: args.teamCapacity,
      });
      return { ok: true, sprintId: s.sprintId, sprint: s };
    }
    case 'start': {
      const s = await transitionSprint(root, args.sprintId!, 'active');
      return { ok: true, sprint: s };
    }
    case 'close': {
      const s = await transitionSprint(root, args.sprintId!, 'completed');
      return { ok: true, sprint: s };
    }
    case 'cancel': {
      const s = await transitionSprint(root, args.sprintId!, 'cancelled');
      // 清理 task graph 反向指针
      const cleared = await clearSprintRefs(root, args.sprintId!);
      return { ok: true, sprint: s, clearedTaskRefs: cleared };
    }
    case 'get': {
      const s = await getSprint(root, args.sprintId!);
      if (!s) throw new Error(`Sprint 不存在: ${args.sprintId}`);
      return { sprint: s };
    }
    case 'list': {
      const list = await listSprints(root);
      return { sprints: list };
    }
    case 'get_current': {
      const cur = await getCurrentSprint(root);
      return { current: cur };
    }
    case 'update': {
      const s = await updateSprint(root, args.sprintId!, {
        name: args.name, goal: args.goal, startDate: args.startDate,
        endDate: args.endDate, teamCapacity: args.teamCapacity, branch: args.branch,
      });
      return { ok: true, sprint: s };
    }
  }
}

// ── Tool 2: sprint_metrics ──────────────────────────────────
export async function sprintMetrics(ctx: ToolContext, args: {
  action: 'burndown' | 'velocity' | 'readiness' | 'summary';
  sprintId: string;
}): Promise<unknown> {
  const sprint = await getSprint(ctx.root, args.sprintId);
  if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
  switch (args.action) {
    case 'burndown':
      return { burndown: computeBurndown(sprint) };
    case 'velocity':
      return { velocity: computeVelocity(sprint) };
    case 'readiness':
      return { readiness: computeReadiness(sprint) };
    case 'summary': {
      const metrics = computeMetrics(sprint);
      const board = buildSprintBoard(sprint);
      return { metrics, boardSummary: { totalStories: board.totalStories, doneStories: board.doneStories, totalPoints: board.totalPoints, donePoints: board.donePoints } };
    }
  }
}

// ── Tool 3: sprint_carryover ────────────────────────────────
export async function sprintCarryover(ctx: ToolContext, args: {
  action: 'execute';
  sprintId: string;
  targetSprintId?: string;
}): Promise<unknown> {
  const { root } = ctx;
  const sprint = await getSprint(root, args.sprintId);
  if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
  if (sprint.status !== 'active' && sprint.status !== 'completed') {
    throw new Error(`carryover 仅适用于 active/completed sprint，当前: ${sprint.status}`);
  }
  if (args.targetSprintId) {
    const target = await getSprint(root, args.targetSprintId);
    if (!target) throw new Error(`目标 sprint 不存在: ${args.targetSprintId}`);
  }

  const unfinished = sprint.stories.filter((s) => s.status !== 'done' && s.status !== 'deferred');
  const result: Array<{ storyId: string; from: string; to: string }> = [];

  // 直接在 sprint JSON 上操作（move 到 backlog 或迁移到目标 sprint）
  const { mutateSprint } = await import('../../store/sprint-store.js');
  const { recordActivity } = await import('../../store/activity-log.js');

  if (args.targetSprintId) {
    // 迁移到目标 sprint
    for (const story of unfinished) {
      await mutateSprint(root, args.sprintId!, (s) => {
        const idx = s.stories.findIndex((x) => x.storyId === story.storyId);
        if (idx !== -1) s.stories.splice(idx, 1);
      });
      await mutateSprint(root, args.targetSprintId!, (t) => {
        story.sprintId = args.targetSprintId!;
        story.status = 'todo';
        story.order = t.stories.reduce((max, x) => Math.max(max, x.order), 0) + 1;
        story.metadata.updatedAt = new Date().toISOString();
        t.stories.push(story);
        recordActivity(t, { actor: 'agent', action: 'story.carryover_in', storyId: story.storyId, detail: `from ${args.sprintId}` });
      });
      result.push({ storyId: story.storyId, from: args.sprintId!, to: args.targetSprintId! });
    }
  } else {
    // 转入 backlog（同 sprint 内 status→backlog）
    await mutateSprint(root, args.sprintId!, (s) => {
      for (const story of s.stories) {
        if (story.status !== 'done' && story.status !== 'deferred') {
          const prev = story.status;
          story.status = 'backlog';
          story.metadata.updatedAt = new Date().toISOString();
          recordActivity(s, { actor: 'agent', action: 'story.carryover_backlog', storyId: story.storyId, from: prev, to: 'backlog' });
          result.push({ storyId: story.storyId, from: prev, to: 'backlog' });
        }
      }
    });
  }

  return { ok: true, carriedOver: result.length, stories: result };
}

export type { Sprint, BurndownData };
