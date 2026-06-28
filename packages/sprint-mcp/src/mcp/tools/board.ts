/**
 * Tool 实现：看板视图（13-15）。
 */

import { getSprint, listSprints } from '../../store/sprint-store.js';
import { buildSprintBoard, buildBacklogBoard, filterStories, storiesToCsv, storiesToMarkdown } from '../../util/board.js';
import { listReleases, getRelease } from '../../store/release-store.js';
import type { ToolContext } from './sprint.js';

// ── Tool 13: board_view ─────────────────────────────────────
export async function boardView(ctx: ToolContext, args: {
  action: 'sprint' | 'backlog' | 'release';
  sprintId?: string;
  releaseId?: string;
}): Promise<unknown> {
  const { root } = ctx;
  switch (args.action) {
    case 'sprint': {
      if (!args.sprintId) throw new Error('sprint 视图需要 sprintId');
      const sprint = await getSprint(root, args.sprintId);
      if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
      return { board: buildSprintBoard(sprint) };
    }
    case 'backlog': {
      const all = await Promise.all((await listSprints(root)).map((x) => getSprint(root, x.sprintId)));
      const backlog = buildBacklogBoard(all.filter(Boolean) as NonNullable<typeof all[number]>[]);
      return { backlog, count: backlog.length };
    }
    case 'release': {
      if (!args.releaseId) throw new Error('release 视图需要 releaseId');
      const release = await getRelease(root, args.releaseId);
      if (!release) throw new Error(`Release 不存在: ${args.releaseId}`);
      const sprintSummaries = await Promise.all(
        release.sprintIds.map(async (sid) => {
          const sprint = await getSprint(root, sid);
          if (!sprint) return { sprintId: sid, error: 'sprint 不存在' };
          const board = buildSprintBoard(sprint);
          return { sprintId: sid, name: sprint.name, status: sprint.status, totalStories: board.totalStories, doneStories: board.doneStories, donePoints: board.donePoints };
        }),
      );
      return { release, sprints: sprintSummaries };
    }
  }
}

// ── Tool 14: board_filter ───────────────────────────────────
export async function boardFilter(ctx: ToolContext, args: {
  action: 'by_assignee' | 'by_epic' | 'by_subsystem' | 'by_status';
  sprintId?: string;
  value: string;
}): Promise<unknown> {
  // 收集要筛选的 story 池
  let pool: import('../../types.js').Story[] = [];
  if (args.sprintId) {
    const sprint = await getSprint(ctx.root, args.sprintId);
    if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
    pool = sprint.stories;
  } else {
    const all = await Promise.all((await listSprints(ctx.root)).map((x) => getSprint(ctx.root, x.sprintId)));
    pool = all.filter(Boolean).flatMap((s) => s!.stories);
  }

  const filter: Parameters<typeof filterStories>[1] = {};
  switch (args.action) {
    case 'by_assignee': filter.assignee = args.value; break;
    case 'by_epic': filter.epicId = args.value; break;
    case 'by_subsystem': filter.subsystem = args.value; break;
    case 'by_status': filter.status = args.value as never; break;
  }
  const filtered = filterStories(pool, filter);
  return { count: filtered.length, stories: filtered };
}

// ── Tool 15: board_export ───────────────────────────────────
export async function boardExport(ctx: ToolContext, args: {
  action: 'csv' | 'markdown';
  sprintId?: string;
}): Promise<unknown> {
  let stories: import('../../types.js').Story[] = [];
  if (args.sprintId) {
    const sprint = await getSprint(ctx.root, args.sprintId);
    if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
    stories = sprint.stories;
  } else {
    const all = await Promise.all((await listSprints(ctx.root)).map((x) => getSprint(ctx.root, x.sprintId)));
    stories = all.filter(Boolean).flatMap((s) => s!.stories);
  }
  const content = args.action === 'csv' ? storiesToCsv(stories) : storiesToMarkdown(stories);
  return { format: args.action, count: stories.length, content };
}
