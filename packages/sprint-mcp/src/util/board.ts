/**
 * Board 视图聚合 — 把 sprint.stories 按状态分列，支持筛选。
 */

import type { Sprint, Story, SprintBoard, StoryStatus } from '../types.js';
import { STORY_STATUS_ORDER } from '../types.js';

const DEFAULT_COLUMNS: StoryStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'testing', 'done'];

/** 把 sprint 聚合成看板（按状态分列）*/
export function buildSprintBoard(sprint: Sprint): SprintBoard {
  const columns = DEFAULT_COLUMNS.map((status) => ({
    status,
    stories: sprint.stories
      .filter((s) => s.status === status)
      .sort((a, b) => a.order - b.order),
  }));
  const totalStories = sprint.stories.length;
  const doneStories = sprint.stories.filter((s) => s.status === 'done').length;
  const totalPoints = sprint.stories.reduce((sum, s) => sum + s.storyPoints, 0);
  const donePoints = sprint.stories.filter((s) => s.status === 'done').reduce((sum, s) => sum + s.storyPoints, 0);
  return {
    sprintId: sprint.sprintId,
    name: sprint.name,
    status: sprint.status,
    columns,
    totalStories,
    doneStories,
    totalPoints,
    donePoints,
  };
}

/** backlog 视图：sprintId=null 的 story（散落在各 sprint 文件的 backlog 池） */
export function buildBacklogBoard(allSprints: Sprint[]): Story[] {
  return allSprints
    .flatMap((s) => s.stories.filter((st) => st.status === 'backlog'))
    .sort((a, b) => a.order - b.order);
}

/** 统一筛选器 */
export interface StoryFilter {
  assignee?: string;
  epicId?: string;
  subsystem?: string;
  status?: StoryStatus;
  tags?: string[];
}

export function filterStories(stories: Story[], filter: StoryFilter): Story[] {
  return stories.filter((s) => {
    if (filter.assignee && s.assignee !== filter.assignee) return false;
    if (filter.epicId && s.epicId !== filter.epicId) return false;
    if (filter.status && s.status !== filter.status) return false;
    if (filter.subsystem) {
      // subsystem 在 taskRefs 里
      const match = s.taskRefs.some((r) => r.subsystem === filter.subsystem);
      if (!match) return false;
    }
    if (filter.tags && filter.tags.length > 0) {
      const has = filter.tags.every((t) => s.tags.includes(t));
      if (!has) return false;
    }
    return true;
  });
}

/** 导出为 CSV */
export function storiesToCsv(stories: Story[]): string {
  const header = 'storyId,title,status,type,storyPoints,assignee,epicId,sprintId,tags,taskRefs\n';
  const rows = stories.map((s) => {
    const taskRefs = s.taskRefs.map((r) => `${r.featureId}/${r.taskId}`).join(';');
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [
      s.storyId,
      escape(s.title),
      s.status,
      s.type,
      s.storyPoints,
      escape(s.assignee ?? ''),
      escape(s.epicId ?? ''),
      escape(s.sprintId ?? ''),
      escape(s.tags.join(',')),
      escape(taskRefs),
    ].join(',');
  });
  return header + rows.join('\n');
}

/** 导出为 Markdown 表格 */
export function storiesToMarkdown(stories: Story[]): string {
  if (stories.length === 0) return '_无 story_\n';
  const header = '| StoryID | 标题 | 状态 | 点数 | 负责人 | 任务链接 |\n|---|---|---|---|---|---|\n';
  const rows = stories
    .slice()
    .sort((a, b) => STORY_STATUS_ORDER[a.status] - STORY_STATUS_ORDER[b.status])
    .map((s) => {
      const refs = s.taskRefs.map((r) => `\`${r.featureId}/${r.taskId}\``).join(' ');
      return `| ${s.storyId} | ${s.title} | ${s.status} | ${s.storyPoints} | ${s.assignee ?? '-'} | ${refs} |`;
    });
  return header + rows.join('\n') + '\n';
}
