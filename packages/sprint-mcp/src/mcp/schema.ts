/**
 * Zod schemas — 所有 MCP tool 的输入参数定义。
 *
 * 采用 manager + action 模式：每个 tool 接 action + 该 action 需要的扁平参数。
 * 借鉴 bradrisse/kanban-mcp 与 Sprintra 的工具命名约定。
 */

import { z } from 'zod';

// ── 枚举（与 types.ts 对齐，但 zod 形式供 tool 校验）────────
const STORY_POINTS_VALUES = [1, 2, 3, 5, 8, 13] as const;

// ── Tool 1: sprint_manager ──────────────────────────────────
export const SprintManagerSchema = {
  action: z.enum(['create', 'start', 'close', 'cancel', 'get', 'list', 'get_current', 'update']),
  sprintId: z.string().optional().describe('Sprint ID（除 create/list/get_current 外必填）'),
  name: z.string().optional().describe('create/update: sprint 名称'),
  goal: z.string().optional().describe('create/update: 迭代目标'),
  startDate: z.string().optional().describe('create/update: YYYY-MM-DD'),
  endDate: z.string().optional().describe('create/update: YYYY-MM-DD'),
  teamCapacity: z.number().int().positive().optional().describe('create/update: 团队人天容量'),
  branch: z.string().optional().describe('update: 绑定 git branch'),
};

// ── Tool 2: sprint_metrics ──────────────────────────────────
export const SprintMetricsSchema = {
  action: z.enum(['burndown', 'velocity', 'readiness', 'summary']),
  sprintId: z.string().describe('Sprint ID'),
};

// ── Tool 3: sprint_carryover ────────────────────────────────
export const SprintCarryoverSchema = {
  action: z.literal('execute'),
  sprintId: z.string().describe('要收尾的 sprint（须 active）'),
  targetSprintId: z.string().optional().describe('未完成 story 转入的目标 sprint；不填则转 backlog'),
};

// ── Tool 4: story_manager ───────────────────────────────────
export const StoryManagerSchema = {
  action: z.enum(['create', 'update', 'get', 'move', 'delete', 'list']),
  sprintId: z.string().describe('Story 所属 sprint'),
  storyId: z.string().optional().describe('update/get/move/delete: story ID'),
  title: z.string().optional().describe('create/update: 标题'),
  description: z.string().optional(),
  type: z.enum(['story', 'task', 'bug', 'chore']).optional(),
  storyPoints: z.number().int().refine((n) => STORY_POINTS_VALUES.includes(n as (typeof STORY_POINTS_VALUES)[number]), '须为 Fibonacci 数').optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'testing', 'done', 'deferred']).optional(),
  assignee: z.string().optional(),
  epicId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  filterStatus: z.enum(['backlog', 'todo', 'in_progress', 'review', 'testing', 'done', 'deferred']).optional().describe('list: 按状态过滤'),
};

// ── Tool 5: story_backlog ───────────────────────────────────
export const StoryBacklogSchema = {
  action: z.enum(['add_to_sprint', 'remove_from_sprint', 'list_backlog', 'prioritize']),
  sprintId: z.string().describe('Sprint ID'),
  storyId: z.string().optional(),
  orderedStoryIds: z.array(z.string()).optional().describe('prioritize: 排序后的 storyId 列表'),
};

// ── Tool 6: story_context ───────────────────────────────────
export const StoryContextSchema = {
  action: z.literal('get'),
  sprintId: z.string(),
  storyId: z.string(),
};

// ── Tool 7: story_dependency ────────────────────────────────
export const StoryDependencySchema = {
  action: z.enum(['add', 'remove', 'list', 'graph']),
  sprintId: z.string(),
  fromStoryId: z.string().optional().describe('add/remove: 依赖方'),
  toStoryId: z.string().optional().describe('add/remove: 被依赖方'),
  type: z.enum(['blocks', 'branches', 'merges', 'sync']).optional(),
  storyId: z.string().optional().describe('list/graph: 查询该 story 的依赖'),
};

// ── Tool 8: story_comment ───────────────────────────────────
export const StoryCommentSchema = {
  action: z.enum(['add', 'list']),
  sprintId: z.string(),
  storyId: z.string(),
  content: z.string().optional().describe('add: 评论内容'),
  author: z.string().optional(),
};

