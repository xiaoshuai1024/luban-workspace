/**
 * Story Store — story 生命周期 + backlog + 依赖 + 评论。
 *
 * Story 数据内嵌在 sprint JSON 的 stories[] 数组里（单文件原子保证一致性）。
 * 跨 sprint 的 story 依赖通过 sprint.dependencies[] 表达（featureId 维度的全局 storyId）。
 */

import { mutateSprint, findStory, nextOrder, getSprintOrThrow } from './sprint-store.js';
import { recordActivity } from './activity-log.js';
import type { Sprint, Story, StoryStatus, StoryType, StoryPoints, Dependency, DependencyType, Comment, TaskRef } from '../types.js';
import { STORY_POINTS, TERMINAL_STORY_STATUS } from '../types.js';

const NOW = () => new Date().toISOString();

/** Story 状态流转规则（敏捷看板列）*/
const STORY_TRANSITIONS: Record<StoryStatus, StoryStatus[]> = {
  backlog: ['todo', 'in_progress'],
  todo: ['in_progress', 'backlog', 'deferred', 'done'],
  in_progress: ['review', 'testing', 'done', 'todo', 'deferred'],
  review: ['testing', 'done', 'in_progress', 'todo'],
  testing: ['done', 'review', 'in_progress'],
  done: ['todo', 'in_progress'], // 可回退
  deferred: ['todo', 'backlog'],
};

export function isValidStoryTransition(from: StoryStatus, to: StoryStatus): boolean {
  // 同状态视为 no-op，合法
  if (from === to) return true;
  return STORY_TRANSITIONS[from]?.includes(to) ?? false;
}

function assertStoryPoints(p: number): asserts p is StoryPoints {
  if (!STORY_POINTS.includes(p as StoryPoints)) {
    throw new Error(`非法 storyPoints: ${p}（须为 Fibonacci: ${STORY_POINTS.join(', ')}）`);
  }
}

