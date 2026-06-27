import { describe, it, expect, beforeEach } from 'vitest';
import { makeTempRoot } from './setup.js';
import {
  createSprint,
  getSprint,
  listSprints,
  getCurrentSprint,
  transitionSprint,
  updateSprint,
  isValidTransition,
} from '../src/store/sprint-store.js';
import {
  createStory,
  updateStory,
  moveStory,
  deleteStory,
  listStories,
  addToSprint,
  addDependency,
  wouldCreateCycle,
  isStoryReady,
  isValidStoryTransition,
  addComment,
} from '../src/store/story-store.js';
import { createEpic, addAcceptanceCriterion, epicReadiness } from '../src/store/epic-store.js';

let root: string;

beforeEach(() => {
  root = makeTempRoot();
});

describe('sprint-store', () => {
  it('创建并读取 sprint', async () => {
    const s = await createSprint(root, 'S-2026-07-W1', { name: '7月W1', goal: '发布闭环' });
    expect(s.sprintId).toBe('S-2026-07-W1');
    expect(s.status).toBe('planning');
    expect(s.stories).toEqual([]);
    const read = await getSprint(root, 'S-2026-07-W1');
    expect(read?.name).toBe('7月W1');
  });

  it('重复创建抛错', async () => {
    await createSprint(root, 'S-1', { name: 'a' });
    await expect(createSprint(root, 'S-1', { name: 'b' })).rejects.toThrow('已存在');
  });

  it('状态流转 planning→active→completed 合法', async () => {
    await createSprint(root, 'S-1', { name: 'a' });
    await transitionSprint(root, 'S-1', 'active');
    expect((await getSprint(root, 'S-1'))?.status).toBe('active');
    expect((await getSprint(root, 'S-1'))?.startedAt).toBeTruthy();
    await transitionSprint(root, 'S-1', 'completed');
    expect((await getSprint(root, 'S-1'))?.status).toBe('completed');
    expect((await getSprint(root, 'S-1'))?.completedAt).toBeTruthy();
  });

  it('非法流转 planning→completed 抛错', async () => {
    await createSprint(root, 'S-1', { name: 'a' });
    await expect(transitionSprint(root, 'S-1', 'completed')).rejects.toThrow('非法状态流转');
  });

  it('isValidTransition 边界', () => {
    expect(isValidTransition('planning', 'active')).toBe(true);
    expect(isValidTransition('completed', 'active')).toBe(false);
    expect(isValidTransition('cancelled', 'active')).toBe(false);
  });

  it('listSprints 列出摘要', async () => {
    await createSprint(root, 'S-1', { name: 'a' });
    await createSprint(root, 'S-2', { name: 'b' });
    const list = await listSprints(root);
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.sprintId).sort()).toEqual(['S-1', 'S-2']);
  });

  it('getCurrentSprint 返回 active 的', async () => {
    await createSprint(root, 'S-1', { name: 'a' });
    await createSprint(root, 'S-2', { name: 'b' });
    expect(await getCurrentSprint(root)).toBeNull();
    await transitionSprint(root, 'S-1', 'active');
    const cur = await getCurrentSprint(root);
    expect(cur?.sprintId).toBe('S-1');
  });

  it('updateSprint 改字段并记 activity', async () => {
    await createSprint(root, 'S-1', { name: 'a' });
    await updateSprint(root, 'S-1', { goal: '新目标', teamCapacity: 40 });
    const s = await getSprint(root, 'S-1');
    expect(s?.goal).toBe('新目标');
    expect(s?.teamCapacity).toBe(40);
    expect(s?.activityLog.some((a) => a.action === 'sprint.updated')).toBe(true);
  });
});

