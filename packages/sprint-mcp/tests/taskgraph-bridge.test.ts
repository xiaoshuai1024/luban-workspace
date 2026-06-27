import { describe, it, expect, beforeEach } from 'vitest';
import { makeTempRoot, seedTaskGraph } from './setup.js';
import {
  readTaskGraph,
  writeTaskGraph,
  setTaskSprintId,
  clearSprintRefs,
  getTaskStatus,
  setTaskStatus,
  storyStatusFromTaskStatus,
  taskStatusFromStoryStatus,
} from '../src/store/taskgraph-bridge.js';
import { createSprint, getSprint } from '../src/store/sprint-store.js';
import { createStory, moveStory } from '../src/store/story-store.js';

let root: string;

beforeEach(() => {
  root = makeTempRoot();
  seedTaskGraph(root, 'publish-loop-p0', {
    featureId: 'publish-loop-p0',
    title: '发布闭环',
    status: 'draft',
    journeys: [{ id: 'J-publish', ref: true }],
    tasks: [
      { id: 'T1', title: 'Flyway 迁移', status: 'pending', group: 'backend-java', dependsOn: [] },
      { id: 'T2', title: 'Java Entity', status: 'pending', group: 'backend-java', dependsOn: ['T1'] },
      { id: 'T3', title: 'BFF 透传', status: 'pending', group: 'bff', dependsOn: ['T1'] },
    ],
  });
});

describe('taskgraph-bridge 读取', () => {
  it('读取 tasks[] 形状', async () => {
    const doc = await readTaskGraph(root, 'publish-loop-p0');
    expect(doc).not.toBeNull();
    expect(doc!.featureId).toBe('publish-loop-p0');
    expect(doc!.tasks).toHaveLength(3);
    expect(doc!.tasksKey).toBe('tasks');
    expect(doc!.tasks[0].id).toBe('T1');
    expect(doc!.tasks[0].group).toBe('backend-java');
  });

  it('children[] 形状 fallback', async () => {
    seedTaskGraph(root, 'prog-1', {
      featureId: 'prog-1',
      title: '程序',
      children: [
        { id: 'C1', title: '子1', status: 'pending' },
        { id: 'C2', title: '子2', status: 'done' },
      ],
    });
    const doc = await readTaskGraph(root, 'prog-1');
    expect(doc!.tasksKey).toBe('children');
    expect(doc!.tasks).toHaveLength(2);
    expect(doc!.tasks[1].status).toBe('done');
  });

  it('journeys ref 引用读取', async () => {
    const doc = await readTaskGraph(root, 'publish-loop-p0');
    expect(doc!.journeys[0].id).toBe('J-publish');
    expect(doc!.journeys[0].ref).toBe(true);
  });

  it('不存在的 feature 返回 null', async () => {
    expect(await readTaskGraph(root, 'nope')).toBeNull();
  });
});

describe('taskgraph-bridge 写回', () => {
  it('setTaskSprintId 加反向指针且不破坏其他字段', async () => {
    await setTaskSprintId(root, 'publish-loop-p0', 'T1', 'S-1');
    const doc = await readTaskGraph(root, 'publish-loop-p0');
    expect(doc!.tasks.find((t) => t.id === 'T1')?.sprintId).toBe('S-1');
    // 其他字段保留
    expect(doc!.tasks.find((t) => t.id === 'T1')?.group).toBe('backend-java');
    expect(doc!.tasks.find((t) => t.id === 'T2')?.sprintId).toBeNull();
    // 顶层字段保留
    expect(doc!.raw.status).toBe('draft');
    expect(doc!.raw.journeys).toHaveLength(1);
  });

  it('setTaskSprintId null 清除指针', async () => {
    await setTaskSprintId(root, 'publish-loop-p0', 'T1', 'S-1');
    await setTaskSprintId(root, 'publish-loop-p0', 'T1', null);
    const doc = await readTaskGraph(root, 'publish-loop-p0');
    expect(doc!.tasks.find((t) => t.id === 'T1')?.sprintId).toBeNull();
  });

  it('clearSprintRefs 跨文件清理', async () => {
    seedTaskGraph(root, 'feat-2', {
      featureId: 'feat-2',
      title: 'f2',
      tasks: [{ id: 'X1', title: 'x', status: 'pending', sprintId: 'S-1' }],
    });
    await setTaskSprintId(root, 'publish-loop-p0', 'T1', 'S-1');
    const res = await clearSprintRefs(root, 'S-1');
    expect(res.cleared).toBe(2);
    expect(res.files.sort()).toEqual(['feat-2', 'publish-loop-p0']);
  });

  it('getTaskStatus / setTaskStatus', async () => {
    expect(await getTaskStatus(root, { featureId: 'publish-loop-p0', taskId: 'T1' })).toBe('pending');
    await setTaskStatus(root, { featureId: 'publish-loop-p0', taskId: 'T1' }, 'done');
    expect(await getTaskStatus(root, { featureId: 'publish-loop-p0', taskId: 'T1' })).toBe('done');
  });
});

describe('status 映射', () => {
  it('task → story', () => {
    expect(storyStatusFromTaskStatus('pending')).toBe('todo');
    expect(storyStatusFromTaskStatus('todo')).toBe('todo');
    expect(storyStatusFromTaskStatus('in_progress')).toBe('in_progress');
    expect(storyStatusFromTaskStatus('done')).toBe('done');
    expect(storyStatusFromTaskStatus('completed')).toBe('done');
    expect(storyStatusFromTaskStatus('deferred')).toBe('done');
    expect(storyStatusFromTaskStatus('blocked')).toBe('in_progress');
  });

  it('story → task', () => {
    expect(taskStatusFromStoryStatus('todo')).toBe('pending');
    expect(taskStatusFromStoryStatus('in_progress')).toBe('in_progress');
    expect(taskStatusFromStoryStatus('done')).toBe('done');
    expect(taskStatusFromStoryStatus('deferred')).toBe('deferred');
  });
});

describe('联动闭环：import → move → sync', () => {
  it('story done 时 taskRefs 同步到 done', async () => {
    // 建 sprint + story（手动模拟 import）
    await createSprint(root, 'S-1', { name: 'a' });
    const story = await createStory(root, 'S-1', {
      title: '迁移',
      storyPoints: 5,
      status: 'todo',
      taskRefs: [{ featureId: 'publish-loop-p0', taskId: 'T1', subsystem: 'backend-java' }],
    });
    // 反向指针
    await setTaskSprintId(root, 'publish-loop-p0', 'T1', 'S-1');

    // move story 到 done
    await moveStory(root, 'S-1', story.storyId, 'done');

    // task 状态应仍是 pending（MCP 不自动 push，除非显式调用 sync tool）
    expect(await getTaskStatus(root, { featureId: 'publish-loop-p0', taskId: 'T1' })).toBe('pending');
  });
});
