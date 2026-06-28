/**
 * MCP Server — 注册全部 22 个 tool 到 @modelcontextprotocol/sdk。
 *
 * 采用 manager + action 模式，每个 tool 的 args 用 zod schema 校验。
 * server.start() 后通过 stdio 与 agent 通信。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOL_DESCRIPTIONS, ALL_TOOL_SCHEMAS } from './schema.js';
import { sprintManager, sprintMetrics, sprintCarryover } from './tools/sprint.js';
import { storyManager, storyBacklog, storyContext, storyDependency, storyComment } from './tools/story.js';
import { epicManager, acceptanceCriteria } from './tools/epic.js';
import { releaseManager, releaseNotes } from './tools/release.js';
import { boardView, boardFilter, boardExport } from './tools/board.js';
import { planLink, planStatusSync, importFromPlan, exportToTaskGraph } from './tools/plan-link.js';
import { sprintRetrospective, activityLog, gitBranchSync } from './tools/misc.js';
import type { ToolContext } from './tools/sprint.js';

export interface CreateServerOptions {
  root: string;
}

/** 工具结果包装为 MCP content（文本 JSON） */
function toContent(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** 包装 handler：捕获异常返回 error 文本，正常返回 JSON 文本 */
function wrapHandler<T extends Record<string, unknown>>(
  ctx: ToolContext,
  fn: (ctx: ToolContext, args: T) => Promise<unknown>,
) {
  return async (args: T) => {
    try {
      const result = await fn(ctx, args);
      return toContent(result);
    } catch (e) {
      return toContent({ ok: false, error: (e as Error).message });
    }
  };
}

export function createServer(options: CreateServerOptions): McpServer {
  const ctx: ToolContext = { root: options.root };
  const server = new McpServer({
    name: 'luban-sprint-mcp',
    version: '0.1.0',
  });

  const registrations: Array<[keyof typeof ALL_TOOL_SCHEMAS, (ctx: ToolContext, args: any) => Promise<unknown>]> = [
    ['sprint_manager', sprintManager],
    ['sprint_metrics', sprintMetrics],
    ['sprint_carryover', sprintCarryover],
    ['story_manager', storyManager],
    ['story_backlog', storyBacklog],
    ['story_context', storyContext],
    ['story_dependency', storyDependency],
    ['story_comment', storyComment],
    ['epic_manager', epicManager],
    ['acceptance_criteria', acceptanceCriteria],
    ['release_manager', releaseManager],
    ['release_notes', releaseNotes],
    ['board_view', boardView],
    ['board_filter', boardFilter],
    ['board_export', boardExport],
    ['plan_link', planLink],
    ['plan_status_sync', planStatusSync],
    ['import_from_plan', importFromPlan],
    ['export_to_taskgraph', exportToTaskGraph],
    ['sprint_retrospective', sprintRetrospective],
    ['activity_log', activityLog],
    ['git_branch_sync', gitBranchSync],
  ];

  for (const [name, fn] of registrations) {
    const schema = ALL_TOOL_SCHEMAS[name];
    server.registerTool(name, {
      description: TOOL_DESCRIPTIONS[name],
      inputSchema: schema,
    }, wrapHandler(ctx, fn));
  }

  return server;
}
