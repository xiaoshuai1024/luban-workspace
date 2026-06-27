/**
 * Task Graph Bridge — 与现有 SSOT 任务图（docs/superpowers/tasks/*.json）联动。
 *
 * 这一层处理 task graph 的「碎片化」现实（来自探索结论）：
 *   - 3 种节点词汇：tasks[] / children[]（program tree） / 嵌套
 *   - task status 枚举三方不一致（doc=4值，脚本=11值，实际文件=6+值）
 *   - dependsOn 单文件 scope（跨 feature 依赖无法表达）
 *   - journey 可 ref 引用全局 registry
 *
 * 策略：duck-typing 读取，统一抽象为 TaskGraphNode；写回时只加 sprintId 字段，
 * 不动其他字段（向后兼容，validator 本就忽略未知字段）。
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { writeJsonAtomic } from './repo.js';
import type { TaskRef, StoryStatus } from '../types.js';

const TASKS_DIR = (root: string) => join(root, 'docs', 'superpowers', 'tasks');

/** 抽象的 task graph 节点（统一 3 种碎片化形状） */
export interface TaskGraphNode {
  id: string;
  title: string;
  status: string;
  subsystem?: string;
  group?: string;
  dependsOn?: string[];
  sprintId?: string | null;
  /** 原始节点对象（写回时保留其他字段） */
  raw: Record<string, unknown>;
}

/** 抽象的 task graph 文件 */
export interface TaskGraphDoc {
  featureId: string;
  title: string;
  status?: string;
  planPath?: string;
  planFile?: string;
  plan?: string;
  tasks: TaskGraphNode[];
  journeys: Array<{ id: string; ref?: boolean; title?: string; priority?: string }>;
  /** 原始 JSON（写回时保留其他顶层字段） */
  raw: Record<string, unknown>;
  /** tasks 字段在 raw 中的键名（'tasks' | 'children'） */
  tasksKey: 'tasks' | 'children';
}

/** task status → 是否终态（对齐 in-progress-summary.mjs 的 TASK_DONE 集合）*/
const TASK_DONE = new Set(['done', 'completed', 'deferred', 'cancelled', 'skipped']);

/** story status ↔ task status 映射（双向同步用） */
export function storyStatusFromTaskStatus(taskStatus: string): StoryStatus {
  if (TASK_DONE.has(taskStatus)) return 'done';
  if (taskStatus === 'in_progress' || taskStatus === 'in-progress') return 'in_progress';
  if (taskStatus === 'blocked') return 'in_progress'; // 阻塞也算进行中
  if (taskStatus === 'review' || taskStatus === 'testing') return taskStatus as StoryStatus;
  return 'todo'; // pending / todo / 未知
}

export function taskStatusFromStoryStatus(storyStatus: StoryStatus): string {
  switch (storyStatus) {
    case 'backlog':
    case 'todo':
      return 'pending';
    case 'in_progress':
      return 'in_progress';
    case 'review':
      return 'review';
    case 'testing':
      return 'testing';
    case 'done':
      return 'done';
    case 'deferred':
      return 'deferred';
  }
}

/** 从 task 节点抽象出 TaskGraphNode（兼容 tasks[] 和 children[]） */
function normalizeNode(rawNode: Record<string, unknown>): TaskGraphNode | null {
  const id = rawNode.id as string | undefined;
  if (!id) return null;
  return {
    id,
    title: (rawNode.title as string) ?? id,
    status: (rawNode.status as string) ?? 'pending',
    subsystem: rawNode.subsystem as string | undefined,
    group: rawNode.group as string | undefined,
    dependsOn: rawNode.dependsOn as string[] | undefined,
    sprintId: (rawNode.sprintId as string | null | undefined) ?? null,
    raw: rawNode,
  };
}