// ── Tool 9: epic_manager ────────────────────────────────────
export const EpicManagerSchema = {
  action: z.enum(['create', 'update', 'get', 'list', 'delete']),
  sprintId: z.string(),
  epicId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'done', 'cancelled']).optional(),
};

// ── Tool 10: acceptance_criteria ────────────────────────────
export const AcceptanceCriteriaSchema = {
  action: z.enum(['add', 'update_status', 'verify', 'list']),
  sprintId: z.string(),
  epicId: z.string(),
  criterionId: z.string().optional().describe('update_status/verify: 标准 ID'),
  text: z.string().optional().describe('add: 标准文本'),
  status: z.enum(['ready', 'needs_info', 'not_ready']).optional(),
};

// ── Tool 11: release_manager ────────────────────────────────
export const ReleaseManagerSchema = {
  action: z.enum(['create', 'update', 'get', 'list', 'attach_sprint', 'release']),
  releaseId: z.string().optional(),
  name: z.string().optional(),
  version: z.string().optional(),
  releaseDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'released', 'rolled_back']).optional(),
  sprintId: z.string().optional().describe('attach_sprint: 要挂载的 sprint'),
};

// ── Tool 12: release_notes ──────────────────────────────────
export const ReleaseNotesSchema = {
  action: z.literal('generate'),
  releaseId: z.string(),
};

// ── Tool 13: board_view ─────────────────────────────────────
export const BoardViewSchema = {
  action: z.enum(['sprint', 'backlog', 'release']),
  sprintId: z.string().optional().describe('sprint 视图必填'),
  releaseId: z.string().optional().describe('release 视图必填'),
};

// ── Tool 14: board_filter ───────────────────────────────────
export const BoardFilterSchema = {
  action: z.enum(['by_assignee', 'by_epic', 'by_subsystem', 'by_status']),
  sprintId: z.string().optional(),
  value: z.string().describe('筛选值（assignee/epicId/subsystem/status）'),
};

// ── Tool 15: board_export ───────────────────────────────────
export const BoardExportSchema = {
  action: z.enum(['csv', 'markdown']),
  sprintId: z.string().optional().describe('不填则导出全部 backlog'),
};

// ── Tool 16: plan_link ──────────────────────────────────────
export const PlanLinkSchema = {
  action: z.enum(['link_story_to_task', 'unlink', 'list_links', 'sync_status']),
  sprintId: z.string(),
  storyId: z.string().optional().describe('link/unlink/sync: story ID'),
  featureId: z.string().optional().describe('link: task graph featureId'),
  taskId: z.string().optional().describe('link: task 节点 id'),
  direction: z.enum(['pull', 'push']).optional().describe('sync_status: 同步方向'),
};

// ── Tool 17: plan_status_sync ───────────────────────────────
export const PlanStatusSyncSchema = {
  action: z.enum(['pull', 'push']),
  sprintId: z.string(),
  storyId: z.string().optional().describe('不填则全 sprint 同步'),
};

// ── Tool 18: import_from_plan ───────────────────────────────
export const ImportFromPlanSchema = {
  action: z.enum(['from_taskgraph', 'from_journeys']),
  sprintId: z.string().describe('导入到哪个 sprint'),
  featureId: z.string().describe('源 task graph featureId'),
  defaultPoints: z.number().int().refine((n) => STORY_POINTS_VALUES.includes(n as (typeof STORY_POINTS_VALUES)[number])).optional().describe('导入 story 默认点数（默认 3）'),
};

// ── Tool 19: export_to_taskgraph ────────────────────────────
export const ExportToTaskGraphSchema = {
  action: z.literal('sprint_to_tasks'),
  sprintId: z.string(),
  featureId: z.string().describe('目标 featureId（不存在则新建骨架）'),
  onlyStatus: z.enum(['backlog', 'todo', 'in_progress', 'review', 'testing', 'done', 'deferred']).optional().describe('只导出该状态'),
};

// ── Tool 20: sprint_retrospective ───────────────────────────
export const SprintRetrospectiveSchema = {
  action: z.enum(['start', 'add_item', 'close', 'list']),
  sprintId: z.string(),
  kind: z.enum(['keep', 'start', 'stop']).optional().describe('add_item: 复盘类别'),
  content: z.string().optional().describe('add_item: 内容'),
};

