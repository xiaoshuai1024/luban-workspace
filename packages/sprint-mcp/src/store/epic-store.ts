/**
 * Epic Store — Epic（史诗）+ 验收标准 CRUD。
 * Epic 内嵌在 sprint JSON 的 epics[]。
 */

import { mutateSprint, findEpic } from './sprint-store.js';
import { recordActivity } from './activity-log.js';
import type { Sprint, Epic, EpicStatus, AcceptanceCriterion, AcceptanceStatus } from '../types.js';

const NOW = () => new Date().toISOString();

let criterionCounter = 0;
function genCriterionId(): string {
  criterionCounter += 1;
  return `AC-${Date.now()}-${criterionCounter}`;
}

export async function createEpic(
  root: string,
  sprintId: string,
  fields: { title: string; description?: string; journeyRef?: string },
  actor: string = 'agent',
): Promise<Epic> {
  let created!: Epic;
  await mutateSprint(root, sprintId, (s) => {
    const epicId = `E-${Date.now().toString(36)}`;
    created = {
      epicId,
      title: fields.title,
      description: fields.description,
      acceptanceCriteria: [],
      storyIds: [],
      status: 'planned',
      journeyRef: fields.journeyRef,
      createdAt: NOW(),
    };
    s.epics.push(created);
    recordActivity(s, { actor, action: 'epic.created', detail: `${epicId} ${fields.title}` });
  });
  return created;
}

export async function updateEpic(
  root: string,
  sprintId: string,
  epicId: string,
  patch: Partial<Pick<Epic, 'title' | 'description' | 'status'>>,
  actor: string = 'agent',
): Promise<Epic> {
  let updated!: Epic;
  await mutateSprint(root, sprintId, (s) => {
    const epic = findEpic(s, epicId);
    if (!epic) throw new Error(`Epic 不存在: ${epicId}`);
    const changes: string[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) {
        (epic as unknown as Record<string, unknown>)[k] = v;
        changes.push(`${k}=${String(v)}`);
      }
    }
    updated = epic;
    recordActivity(s, { actor, action: 'epic.updated', detail: `${epicId}: ${changes.join(', ')}` });
  });
  return updated;
}

export async function deleteEpic(root: string, sprintId: string, epicId: string, actor: string = 'agent'): Promise<void> {
  await mutateSprint(root, sprintId, (s) => {
    const idx = s.epics.findIndex((e) => e.epicId === epicId);
    if (idx === -1) throw new Error(`Epic 不存在: ${epicId}`);
    s.epics.splice(idx, 1);
    // 清理 story.epicId 引用
    for (const st of s.stories) {
      if (st.epicId === epicId) st.epicId = null;
    }
    recordActivity(s, { actor, action: 'epic.deleted', detail: epicId });
  });
}

export async function addAcceptanceCriterion(
  root: string,
  sprintId: string,
  epicId: string,
  text: string,
  initialStatus: AcceptanceStatus = 'not_ready',
  actor: string = 'agent',
): Promise<AcceptanceCriterion> {
  let ac!: AcceptanceCriterion;
  await mutateSprint(root, sprintId, (s) => {
    const epic = findEpic(s, epicId);
    if (!epic) throw new Error(`Epic 不存在: ${epicId}`);
    ac = { id: genCriterionId(), text, status: initialStatus };
    epic.acceptanceCriteria.push(ac);
    recordActivity(s, { actor, action: 'criteria.added', detail: `${epicId}/${ac.id}` });
  });
  return ac;
}

export async function updateCriterionStatus(
  root: string,
  sprintId: string,
  epicId: string,
  criterionId: string,
  status: AcceptanceStatus,
  actor: string = 'agent',
): Promise<AcceptanceCriterion> {
  let ac!: AcceptanceCriterion;
  await mutateSprint(root, sprintId, (s) => {
    const epic = findEpic(s, epicId);
    if (!epic) throw new Error(`Epic 不存在: ${epicId}`);
    const found = epic.acceptanceCriteria.find((c) => c.id === criterionId);
    if (!found) throw new Error(`验收标准不存在: ${criterionId}`);
    const from = found.status;
    found.status = status;
    ac = found;
    recordActivity(s, { actor, action: 'criteria.status_changed', from, to: status, detail: `${epicId}/${criterionId}` });
  });
  return ac;
}

/** epic 的验收就绪度统计 */
export function epicReadiness(sprint: Sprint, epicId: string): { ready: number; needsInfo: number; notReady: number; total: number } {
  const epic = findEpic(sprint, epicId);
  if (!epic) return { ready: 0, needsInfo: 0, notReady: 0, total: 0 };
  const counts = { ready: 0, needsInfo: 0, notReady: 0, total: epic.acceptanceCriteria.length };
  for (const ac of epic.acceptanceCriteria) {
    if (ac.status === 'ready') counts.ready++;
    else if (ac.status === 'needs_info') counts.needsInfo++;
    else counts.notReady++;
  }
  return counts;
}

export type { Sprint };
