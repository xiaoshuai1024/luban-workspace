/**
 * Sprint MCP 核心数据类型定义
 *
 * 数据模型参考 cardo（依赖+活动日志）、Sprintra（sprint/epic/story/release 概念）、
 * bradrisse/kanban-mcp（manager+action 工具命名）。
 *
 * 存储：纯 JSON 文件（docs/superpowers/sprints/<sprintId>.json），无数据库。
 * 与现有 SSOT 任务图（docs/superpowers/tasks/*.json）通过 story.taskRefs + task.sprintId 双向链接。
 */

// ── Sprint 生命周期 ──────────────────────────────────────────
export type SprintStatus = 'planning' | 'active' | 'completed' | 'cancelled';

// ── Story 状态（覆盖 task graph hook 的全量状态联合）─────────
// backlog=未排入迭代；todo/in_progress/review/testing=进行中；done/deferred=收口
export type StoryStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'testing'
  | 'done'
  | 'deferred';

export type StoryType = 'story' | 'task' | 'bug' | 'chore';

export type DependencyType = 'blocks' | 'branches' | 'merges' | 'sync';

export type EpicStatus = 'planned' | 'in_progress' | 'done' | 'cancelled';

export type ReleaseStatus = 'planned' | 'in_progress' | 'released' | 'rolled_back';

export type AcceptanceStatus = 'ready' | 'needs_info' | 'not_ready';

export type RetroItemKind = 'keep' | 'start' | 'stop';

// ── Story Points（Fibonacci）─────────────────────────────────
export const STORY_POINTS = [1, 2, 3, 5, 8, 13] as const;
export type StoryPoints = (typeof STORY_POINTS)[number];

// ── Story 列顺序（看板渲染用，数字越小越靠左）────────────────
export const STORY_STATUS_ORDER: Record<StoryStatus, number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  review: 3,
  testing: 4,
  done: 5,
  deferred: 6,
};

export const TERMINAL_STORY_STATUS: ReadonlySet<StoryStatus> = new Set([
  'done',
  'deferred',
]);

// ── 与 SSOT 任务图的链接锚点 ──────────────────────────────────
export interface TaskRef {
  /** 指向 docs/superpowers/tasks/<featureId>.json */
  featureId: string;
  /** 该 feature JSON 内 task 节点的 id（如 W1-T1 / T-be-1） */
  taskId: string;
  /** 冗余字段，便于看板渲染无需打开 task JSON */
  subsystem?: string;
  /** 冗余：指向 .agents/plans/*.md，便于跳转 */
  planFile?: string;
  /** 冗余：task 标题快照，看板展示 */
  titleSnapshot?: string;
}

export interface Story {
  storyId: string;
  epicId?: string | null;
  title: string;
  description?: string;
  type: StoryType;
  storyPoints: StoryPoints;
  status: StoryStatus;
  assignee?: string;
  /** 与 task graph 的链接锚点（可多个：一个 story 可聚合多个细 task） */
  taskRefs: TaskRef[];
  /** 所属 sprint；null = backlog（未排入迭代） */
  sprintId: string | null;
  order: number;
  tags: string[];
  blockedReason?: string;
  createdAt: string;
  metadata: { updatedAt: string };
}

export interface Dependency {
  /** from 依赖 to（to 完成前 from 被阻塞）*/
  fromStoryId: string;
  toStoryId: string;
  type: DependencyType;
}

export interface Comment {
  id: string;
  storyId: string;
  author: string;
  content: string;
  at: string;
}

export interface ActivityEntry {
  at: string;
  actor: string;
  action: string;
  storyId?: string;
  from?: string;
  to?: string;
  detail?: string;
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
  status: AcceptanceStatus;
}

export interface Epic {
  epicId: string;
  title: string;
  description?: string;
  acceptanceCriteria: AcceptanceCriterion[];
  storyIds: string[];
  status: EpicStatus;
  /** 若来自 journey 导入，记录关联 journey id（J-xxx） */
  journeyRef?: string;
  createdAt: string;
}

export interface RetrospectiveItem {
  id: string;
  kind: RetroItemKind;
  content: string;
  at: string;
  author: string;
}

export interface Sprint {
  sprintId: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: string;
  endDate?: string;
  /** 团队总人天容量（velocity 分母） */
  teamCapacity?: number;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  epics: Epic[];
  stories: Story[];
  dependencies: Dependency[];
  comments: Comment[];
  activityLog: ActivityEntry[];
  retrospective: RetrospectiveItem[];
  metadata: { updatedAt: string; createdBy?: string };
  /** 关联 git branch（可选，用于 branch↔sprint 自动绑定） */
  branch?: string;
}

export interface Release {
  releaseId: string;
  name: string;
  version?: string;
  status: ReleaseStatus;
  sprintIds: string[];
  releaseDate?: string;
  notes?: string;
  createdAt: string;
  metadata: { updatedAt: string };
}

export interface ReleaseRegistry {
  releases: Release[];
}

// ── 聚合 / 派生类型（看板/燃尽用）──────────────────────────
export interface StoryColumn {
  status: StoryStatus;
  stories: Story[];
}

export interface SprintBoard {
  sprintId: string;
  name: string;
  status: SprintStatus;
  columns: StoryColumn[];
  totalStories: number;
  doneStories: number;
  totalPoints: number;
  donePoints: number;
}

export interface BurndownPoint {
  date: string;
  ideal: number;
  actual: number | null;
}

export interface BurndownData {
  sprintId: string;
  teamCapacity?: number;
  startDate?: string;
  endDate?: string;
  totalPoints: number;
  points: BurndownPoint[];
  status: 'on_track' | 'at_risk' | 'behind';
}

export interface VelocityData {
  sprintId: string;
  plannedPoints: number;
  completedPoints: number;
  completionRate: number;
  capacity?: number;
  utilization: number;
}

export interface ReadinessData {
  ready: number;
  needsInfo: number;
  notReady: number;
  blocked: number;
  total: number;
}

export interface SprintMetrics {
  sprintId: string;
  totalStories: number;
  doneStories: number;
  inProgressStories: number;
  blockedStories: number;
  totalPoints: number;
  donePoints: number;
  velocity?: VelocityData;
  burndown?: BurndownData;
  readiness?: ReadinessData;
}

// ── 聚合上下文读（仿 cardo get_task_context，减少 LLM 往返）──
export interface StoryContext {
  story: Story;
  epic?: Epic;
  taskRefs: TaskRef[];
  comments: Comment[];
  blockedBy: Dependency[];
  blocking: Dependency[];
  readyToStart: boolean;
  children: Story[];
  activity: ActivityEntry[];
}