/** 读取并归一化 task graph 文件 */
export async function readTaskGraph(root: string, featureId: string): Promise<TaskGraphDoc | null> {
  const file = join(TASKS_DIR(root), `${featureId}.json`);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }

  const featureIdVal = (raw.featureId as string) ?? featureId;
  const title = (raw.title as string) ?? featureId;

  // 优先 tasks[]，fallback children[]（program tree 形状）
  let tasksRaw: unknown[] | undefined;
  let tasksKey: 'tasks' | 'children' = 'tasks';
  if (Array.isArray(raw.tasks)) {
    tasksRaw = raw.tasks;
  } else if (Array.isArray(raw.children)) {
    tasksRaw = raw.children;
    tasksKey = 'children';
  }

  const tasks: TaskGraphNode[] = [];
  if (tasksRaw) {
    for (const t of tasksRaw) {
      if (t && typeof t === 'object') {
        const node = normalizeNode(t as Record<string, unknown>);
        if (node) tasks.push(node);
      }
    }
  }

  const journeysRaw = Array.isArray(raw.journeys) ? (raw.journeys as Array<Record<string, unknown>>) : [];
  const journeys = journeysRaw.map((j) => ({
    id: (j.id as string) ?? '',
    ref: (j.ref as boolean) ?? false,
    title: j.title as string | undefined,
    priority: j.priority as string | undefined,
  }));

  return {
    featureId: featureIdVal,
    title,
    status: raw.status as string | undefined,
    planPath: raw.planPath as string | undefined,
    planFile: raw.planFile as string | undefined,
    plan: raw.plan as string | undefined,
    tasks,
    journeys,
    raw,
    tasksKey,
  };
}

/** 写回 task graph：仅更新 sprintId 字段，其他字段原样保留 */
export async function writeTaskGraph(root: string, doc: TaskGraphDoc): Promise<void> {
  const file = join(TASKS_DIR(root), `${doc.featureId}.json`);
  // 把 normalize 后的 tasks 写回 raw（保留 raw 上的其他顶层字段）
  const out = { ...doc.raw };
  const tasksArr = doc.tasks.map((t) => {
    const node = { ...t.raw };
    if (t.sprintId) {
      node.sprintId = t.sprintId;
    } else {
      delete node.sprintId;
    }
    return node;
  });
  out[doc.tasksKey] = tasksArr;
  await writeJsonAtomic(file, out);
}

/** 给某个 task 设置 sprintId 反向指针 */
export async function setTaskSprintId(
  root: string,
  featureId: string,
  taskId: string,
  sprintId: string | null,
): Promise<TaskGraphDoc> {
  const doc = await readTaskGraph(root, featureId);
  if (!doc) throw new Error(`Task graph 不存在: ${featureId}`);
  const task = doc.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Task 不存在: ${featureId}/${taskId}`);
  task.sprintId = sprintId;
  await writeTaskGraph(root, doc);
  return doc;
}

/** 批量清空某 sprint 的所有 task 反向指针（删 sprint 时调用）*/
export async function clearSprintRefs(root: string, sprintId: string): Promise<{ cleared: number; files: string[] }> {
  const dir = TASKS_DIR(root);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { cleared: 0, files: [] };
  }
  const files: string[] = [];
  let cleared = 0;
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    const featureId = f.slice(0, -5);
    const doc = await readTaskGraph(root, featureId);
    if (!doc) continue;
    let changed = false;
    for (const t of doc.tasks) {
      if (t.sprintId === sprintId) {
        t.sprintId = null;
        cleared++;
        changed = true;
      }
    }
    if (changed) {
      await writeTaskGraph(root, doc);
      files.push(featureId);
    }
  }
  return { cleared, files };
}

/** 根据 TaskRef 读取对应 task 的状态 */
export async function getTaskStatus(root: string, ref: TaskRef): Promise<string | null> {
  const doc = await readTaskGraph(root, ref.featureId);
  if (!doc) return null;
  const task = doc.tasks.find((t) => t.id === ref.taskId);
  return task?.status ?? null;
}

/** 根据 TaskRef 设置 task 状态（push 同步用）*/
export async function setTaskStatus(root: string, ref: TaskRef, status: string): Promise<void> {
  const doc = await readTaskGraph(root, ref.featureId);
  if (!doc) throw new Error(`Task graph 不存在: ${ref.featureId}`);
  const task = doc.tasks.find((t) => t.id === ref.taskId);
  if (!task) throw new Error(`Task 不存在: ${ref.featureId}/${ref.taskId}`);
  task.status = status;
  task.raw.status = status;
  await writeTaskGraph(root, doc);
}

/** 列出 feature 的所有 task（导入用）*/
export async function listTasks(root: string, featureId: string): Promise<TaskGraphNode[]> {
  const doc = await readTaskGraph(root, featureId);
  return doc?.tasks ?? [];
}

/** 列出 feature 的所有 journey（导入为 epic 用）*/
export async function listJourneys(root: string, featureId: string): Promise<Array<{ id: string; title?: string; priority?: string; ref?: boolean }>> {
  const doc = await readTaskGraph(root, featureId);
  return doc?.journeys ?? [];
}
