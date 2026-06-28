/**
 * Tool 实现：Story 管理（4-8）。
 */

import type { StoryContext } from '../../types.js';
import {
  createStory,
  updateStory,
  moveStory,
  deleteStory,
  listStories,
  addToSprint,
  removeFromSprint,
  prioritizeBacklog,
  storyDependencies,
  isStoryReady,
  addDependency,
  removeDependency,
} from '../../store/story-store.js';
import { addComment, storyComments } from '../../store/story-store.js';
import { getSprint, findStory, findEpic } from '../../store/sprint-store.js';
import { queryActivity } from '../../store/activity-log.js';
import { buildBacklogBoard } from '../../util/board.js';
import { listSprints } from '../../store/sprint-store.js';
import type { ToolContext } from './sprint.js';

// ── Tool 4: story_manager ───────────────────────────────────
export async function storyManager(ctx: ToolContext, args: {
  action: 'create' | 'update' | 'get' | 'move' | 'delete' | 'list';
  sprintId: string;
  storyId?: string;
  title?: string; description?: string;
  type?: 'story' | 'task' | 'bug' | 'chore';
  storyPoints?: number;
  status?: 'backlog' | 'todo' | 'in_progress' | 'review' | 'testing' | 'done' | 'deferred';
  assignee?: string;
  epicId?: string | null;
  tags?: string[];
  filterStatus?: string;
}): Promise<unknown> {
  const { root, sprintId } = { ...ctx, sprintId: args.sprintId };
  switch (args.action) {
    case 'create': {
      if (!args.title || args.storyPoints === undefined) throw new Error('create 需要 title 和 storyPoints');
      const s = await createStory(root, sprintId, {
        title: args.title, description: args.description, type: args.type,
        storyPoints: args.storyPoints as never, status: args.status,
        assignee: args.assignee, epicId: args.epicId, tags: args.tags,
      });
      return { ok: true, story: s };
    }
    case 'update': {
      const s = await updateStory(root, sprintId, args.storyId!, {
        title: args.title, description: args.description, type: args.type,
        storyPoints: args.storyPoints as never, assignee: args.assignee,
        epicId: args.epicId ?? undefined, tags: args.tags,
      });
      return { ok: true, story: s };
    }
    case 'get': {
      const sprint = await getSprint(root, sprintId);
      const story = findStory(sprint!, args.storyId!);
      if (!story) throw new Error(`Story 不存在: ${args.storyId}`);
      return { story };
    }
    case 'move': {
      const s = await moveStory(root, sprintId, args.storyId!, args.status!);
      return { ok: true, story: s };
    }
    case 'delete': {
      await deleteStory(root, sprintId, args.storyId!);
      return { ok: true };
    }
    case 'list': {
      const list = await listStories(root, sprintId, args.filterStatus ? { status: args.filterStatus as never } : undefined);
      return { stories: list };
    }
  }
}

// ── Tool 5: story_backlog ───────────────────────────────────
export async function storyBacklog(ctx: ToolContext, args: {
  action: 'add_to_sprint' | 'remove_from_sprint' | 'list_backlog' | 'prioritize';
  sprintId: string;
  storyId?: string;
  orderedStoryIds?: string[];
}): Promise<unknown> {
  const { root, sprintId } = { ...ctx, sprintId: args.sprintId };
  switch (args.action) {
    case 'add_to_sprint': {
      const s = await addToSprint(root, sprintId, args.storyId!);
      return { ok: true, story: s };
    }
    case 'remove_from_sprint': {
      const s = await removeFromSprint(root, sprintId, args.storyId!);
      return { ok: true, story: s };
    }
    case 'list_backlog': {
      const all = await Promise.all((await listSprints(root)).map((x) => getSprint(root, x.sprintId)));
      const backlog = buildBacklogBoard(all.filter(Boolean) as never);
      return { backlog, count: backlog.length };
    }
    case 'prioritize': {
      await prioritizeBacklog(root, sprintId, args.orderedStoryIds!);
      return { ok: true };
    }
  }
}

// ── Tool 6: story_context（聚合读，仿 cardo get_task_context）──
export async function storyContext(ctx: ToolContext, args: {
  action: 'get';
  sprintId: string;
  storyId: string;
}): Promise<{ context: StoryContext }> {
  const sprint = await getSprint(ctx.root, args.sprintId);
  if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
  const story = findStory(sprint, args.storyId);
  if (!story) throw new Error(`Story 不存在: ${args.storyId}`);
  const epic = story.epicId ? findEpic(sprint, story.epicId) : undefined;
  const { blockedBy, blocking } = storyDependencies(sprint, args.storyId);
  const children = sprint.stories.filter((s) => s.epicId === story.storyId);
  const activity = queryActivity(sprint, { storyId: args.storyId, limit: 20 });
  const comments = storyComments(sprint, args.storyId);
  return {
    context: {
      story,
      epic,
      taskRefs: story.taskRefs,
      comments,
      blockedBy,
      blocking,
      readyToStart: isStoryReady(sprint, story),
      children,
      activity,
    },
  };
}

// ── Tool 7: story_dependency ────────────────────────────────
export async function storyDependency(ctx: ToolContext, args: {
  action: 'add' | 'remove' | 'list' | 'graph';
  sprintId: string;
  fromStoryId?: string;
  toStoryId?: string;
  type?: 'blocks' | 'branches' | 'merges' | 'sync';
  storyId?: string;
}): Promise<unknown> {
  const sprint = await getSprint(ctx.root, args.sprintId);
  if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
  switch (args.action) {
    case 'add': {
      const dep = await addDependency(ctx.root, args.sprintId, args.fromStoryId!, args.toStoryId!, args.type);
      return { ok: true, dependency: dep };
    }
    case 'remove': {
      await removeDependency(ctx.root, args.sprintId, args.fromStoryId!, args.toStoryId!);
      return { ok: true };
    }
    case 'list': {
      const sid = args.storyId!;
      const { blockedBy, blocking } = storyDependencies(sprint, sid);
      return { storyId: sid, blockedBy, blocking, readyToStart: isStoryReady(sprint, findStory(sprint, sid)!) };
    }
    case 'graph': {
      // 返回邻接表 + 拓扑分层
      const { topologicalLayers } = await import('../../util/cycle-detect.js');
      const edges = sprint.dependencies.map((d) => ({ from: d.fromStoryId, to: d.toStoryId }));
      const layers = topologicalLayers(edges);
      return { edges, layers, cycleCheck: 'ok' };
    }
  }
}

// ── Tool 8: story_comment ───────────────────────────────────
export async function storyComment(ctx: ToolContext, args: {
  action: 'add' | 'list';
  sprintId: string;
  storyId: string;
  content?: string;
  author?: string;
}): Promise<unknown> {
  switch (args.action) {
    case 'add': {
      const c = await addComment(ctx.root, args.sprintId, args.storyId, args.content!, args.author);
      return { ok: true, comment: c };
    }
    case 'list': {
      const sprint = await getSprint(ctx.root, args.sprintId);
      if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
      return { comments: storyComments(sprint, args.storyId) };
    }
  }
}
