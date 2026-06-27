/**
 * 燃尽图计算 — 理想线 vs 实际线。
 *
 * 理想线：从 totalPoints 线性下降到 0（按 sprint 天数均分）。
 * 实际线：基于 activityLog 中 story.moved 到 done 的时间点，累计已完成 storyPoints。
 */

import type { Sprint, BurndownData, BurndownPoint, VelocityData, SprintMetrics, ReadinessData } from '../types.js';

/** 计算两个日期间的天数（含首尾） */
function daySpan(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const ms = e.getTime() - s.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

function dateKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function dayKeyAt(start: string, offsetDays: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + offsetDays);
  return dateKey(d.toISOString());
}

/** 计算燃尽数据 */
export function computeBurndown(sprint: Sprint): BurndownData {
  const totalPoints = sprint.stories.reduce((sum, s) => sum + s.storyPoints, 0);
  const start = sprint.startDate;
  const end = sprint.endDate;

  const points: BurndownPoint[] = [];

  if (!start || !end) {
    // 无日期：仅返回当前快照
    const donePoints = sprint.stories
      .filter((s) => s.status === 'done')
      .reduce((sum, s) => sum + s.storyPoints, 0);
    return {
      sprintId: sprint.sprintId,
      teamCapacity: sprint.teamCapacity,
      totalPoints,
      points: [{ date: dateKey(new Date().toISOString()), ideal: 0, actual: totalPoints - donePoints }],
      status: 'on_track',
    };
  }

  const days = daySpan(start, end);
  const doneByDate = new Map<string, number>(); // date → 累计完成点数

  // 从 activityLog 提取 done 时间线
  for (const entry of sprint.activityLog) {
    if (entry.action === 'story.moved' && entry.to === 'done' && entry.storyId) {
      const story = sprint.stories.find((s) => s.storyId === entry.storyId);
      if (story) {
        const dk = dateKey(entry.at);
        doneByDate.set(dk, (doneByDate.get(dk) ?? 0) + story.storyPoints);
      }
    }
  }

  // 累计求和
  const cumulativeDone = new Map<string, number>();
  let acc = 0;
  for (let i = 0; i < days; i++) {
    const dk = dayKeyAt(start, i);
    acc += doneByDate.get(dk) ?? 0;
    cumulativeDone.set(dk, acc);
  }

  // 今天的位置
  const todayKey = dateKey(new Date().toISOString());
  let todayOffset = -1;
  for (let i = 0; i < days; i++) {
    if (dayKeyAt(start, i) === todayKey) {
      todayOffset = i;
      break;
    }
  }

  // 生成点（只到今天或 sprint 结束，取较小）
  const upto = todayOffset >= 0 ? Math.min(todayOffset, days - 1) : days - 1;
  for (let i = 0; i <= upto; i++) {
    const dk = dayKeyAt(start, i);
    const ideal = Math.round(((days - 1 - i) / (days - 1)) * totalPoints * 10) / 10;
    const done = cumulativeDone.get(dk) ?? 0;
    const actual = Math.round((totalPoints - done) * 10) / 10;
    points.push({ date: dk, ideal, actual });
  }

  // 状态判定：今天实际剩余 vs 理想剩余
  let status: BurndownData['status'] = 'on_track';
  if (todayOffset >= 0 && points.length > 0) {
    const today = points[points.length - 1];
    const actual = today.actual ?? 0;
    const ratio = today.ideal === 0 ? (actual > 0 ? 2 : 1) : actual / today.ideal;
    if (ratio > 1.2) status = 'behind';
    else if (ratio > 1.0) status = 'at_risk';
  }

  return {
    sprintId: sprint.sprintId,
    teamCapacity: sprint.teamCapacity,
    startDate: start,
    endDate: end,
    totalPoints,
    points,
    status,
  };
}

/** 计算速率 */
export function computeVelocity(sprint: Sprint): VelocityData {
  const plannedPoints = sprint.stories.reduce((sum, s) => sum + s.storyPoints, 0);
  const completedPoints = sprint.stories
    .filter((s) => s.status === 'done')
    .reduce((sum, s) => sum + s.storyPoints, 0);
  const completionRate = plannedPoints > 0 ? Math.round((completedPoints / plannedPoints) * 100) : 0;
  const capacity = sprint.teamCapacity;
  const utilization = capacity && capacity > 0 ? Math.round((plannedPoints / capacity) * 100) : 0;
  return { sprintId: sprint.sprintId, plannedPoints, completedPoints, completionRate, capacity, utilization };
}

/** 计算就绪度（基于验收标准）*/
export function computeReadiness(sprint: Sprint): ReadinessData {
  let ready = 0, needsInfo = 0, notReady = 0, blocked = 0;
  for (const e of sprint.epics) {
    for (const ac of e.acceptanceCriteria) {
      if (ac.status === 'ready') ready++;
      else if (ac.status === 'needs_info') needsInfo++;
      else notReady++;
    }
  }
  for (const s of sprint.stories) {
    if (s.status === 'in_progress' && s.blockedReason) blocked++;
  }
  return { ready, needsInfo, notReady, blocked, total: ready + needsInfo + notReady };
}

/** 计算 sprint 指标汇总 */
export function computeMetrics(sprint: Sprint): SprintMetrics {
  const totalStories = sprint.stories.length;
  const doneStories = sprint.stories.filter((s) => s.status === 'done').length;
  const inProgressStories = sprint.stories.filter((s) =>
    ['in_progress', 'review', 'testing'].includes(s.status),
  ).length;
  const blockedStories = sprint.stories.filter((s) => s.blockedReason).length;
  const totalPoints = sprint.stories.reduce((sum, s) => sum + s.storyPoints, 0);
  const donePoints = sprint.stories.filter((s) => s.status === 'done').reduce((sum, s) => sum + s.storyPoints, 0);
  return {
    sprintId: sprint.sprintId,
    totalStories,
    doneStories,
    inProgressStories,
    blockedStories,
    totalPoints,
    donePoints,
    velocity: computeVelocity(sprint),
    burndown: computeBurndown(sprint),
    readiness: computeReadiness(sprint),
  };
}
