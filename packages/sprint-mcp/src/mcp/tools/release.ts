/**
 * Tool 实现：Release 管理（11-12）。
 */

import {
  createRelease,
  getRelease,
  listReleases,
  updateRelease,
  attachSprint,
  releaseIt,
} from '../../store/release-store.js';
import { getSprint } from '../../store/sprint-store.js';
import { storiesToMarkdown } from '../../util/board.js';
import type { ToolContext } from './sprint.js';

// ── Tool 11: release_manager ────────────────────────────────
export async function releaseManager(ctx: ToolContext, args: {
  action: 'create' | 'update' | 'get' | 'list' | 'attach_sprint' | 'release';
  releaseId?: string;
  name?: string; version?: string; releaseDate?: string; notes?: string;
  status?: 'planned' | 'in_progress' | 'released' | 'rolled_back';
  sprintId?: string;
}): Promise<unknown> {
  const { root } = ctx;
  switch (args.action) {
    case 'create': {
      if (!args.releaseId || !args.name) throw new Error('create 需要 releaseId 和 name');
      const r = await createRelease(root, args.releaseId, {
        name: args.name, version: args.version, releaseDate: args.releaseDate, notes: args.notes,
      });
      return { ok: true, release: r };
    }
    case 'update': {
      const r = await updateRelease(root, args.releaseId!, {
        name: args.name, version: args.version, status: args.status, releaseDate: args.releaseDate, notes: args.notes,
      });
      return { ok: true, release: r };
    }
    case 'get': {
      const r = await getRelease(root, args.releaseId!);
      if (!r) throw new Error(`Release 不存在: ${args.releaseId}`);
      return { release: r };
    }
    case 'list': {
      return { releases: await listReleases(root) };
    }
    case 'attach_sprint': {
      const r = await attachSprint(root, args.releaseId!, args.sprintId!);
      return { ok: true, release: r };
    }
    case 'release': {
      const r = await releaseIt(root, args.releaseId!);
      return { ok: true, release: r };
    }
  }
}

// ── Tool 12: release_notes ──────────────────────────────────
export async function releaseNotes(ctx: ToolContext, args: {
  action: 'generate';
  releaseId: string;
}): Promise<unknown> {
  const release = await getRelease(ctx.root, args.releaseId);
  if (!release) throw new Error(`Release 不存在: ${args.releaseId}`);
  const sections: string[] = [];
  sections.push(`# Release Notes — ${release.name}${release.version ? ` (${release.version})` : ''}\n`);
  if (release.releaseDate) sections.push(`**发布日期:** ${release.releaseDate}\n`);

  for (const sid of release.sprintIds) {
    const sprint = await getSprint(ctx.root, sid);
    if (!sprint) continue;
    sections.push(`## Sprint: ${sprint.name}\n`);
    if (sprint.goal) sections.push(`> 目标: ${sprint.goal}\n`);
    const doneStories = sprint.stories.filter((s) => s.status === 'done');
    if (doneStories.length === 0) {
      sections.push('_无已完成 story_\n');
      continue;
    }
    sections.push(storiesToMarkdown(doneStories));
    const points = doneStories.reduce((sum, s) => sum + s.storyPoints, 0);
    sections.push(`\n**交付点数:** ${points} · **故事数:** ${doneStories.length}\n`);
  }

  const notes = sections.join('\n');
  // 写回 release.notes
  await updateRelease(ctx.root, args.releaseId, { notes });
  return { ok: true, releaseId: args.releaseId, notes };
}
