/**
 * Sprint Store — sprint 注册表的 CRUD + 状态机。
 *
 * 一个 sprint 一个 JSON 文件（docs/superpowers/sprints/<sprintId>.json）。
 * 仿 journey-registry.json 模式：不进 task graph validator 校验。
 */

import {
  sprintFile,
  readJsonOrNull,
  writeJsonAtomic,
  listJsonIds,
  removeFile,
  pathExists,
  sprintsDir,
} from './repo.js';
import type {
  Sprint,
  SprintStatus,
  Story,
  Epic,
  Dependency,
  Comment,
  ActivityEntry,
  RetrospectiveItem,
} from '../types.js';
import { recordActivity } from './activity-log.js';

const NOW = () => new Date().toISOString();

const VALID_TRANSITIONS: Record<SprintStatus, SprintStatus[]> = {
  planning: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isValidTransition(from: SprintStatus, to: SprintStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** 新建空 sprint 骨架 */
export function createSprintSkeleton(
  sprintId: string,
  fields: {
    name: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
    teamCapacity?: number;
    createdBy?: string;
  },
): Sprint {
  const now = NOW();
  return {
    sprintId,
    name: fields.name,
    goal: fields.goal,
    status: 'planning',
    startDate: fields.startDate,
    endDate: fields.endDate,
    teamCapacity: fields.teamCapacity,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    epics: [],
    stories: [],
    dependencies: [],
    comments: [],
    activityLog: [],
    retrospective: [],
    metadata: { updatedAt: now, createdBy: fields.createdBy },
  };
}

/** 创建 sprint 文件；已存在抛错 */
export async function createSprint(
  root: string,
  sprintId: string,
  fields: { name: string; goal?: string; startDate?: string; endDate?: string; teamCapacity?: number; createdBy?: string },
): Promise<Sprint> {
  const file = sprintFile(sprintId, root);
  if (await pathExists(file)) {
    throw new Error(`Sprint 已存在: ${sprintId}`);
  }
  const sprint = createSprintSkeleton(sprintId, fields);
  recordActivity(sprint, { actor: fields.createdBy ?? 'agent', action: 'sprint.created' });
  await writeJsonAtomic(file, sprint);
  return sprint;
}

/** 读取单个 sprint */
export async function getSprint(root: string, sprintId: string): Promise<Sprint | null> {
  return readJsonOrNull<Sprint>(sprintFile(sprintId, root));
}

/** 读取或抛错 */
export async function getSprintOrThrow(root: string, sprintId: string): Promise<Sprint> {
  const s = await getSprint(root, sprintId);
  if (!s) throw new Error(`Sprint 不存在: ${sprintId}`);
  return s;
}

/** 列出所有 sprint（摘要：不含 stories 全量） */
export async function listSprints(root: string): Promise<Array<{ sprintId: string; name: string; status: SprintStatus; storyCount: number; doneCount: number; points: number }>> {
  const ids = await listJsonIds(sprintsDir(root));
  const out = [];
  for (const id of ids) {
    const s = await getSprint(root, id);
    if (!s) continue;
    out.push({
      sprintId: s.sprintId,
      name: s.name,
      status: s.status,
      storyCount: s.stories.length,
      doneCount: s.stories.filter((st) => st.status === 'done').length,
      points: s.stories.reduce((sum, st) => sum + st.storyPoints, 0),
    });
  }
  return out;
}

/** 找当前 active 的 sprint（最多一个） */
export async function getCurrentSprint(root: string): Promise<Sprint | null> {
  const ids = await listJsonIds(sprintsDir(root));
  for (const id of ids) {
    const s = await getSprint(root, id);
    if (s && s.status === 'active') return s;
  }
  return null;
}

/** 内部：读 → 改 → 写回（带 updatedAt + activity 记录） */
export async function mutateSprint(
  root: string,
  sprintId: string,
  fn: (s: Sprint) => void | ActivityEntry[],
): Promise<Sprint> {
  const sprint = await getSprintOrThrow(root, sprintId);
  const extraActivities = fn(sprint) ?? [];
  sprint.metadata.updatedAt = NOW();
  for (const a of extraActivities) sprint.activityLog.unshift(a);
  await writeJsonAtomic(sprintFile(sprintId, root), sprint);
  return sprint;
}

/** 状态流转：start / close / cancel */
export async function transitionSprint(
  root: string,
  sprintId: string,
  to: SprintStatus,
  actor: string = 'agent',
): Promise<Sprint> {
  return mutateSprint(root, sprintId, (s) => {
    if (!isValidTransition(s.status, to)) {
      throw new Error(`非法状态流转: ${s.status} → ${to}（sprint=${sprintId}）`);
    }
    const from = s.status;
    s.status = to;
    if (to === 'active') s.startedAt = NOW();
    if (to === 'completed') s.completedAt = NOW();
    return [{ at: NOW(), actor, action: 'sprint.transition', from, to, detail: `Sprint ${sprintId}: ${from}→${to}` }];
  });
}

/** 更新 sprint 基本字段 */
export async function updateSprint(
  root: string,
  sprintId: string,
  patch: Partial<Pick<Sprint, 'name' | 'goal' | 'startDate' | 'endDate' | 'teamCapacity' | 'branch'>>,
  actor: string = 'agent',
): Promise<Sprint> {
  return mutateSprint(root, sprintId, (s) => {
    const changes: string[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) {
        (s as unknown as Record<string, unknown>)[k] = v;
        changes.push(`${k}=${String(v)}`);
      }
    }
    return [{ at: NOW(), actor, action: 'sprint.updated', detail: changes.join(', ') }];
  });
}

/** 删除 sprint 文件（story.taskRefs 反向清理由 taskgraph-bridge 负责） */
export async function deleteSprint(root: string, sprintId: string): Promise<void> {
  await removeFile(sprintFile(sprintId, root));
}

// ── 内部集合操作（供 story-store / epic-store 复用）──────────
export function findStory(sprint: Sprint, storyId: string): Story | undefined {
  return sprint.stories.find((s) => s.storyId === storyId);
}

export function findEpic(sprint: Sprint, epicId: string): Epic | undefined {
  return sprint.epics.find((e) => e.epicId === epicId);
}

export function findDependencyIndex(sprint: Sprint, from: string, to: string): number {
  return sprint.dependencies.findIndex((d) => d.fromStoryId === from && d.toStoryId === to);
}

export function nextOrder(sprint: Sprint): number {
  return sprint.stories.reduce((max, s) => Math.max(max, s.order), 0) + 1;
}

export function storiesOfStatus(sprint: Sprint, status: Story['status']): Story[] {
  return sprint.stories.filter((s) => s.status === status);
}

export function epicStories(sprint: Sprint, epicId: string): Story[] {
  return sprint.stories.filter((s) => s.epicId === epicId);
}

// 占位导出，确保 TS 不抱怨未使用类型
export type { Dependency, Comment, ActivityEntry, RetrospectiveItem };
