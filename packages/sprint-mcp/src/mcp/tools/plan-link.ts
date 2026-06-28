/**
 * Tool 实现：与 SSOT 任务图联动（16-19）。
 *
 * 这是「与 plan-template 联动」的核心：
 *   - link: 把 story 与 task graph 节点双向链接
 *   - sync: 双向状态同步（pull: task→story / push: story→task）
 *   - import: 从 plan-template 生成的 task graph 批量导入为 stories
 *   - export: 把 sprint stories 反向写回 task graph
 */

import { getSprint, findStory, mutateSprint } from '../../store/sprint-store.js';
import { recordActivity } from '../../store/activity-log.js';
import {
  setTaskSprintId,
  setTaskStatus,
  getTaskStatus,
  readTaskGraph,
  writeTaskGraph,
  storyStatusFromTaskStatus,
  taskStatusFromStoryStatus,
} from '../../store/taskgraph-bridge.js';
import { createStory } from '../../store/story-store.js';
import { createEpic } from '../../store/epic-store.js';
import type { Story, StoryStatus } from '../../types.js';
import type { ToolContext } from './sprint.js';

const NOW = () => new Date().toISOString();

// ── Tool 16: plan_link ──────────────────────────────────────
export async function planLink(ctx: ToolContext, args: {
  action: 'link_story_to_task' | 'unlink' | 'list_links' | 'sync_status';
  sprintId: string;
  storyId?: string;
  featureId?: string;
  taskId?: string;
  direction?: 'pull' | 'push';
}): Promise<unknown> {
  const { root } = ctx;
  switch (args.action) {
    case 'link_story_to_task': {
      if (!args.storyId || !args.featureId || !args.taskId) throw new Error('需要 storyId + featureId + taskId');
      // 读 task 元信息做冗余快照
      const doc = await readTaskGraph(root, args.featureId);
      const taskNode = doc?.tasks.find((t) => t.id === args.taskId);
      if (!taskNode) throw new Error(`Task 不存在: ${args.featureId}/${args.taskId}`);
      const ref = {
        featureId: args.featureId,
        taskId: args.taskId,
        subsystem: taskNode.subsystem ?? taskNode.group,
        planFile: doc?.planPath ?? doc?.planFile ?? doc?.plan,
        titleSnapshot: taskNode.title,
      };
      // 写入 story.taskRefs
      await mutateSprint(root, args.sprintId, (s) => {
        const story = findStory(s, args.storyId!);
        if (!story) throw new Error(`Story 不存在: ${args.storyId}`);
        if (!story.taskRefs.some((r) => r.featureId === args.featureId && r.taskId === args.taskId)) {
          story.taskRefs.push(ref);
        }
        recordActivity(s, { actor: 'agent', action: 'link.added', storyId: args.storyId, detail: `${args.featureId}/${args.taskId}` });
      });
      // 反向写 task.sprintId
      await setTaskSprintId(root, args.featureId, args.taskId, args.sprintId);
      return { ok: true, link: ref };
    }
    case 'unlink': {
      if (!args.storyId || !args.featureId || !args.taskId) throw new Error('需要 storyId + featureId + taskId');
      await mutateSprint(root, args.sprintId, (s) => {
        const story = findStory(s, args.storyId!);
        if (!story) throw new Error(`Story 不存在: ${args.storyId}`);
        story.taskRefs = story.taskRefs.filter((r) => !(r.featureId === args.featureId && r.taskId === args.taskId));
        recordActivity(s, { actor: 'agent', action: 'link.removed', storyId: args.storyId, detail: `${args.featureId}/${args.taskId}` });
      });
      await setTaskSprintId(root, args.featureId, args.taskId, null);
      return { ok: true };
    }
    case 'list_links': {
      const sprint = await getSprint(root, args.sprintId);
      if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
      const links = sprint.stories
        .filter((s) => s.taskRefs.length > 0)
        .map((s) => ({ storyId: s.storyId, title: s.title, taskRefs: s.taskRefs }));
      return { count: links.length, links };
    }
    case 'sync_status': {
      if (!args.storyId) throw new Error('sync_status 需要 storyId');
      if (!args.direction) throw new Error('sync_status 需要 direction (pull/push)');
      return syncStoryStatus(root, args.sprintId, args.storyId, args.direction);
    }
  }
}