// ── Tool 21: activity_log ───────────────────────────────────
export const ActivityLogSchema = {
  action: z.enum(['list', 'filter']),
  sprintId: z.string(),
  storyId: z.string().optional(),
  actor: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
};

// ── Tool 22: git_branch_sync ────────────────────────────────
export const GitBranchSyncSchema = {
  action: z.enum(['detect', 'set_default']),
  sprintId: z.string().optional().describe('set_default: 要绑定的 sprint'),
  branch: z.string().optional().describe('set_default: 显式 branch（不填用当前 git branch）'),
};

export const ALL_TOOL_SCHEMAS = {
  sprint_manager: SprintManagerSchema,
  sprint_metrics: SprintMetricsSchema,
  sprint_carryover: SprintCarryoverSchema,
  story_manager: StoryManagerSchema,
  story_backlog: StoryBacklogSchema,
  story_context: StoryContextSchema,
  story_dependency: StoryDependencySchema,
  story_comment: StoryCommentSchema,
  epic_manager: EpicManagerSchema,
  acceptance_criteria: AcceptanceCriteriaSchema,
  release_manager: ReleaseManagerSchema,
  release_notes: ReleaseNotesSchema,
  board_view: BoardViewSchema,
  board_filter: BoardFilterSchema,
  board_export: BoardExportSchema,
  plan_link: PlanLinkSchema,
  plan_status_sync: PlanStatusSyncSchema,
  import_from_plan: ImportFromPlanSchema,
  export_to_taskgraph: ExportToTaskGraphSchema,
  sprint_retrospective: SprintRetrospectiveSchema,
  activity_log: ActivityLogSchema,
  git_branch_sync: GitBranchSyncSchema,
} as const;

export const TOOL_DESCRIPTIONS: Record<keyof typeof ALL_TOOL_SCHEMAS, string> = {
  sprint_manager: 'Sprint 迭代生命周期管理（create/start/close/cancel/get/list/get_current/update）',
  sprint_metrics: 'Sprint 指标：燃尽图 burndown / 速率 velocity / 就绪度 readiness / 汇总 summary',
  sprint_carryover: 'Sprint 收尾：把未完成 story 自动转入 backlog 或下个 sprint',
  story_manager: 'Story 用户故事 CRUD + 状态流转（create/update/get/move/delete/list）',
  story_backlog: 'Backlog ↔ Sprint 流转（add_to_sprint/remove_from_sprint/list_backlog/prioritize）',
  story_context: '聚合读取某 story 的完整上下文（story+epic+taskRefs+comments+deps+activity，减少往返）',
  story_dependency: 'Story 间依赖管理（add/remove/list/graph，含环检测）',
  story_comment: 'Story 评论（add/list）',
  epic_manager: 'Epic 史诗 CRUD（create/update/get/list/delete）',
  acceptance_criteria: 'Epic 验收标准（add/update_status/verify/list，ready/needs_info/not_ready）',
  release_manager: 'Release 发布管理（create/update/get/list/attach_sprint/release）',
  release_notes: '生成 release notes（聚合 sprint 内 done story 为 markdown）',
  board_view: '看板视图（sprint/backlog/release，返回列/卡 JSON）',
  board_filter: '看板筛选（by_assignee/by_epic/by_subsystem/by_status）',
  board_export: '看板导出（csv/markdown）',
  plan_link: '与 SSOT 任务图双向链接（link_story_to_task/unlink/list_links/sync_status）',
  plan_status_sync: '与任务图双向状态同步（pull: task→story / push: story→task）',
  import_from_plan: '从 plan-template 任务图导入（from_taskgraph: tasks→stories / from_journeys: journeys→epics）',
  export_to_taskgraph: '把 sprint stories 反向导出为 task 节点写入 feature JSON',
  sprint_retrospective: 'Sprint 复盘（start/add_item[keep/start/stop]/close/list）',
  activity_log: '活动日志查询（list/filter，审计）',
  git_branch_sync: 'Git branch ↔ Sprint 绑定（detect: 当前 branch 推导 sprint / set_default）',
};