function genStoryId(sprint: Sprint): string {
  let max = 0;
  for (const s of sprint.stories) {
    const m = /^ST-(\d+)$/.exec(s.storyId);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ST-${String(max + 1).padStart(3, '0')}`;
}

/** 创建 story */
export async function createStory(
  root: string,
  sprintId: string,
  fields: {
    title: string;
    description?: string;
    type?: StoryType;
    storyPoints: StoryPoints;
    status?: StoryStatus;
    assignee?: string;
    epicId?: string | null;
    taskRefs?: TaskRef[];
    tags?: string[];
  },
  actor: string = 'agent',
): Promise<Story> {
  assertStoryPoints(fields.storyPoints);
  let created!: Story;
  await mutateSprint(root, sprintId, (s) => {
    const storyId = genStoryId(s);
    const now = NOW();
    const status = fields.status ?? 'backlog';
    created = {
      storyId,
      epicId: fields.epicId ?? null,
      title: fields.title,
      description: fields.description,
      type: fields.type ?? 'story',
      storyPoints: fields.storyPoints,
      status,
      assignee: fields.assignee,
      taskRefs: fields.taskRefs ?? [],
      sprintId,
      order: nextOrder(s),
      tags: fields.tags ?? [],
      createdAt: now,
      metadata: { updatedAt: now },
    };
    s.stories.push(created);
    recordActivity(s, { actor, action: 'story.created', storyId, to: status });
  });
  return created;
}

/** 更新 story 字段 */
export async function updateStory(
  root: string,
  sprintId: string,
  storyId: string,
  patch: Partial<Pick<Story, 'title' | 'description' | 'type' | 'storyPoints' | 'assignee' | 'tags' | 'blockedReason' | 'epicId'>>,
  actor: string = 'agent',
): Promise<Story> {
  if (patch.storyPoints !== undefined) assertStoryPoints(patch.storyPoints);
  let updated!: Story;
  await mutateSprint(root, sprintId, (s) => {
    const story = findStory(s, storyId);
    if (!story) throw new Error(`Story 不存在: ${storyId}`);
    const changes: string[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) {
        (story as unknown as Record<string, unknown>)[k] = v;
        changes.push(`${k}=${String(v)}`);
      }
    }
    story.metadata.updatedAt = NOW();
    updated = story;
    recordActivity(s, { actor, action: 'story.updated', storyId, detail: changes.join(', ') });
  });
  return updated;
}

/** 移动 story 到新状态 */
export async function moveStory(
  root: string,
  sprintId: string,
  storyId: string,
  to: StoryStatus,
  actor: string = 'agent',
): Promise<Story> {
  let moved!: Story;
  await mutateSprint(root, sprintId, (s) => {
    const story = findStory(s, storyId);
    if (!story) throw new Error(`Story 不存在: ${storyId}`);
    if (!isValidStoryTransition(story.status, to)) {
      throw new Error(`非法 story 状态流转: ${story.status} → ${to}（story=${storyId}）`);
    }
    const from = story.status;
    story.status = to;
    story.metadata.updatedAt = NOW();
    if (to === 'done' && story.blockedReason) {
      story.blockedReason = undefined;
    }
    moved = story;
    recordActivity(s, { actor, action: 'story.moved', storyId, from, to });
  });
  return moved;
}

/** 删除 story（同时清理依赖与 epic 引用）*/
export async function deleteStory(
  root: string,
  sprintId: string,
  storyId: string,
  actor: string = 'agent',
): Promise<void> {
  await mutateSprint(root, sprintId, (s) => {
    const idx = s.stories.findIndex((st) => st.storyId === storyId);
    if (idx === -1) throw new Error(`Story 不存在: ${storyId}`);
    s.stories.splice(idx, 1);
    s.dependencies = s.dependencies.filter((d) => d.fromStoryId !== storyId && d.toStoryId !== storyId);
    for (const e of s.epics) {
      e.storyIds = e.storyIds.filter((id) => id !== storyId);
    }
    recordActivity(s, { actor, action: 'story.deleted', storyId });
  });
}

/** 列出 story（可选过滤）*/
export async function listStories(
  root: string,
  sprintId: string,
  filter?: { status?: StoryStatus; epicId?: string; assignee?: string },
): Promise<Story[]> {
  const s = await getSprintOrThrow(root, sprintId);
  return s.stories.filter((st) => {
    if (filter?.status && st.status !== filter.status) return false;
    if (filter?.epicId && st.epicId !== filter.epicId) return false;
    if (filter?.assignee && st.assignee !== filter.assignee) return false;
    return true;
  });
}

/** 把 backlog story 排入当前 sprint（status: backlog → todo）*/
export async function addToSprint(
  root: string,
  sprintId: string,
  storyId: string,
  actor: string = 'agent',
): Promise<Story> {
  return moveStory(root, sprintId, storyId, 'todo', actor);
}

/** 从 sprint 移回 backlog */
export async function removeFromSprint(
  root: string,
  sprintId: string,
  storyId: string,
  actor: string = 'agent',
): Promise<Story> {
  return moveStory(root, sprintId, storyId, 'backlog', actor);
}

/** 重排序 backlog（调整 order）*/
export async function prioritizeBacklog(
  root: string,
  sprintId: string,
  orderedStoryIds: string[],
  actor: string = 'agent',
): Promise<void> {
  await mutateSprint(root, sprintId, (s) => {
    const orderMap = new Map(orderedStoryIds.map((id, i) => [id, i + 1]));
    for (const st of s.stories) {
      if (orderMap.has(st.storyId)) {
        st.order = orderMap.get(st.storyId)!;
        st.metadata.updatedAt = NOW();
      }
    }
    recordActivity(s, { actor, action: 'backlog.reprioritized', detail: `${orderedStoryIds.length} stories reordered` });
  });
}

// ── 依赖（带环检测）──────────────────────────────────────────

/** 检查添加 from→to 是否会形成环（DFS）*/
export function wouldCreateCycle(sprint: Sprint, from: string, to: string): boolean {
  if (from === to) return true;
  // 反向搜索：从 to 出发能否回到 from
  const visited = new Set<string>();
  const stack = [to];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === from) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const d of sprint.dependencies) {
      if (d.fromStoryId === node) stack.push(d.toStoryId);
    }
  }
  return false;
}

export async function addDependency(
  root: string,
  sprintId: string,
  from: string,
  to: string,
  type: DependencyType = 'blocks',
  actor: string = 'agent',
): Promise<Dependency> {
  let dep!: Dependency;
  await mutateSprint(root, sprintId, (s) => {
    if (!findStory(s, from)) throw new Error(`Story 不存在: ${from}`);
    if (!findStory(s, to)) throw new Error(`Story 不存在: ${to}`);
    if (wouldCreateCycle(s, from, to)) {
      throw new Error(`依赖会形成环: ${from} → ${to}（拒绝）`);
    }
    const exists = s.dependencies.findIndex((d) => d.fromStoryId === from && d.toStoryId === to);
    if (exists !== -1) throw new Error(`依赖已存在: ${from} → ${to}`);
    dep = { fromStoryId: from, toStoryId: to, type };
    s.dependencies.push(dep);
    recordActivity(s, { actor, action: 'dependency.added', detail: `${from} -[${type}]-> ${to}` });
  });
  return dep;
}

export async function removeDependency(
  root: string,
  sprintId: string,
  from: string,
  to: string,
  actor: string = 'agent',
): Promise<void> {
  await mutateSprint(root, sprintId, (s) => {
    const idx = s.dependencies.findIndex((d) => d.fromStoryId === from && d.toStoryId === to);
    if (idx === -1) throw new Error(`依赖不存在: ${from} → ${to}`);
    s.dependencies.splice(idx, 1);
    recordActivity(s, { actor, action: 'dependency.removed', detail: `${from} -> ${to}` });
  });
}

export function storyDependencies(sprint: Sprint, storyId: string): { blockedBy: Dependency[]; blocking: Dependency[] } {
  return {
    blockedBy: sprint.dependencies.filter((d) => d.fromStoryId === storyId),
    blocking: sprint.dependencies.filter((d) => d.toStoryId === storyId),
  };
}

/** story 是否就绪可开始（无未完成依赖、非终态）*/
export function isStoryReady(sprint: Sprint, story: Story): boolean {
  if (TERMINAL_STORY_STATUS.has(story.status)) return false;
  const { blockedBy } = storyDependencies(sprint, story.storyId);
  return blockedBy.every((d) => {
    const dep = findStory(sprint, d.toStoryId);
    return dep && TERMINAL_STORY_STATUS.has(dep.status);
  });
}

// ── 评论 ─────────────────────────────────────────────────────

let commentCounter = 0;
function genCommentId(): string {
  commentCounter += 1;
  return `C-${Date.now()}-${commentCounter}`;
}

export async function addComment(
  root: string,
  sprintId: string,
  storyId: string,
  content: string,
  author: string = 'agent',
): Promise<Comment> {
  let comment!: Comment;
  await mutateSprint(root, sprintId, (s) => {
    if (!findStory(s, storyId)) throw new Error(`Story 不存在: ${storyId}`);
    comment = { id: genCommentId(), storyId, author, content, at: NOW() };
    s.comments.push(comment);
    recordActivity(s, { actor: author, action: 'comment.added', storyId });
  });
  return comment;
}

export function storyComments(sprint: Sprint, storyId: string): Comment[] {
  return sprint.comments.filter((c) => c.storyId === storyId);
}
