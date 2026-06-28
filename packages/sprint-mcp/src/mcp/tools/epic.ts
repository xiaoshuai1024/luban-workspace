/**
 * Tool 实现：Epic + 验收标准（9-10）。
 */

import {
  createEpic,
  updateEpic,
  deleteEpic,
  addAcceptanceCriterion,
  updateCriterionStatus,
  epicReadiness,
} from '../../store/epic-store.js';
import { getSprint, findEpic } from '../../store/sprint-store.js';
import type { ToolContext } from './sprint.js';

// ── Tool 9: epic_manager ────────────────────────────────────
export async function epicManager(ctx: ToolContext, args: {
  action: 'create' | 'update' | 'get' | 'list' | 'delete';
  sprintId: string;
  epicId?: string;
  title?: string;
  description?: string;
  status?: 'planned' | 'in_progress' | 'done' | 'cancelled';
}): Promise<unknown> {
  const { root } = ctx;
  switch (args.action) {
    case 'create': {
      if (!args.title) throw new Error('create 需要 title');
      const e = await createEpic(root, args.sprintId, { title: args.title, description: args.description });
      return { ok: true, epic: e };
    }
    case 'update': {
      const e = await updateEpic(root, args.sprintId, args.epicId!, {
        title: args.title, description: args.description, status: args.status,
      });
      return { ok: true, epic: e };
    }
    case 'get': {
      const sprint = await getSprint(root, args.sprintId);
      const epic = findEpic(sprint!, args.epicId!);
      if (!epic) throw new Error(`Epic 不存在: ${args.epicId}`);
      return { epic, readiness: epicReadiness(sprint!, args.epicId!) };
    }
    case 'list': {
      const sprint = await getSprint(root, args.sprintId);
      return { epics: sprint?.epics ?? [] };
    }
    case 'delete': {
      await deleteEpic(root, args.sprintId, args.epicId!);
      return { ok: true };
    }
  }
}

// ── Tool 10: acceptance_criteria ────────────────────────────
export async function acceptanceCriteria(ctx: ToolContext, args: {
  action: 'add' | 'update_status' | 'verify' | 'list';
  sprintId: string;
  epicId: string;
  criterionId?: string;
  text?: string;
  status?: 'ready' | 'needs_info' | 'not_ready';
}): Promise<unknown> {
  const { root } = ctx;
  switch (args.action) {
    case 'add': {
      if (!args.text) throw new Error('add 需要 text');
      const ac = await addAcceptanceCriterion(root, args.sprintId, args.epicId, args.text, args.status);
      return { ok: true, criterion: ac };
    }
    case 'update_status': {
      const ac = await updateCriterionStatus(root, args.sprintId, args.epicId, args.criterionId!, args.status!);
      return { ok: true, criterion: ac };
    }
    case 'verify': {
      // verify = 标记为 ready
      const ac = await updateCriterionStatus(root, args.sprintId, args.epicId, args.criterionId!, 'ready');
      return { ok: true, criterion: ac };
    }
    case 'list': {
      const sprint = await getSprint(root, args.sprintId);
      const epic = findEpic(sprint!, args.epicId);
      return { criteria: epic?.acceptanceCriteria ?? [], readiness: epicReadiness(sprint!, args.epicId) };
    }
  }
}