describe('story-store', () => {
  beforeEach(async () => {
    await createSprint(root, 'S-1', { name: 'a' });
  });

  it('创建 story 自动编号 ST-001/ST-002', async () => {
    const s1 = await createStory(root, 'S-1', { title: 't1', storyPoints: 5 });
    const s2 = await createStory(root, 'S-1', { title: 't2', storyPoints: 3 });
    expect(s1.storyId).toBe('ST-001');
    expect(s2.storyId).toBe('ST-002');
  });

  it('非法 storyPoints 抛错', async () => {
    await expect(createStory(root, 'S-1', { title: 't', storyPoints: 4 as never })).rejects.toThrow('Fibonacci');
    await expect(createStory(root, 'S-1', { title: 't', storyPoints: 99 as never })).rejects.toThrow('Fibonacci');
  });

  it('move 合法流转 todo→in_progress→done', async () => {
    const s = await createStory(root, 'S-1', { title: 't', storyPoints: 1, status: 'todo' });
    await moveStory(root, 'S-1', s.storyId, 'in_progress');
    await moveStory(root, 'S-1', s.storyId, 'done');
    const list = await listStories(root, 'S-1');
    expect(list[0].status).toBe('done');
  });

  it('非法流转 todo→review 抛错（需先 in_progress）', async () => {
    const s = await createStory(root, 'S-1', { title: 't', storyPoints: 1, status: 'todo' });
    await expect(moveStory(root, 'S-1', s.storyId, 'review')).rejects.toThrow('非法');
  });

  it('isValidStoryTransition 同状态合法', () => {
    expect(isValidStoryTransition('todo', 'todo')).toBe(true);
  });

  it('updateStory 改字段', async () => {
    const s = await createStory(root, 'S-1', { title: 't', storyPoints: 1 });
    await updateStory(root, 'S-1', s.storyId, { title: '新标题', assignee: 'alice' });
    const list = await listStories(root, 'S-1');
    expect(list[0].title).toBe('新标题');
    expect(list[0].assignee).toBe('alice');
  });

  it('deleteStory 清理依赖与 epic 引用', async () => {
    await createEpic(root, 'S-1', { title: 'E1' });
    const s1 = await createStory(root, 'S-1', { title: 't1', storyPoints: 1, epicId: 'E1' });
    const s2 = await createStory(root, 'S-1', { title: 't2', storyPoints: 1 });
    await addDependency(root, 'S-1', s2.storyId, s1.storyId);
    await deleteStory(root, 'S-1', s1.storyId);
    const sprint = await getSprint(root, 'S-1');
    expect(sprint?.stories.find((s) => s.storyId === s1.storyId)).toBeUndefined();
    expect(sprint?.dependencies).toHaveLength(0);
  });

  it('addToSprint backlog→todo', async () => {
    const s = await createStory(root, 'S-1', { title: 't', storyPoints: 1 }); // 默认 backlog
    await addToSprint(root, 'S-1', s.storyId);
    const list = await listStories(root, 'S-1');
    expect(list[0].status).toBe('todo');
  });

  it('addDependency 环检测拒绝', async () => {
    const s1 = await createStory(root, 'S-1', { title: 't1', storyPoints: 1 });
    const s2 = await createStory(root, 'S-1', { title: 't2', storyPoints: 1 });
    await addDependency(root, 'S-1', s1.storyId, s2.storyId); // s1 依赖 s2
    // 反向加 s2 依赖 s1 → 环
    await expect(addDependency(root, 'S-1', s2.storyId, s1.storyId)).rejects.toThrow('环');
  });

  it('wouldCreateCycle 直链', async () => {
    const s1 = await createStory(root, 'S-1', { title: 't1', storyPoints: 1 });
    const s2 = await createStory(root, 'S-1', { title: 't2', storyPoints: 1 });
    await addDependency(root, 'S-1', s1.storyId, s2.storyId);
    const sprint = await getSprint(root, 'S-1');
    expect(wouldCreateCycle(sprint!, s2.storyId, s1.storyId)).toBe(true);
    expect(wouldCreateCycle(sprint!, s1.storyId, s2.storyId)).toBe(false); // 已存在
  });

  it('isStoryReady 依赖完成才就绪', async () => {
    const s1 = await createStory(root, 'S-1', { title: 't1', storyPoints: 1, status: 'todo' });
    const s2 = await createStory(root, 'S-1', { title: 't2', storyPoints: 1, status: 'todo' });
    await addDependency(root, 'S-1', s2.storyId, s1.storyId);
    let sprint = await getSprint(root, 'S-1');
    expect(isStoryReady(sprint!, sprint!.stories.find((s) => s.storyId === s2.storyId)!)).toBe(false);
    await moveStory(root, 'S-1', s1.storyId, 'done');
    sprint = await getSprint(root, 'S-1');
    expect(isStoryReady(sprint!, sprint!.stories.find((s) => s.storyId === s2.storyId)!)).toBe(true);
  });

  it('addComment 关联 story', async () => {
    const s = await createStory(root, 'S-1', { title: 't', storyPoints: 1 });
    const c = await addComment(root, 'S-1', s.storyId, '备注', 'bob');
    expect(c.storyId).toBe(s.storyId);
    const sprint = await getSprint(root, 'S-1');
    expect(sprint?.comments).toHaveLength(1);
  });
});

describe('epic-store', () => {
  beforeEach(async () => {
    await createSprint(root, 'S-1', { name: 'a' });
  });

  it('创建 epic + 验收标准 + 就绪度', async () => {
    const e = await createEpic(root, 'S-1', { title: '发布闭环', journeyRef: 'J-publish' });
    expect(e.epicId).toMatch(/^E-/);
    await addAcceptanceCriterion(root, 'S-1', e.epicId, 'API 可发布', 'ready');
    await addAcceptanceCriterion(root, 'S-1', e.epicId, 'UI 完整', 'not_ready');
    await addAcceptanceCriterion(root, 'S-1', e.epicId, 'E2E 覆盖', 'needs_info');
    const sprint = await getSprint(root, 'S-1');
    const r = epicReadiness(sprint!, e.epicId);
    expect(r).toEqual({ ready: 1, needsInfo: 1, notReady: 1, total: 3 });
  });
});