// 内部：同步单个 story 状态
async function syncStoryStatus(root: string, sprintId: string, storyId: string, direction: 'pull' | 'push'): Promise<unknown> {
  const sprint = await getSprint(root, sprintId);
  const story = findStory(sprint!, storyId);
  if (!story) throw new Error(`Story 不存在: ${storyId}`);

  if (direction === 'pull') {
    // 读 task.status 推导 story 状态
    const statuses = await Promise.all(story.taskRefs.map((r) => getTaskStatus(root, r)));
    const valid = statuses.filter((s): s is string => s !== null);
    let newStoryStatus: StoryStatus = story.status;
    if (valid.length > 0) {
      if (valid.every((s) => s === 'done' || s === 'completed')) {
        newStoryStatus = 'done';
      } else if (valid.some((s) => s === 'in_progress' || s === 'in-progress' || s === 'blocked')) {
        newStoryStatus = 'in_progress';
      } else {
        newStoryStatus = 'todo';
      }
    }
    if (newStoryStatus !== story.status) {
      const { moveStory } = await import('../../store/story-store.js');
      await moveStory(root, sprintId, storyId, newStoryStatus);
    }
    return { ok: true, direction: 'pull', storyId, fromTaskStatuses: valid, derivedStoryStatus: newStoryStatus };
  } else {
    // push: story.status → 所有 task.status
    const targetTaskStatus = taskStatusFromStoryStatus(story.status);
    const results: Array<{ ref: string; ok: boolean; error?: string }> = [];
    for (const ref of story.taskRefs) {
      try {
        await setTaskStatus(root, ref, targetTaskStatus);
        results.push({ ref: `${ref.featureId}/${ref.taskId}`, ok: true });
      } catch (e) {
        results.push({ ref: `${ref.featureId}/${ref.taskId}`, ok: false, error: (e as Error).message });
      }
    }
    return { ok: true, direction: 'push', storyId, storyStatus: story.status, pushedTaskStatus: targetTaskStatus, results };
  }
}

// ── Tool 17: plan_status_sync（全 sprint 批量）──────────────
export async function planStatusSync(ctx: ToolContext, args: {
  action: 'pull' | 'push';
  sprintId: string;
  storyId?: string;
}): Promise<unknown> {
  const { root } = ctx;
  if (args.storyId) {
    return syncStoryStatus(root, args.sprintId, args.storyId, args.action);
  }
  const sprint = await getSprint(root, args.sprintId);
  if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
  const storiesWithLinks = sprint.stories.filter((s) => s.taskRefs.length > 0);
  const results: Array<{ storyId: string; result: unknown }> = [];
  for (const s of storiesWithLinks) {
    try {
      const r = await syncStoryStatus(root, args.sprintId, s.storyId, args.action);
      results.push({ storyId: s.storyId, result: r });
    } catch (e) {
      results.push({ storyId: s.storyId, result: { ok: false, error: (e as Error).message } });
    }
  }
  return { ok: true, direction: args.action, synced: results.length, results };
}

// ── Tool 18: import_from_plan ───────────────────────────────
export async function importFromPlan(ctx: ToolContext, args: {
  action: 'from_taskgraph' | 'from_journeys';
  sprintId: string;
  featureId: string;
  defaultPoints?: number;
}): Promise<unknown> {
  const { root } = ctx;
  const doc = await readTaskGraph(root, args.featureId);
  if (!doc) throw new Error(`Task graph 不存在: ${args.featureId}`);
  const points = (args.defaultPoints ?? 3) as Story['storyPoints'];

  if (args.action === 'from_taskgraph') {
    // 每个 task → 一个 backlog story
    const imported: Array<{ storyId: string; taskId: string; title: string }> = [];
    for (const t of doc.tasks) {
      const story = await createStory(root, args.sprintId, {
        title: t.title,
        type: 'task',
        storyPoints: points,
        status: 'backlog',
        taskRefs: [{
          featureId: args.featureId,
          taskId: t.id,
          subsystem: t.subsystem ?? t.group,
          planFile: doc.planPath ?? doc.planFile ?? doc.plan,
          titleSnapshot: t.title,
        }],
        tags: t.group ? [t.group] : [],
      });
      // 反向指针
      await setTaskSprintId(root, args.featureId, t.id, args.sprintId);
      imported.push({ storyId: story.storyId, taskId: t.id, title: t.title });
    }
    return { ok: true, action: 'from_taskgraph', source: args.featureId, imported: imported.length, stories: imported };
  } else {
    // from_journeys: 每个 journey → epic
    const imported: Array<{ epicId: string; journeyId: string }> = [];
    for (const j of doc.journeys) {
      if (!j.id) continue;
      const epic = await createEpic(root, args.sprintId, {
        title: j.title ?? j.id,
        journeyRef: j.id,
      });
      imported.push({ epicId: epic.epicId, journeyId: j.id });
    }
    return { ok: true, action: 'from_journeys', source: args.featureId, imported: imported.length, epics: imported };
  }
}

// ── Tool 19: export_to_taskgraph ────────────────────────────
export async function exportToTaskGraph(ctx: ToolContext, args: {
  action: 'sprint_to_tasks';
  sprintId: string;
  featureId: string;
  onlyStatus?: StoryStatus;
}): Promise<unknown> {
  const { root } = ctx;
  const sprint = await getSprint(root, args.sprintId);
  if (!sprint) throw new Error(`Sprint 不存在: ${args.sprintId}`);
  const stories = args.onlyStatus ? sprint.stories.filter((s) => s.status === args.onlyStatus) : sprint.stories;

  // 读取或新建 task graph 骨架
  let doc = await readTaskGraph(root, args.featureId);
  if (!doc) {
    // 新建骨架
    const skeleton = {
      featureId: args.featureId,
      title: `Sprint ${sprint.name} 导出`,
      status: 'planning',
      tasks: [],
    };
    const { writeJsonAtomic } = await import('../../store/repo.js');
    const { join } = await import('node:path');
    const TASKS_DIR = join(root, 'docs', 'superpowers', 'tasks');
    await writeJsonAtomic(join(TASKS_DIR, `${args.featureId}.json`), skeleton);
    doc = await readTaskGraph(root, args.featureId);
  }
  if (!doc) throw new Error('导出骨架创建失败');

  // 每个 story → 一个 task 节点
  const exported: Array<{ storyId: string; taskId: string }> = [];
  for (const s of stories) {
    const taskId = s.storyId; // 用 storyId 作为 taskId（保持映射可追溯）
    const existing = doc.tasks.find((t) => t.id === taskId);
    if (existing) {
      existing.status = taskStatusFromStoryStatus(s.status);
      existing.title = s.title;
      existing.sprintId = args.sprintId;
    } else {
      doc.tasks.push({
        id: taskId,
        title: s.title,
        status: taskStatusFromStoryStatus(s.status),
        sprintId: args.sprintId,
        raw: {
          id: taskId,
          title: s.title,
          status: taskStatusFromStoryStatus(s.status),
          sprintId: args.sprintId,
          storyPoints: s.storyPoints,
          assignee: s.assignee,
        },
      });
    }
    exported.push({ storyId: s.storyId, taskId });
  }

  await writeTaskGraph(root, doc);
  return { ok: true, featureId: args.featureId, exported: exported.length, tasks: exported };
}
