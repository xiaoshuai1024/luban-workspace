#!/usr/bin/env node
// SessionStart hook: 注入"进行中工作"摘要到会话上下文
//
// 数据源（SSOT）: docs/superpowers/tasks/*.json（对齐 .agents/rules/luban-task-graph-ssot.md）
// 输出: stdout → 被 SessionStart hook 注入到会话上下文
//
// 筛选规则:
//   - 顶层 status ∈ 终态 {done, completed, cancelled, archived, abandoned, shipped} → 整个跳过
//   - 否则纳入，按 task 级状态分组:
//       in_progress / blocked      → 「进行中 / 阻塞」(用户最该先看的)
//       pending / todo             → 「待办」(下一批)
//   - 每个任务图最多展示 5 条待办（避免刷屏），其余计数

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const TASKS_DIR = join(process.cwd(), 'docs/superpowers/tasks');
const TOP_DONE = new Set(['done', 'completed', 'cancelled', 'archived', 'abandoned', 'shipped']);
const TASK_DONE = new Set(['done', 'completed', 'deferred', 'cancelled', 'skipped']);
const TASK_TODO = new Set(['pending', 'todo']);
const TASK_ACTIVE = new Set(['in_progress', 'in-progress', 'blocked', 'review', 'testing']);

async function loadGraphs() {
  let files;
  try {
    files = (await readdir(TASKS_DIR)).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(await readFile(join(TASKS_DIR, f), 'utf8'));
      out.push(raw);
    } catch (e) {
      // 单个坏文件不阻断整个 hook
      process.stderr.write(`[in-progress-summary] skip ${f}: ${e.message}\n`);
    }
  }
  return out;
}

function bucket(taskStatus) {
  if (TASK_ACTIVE.has(taskStatus)) return 'active';
  if (TASK_TODO.has(taskStatus)) return 'todo';
  if (TASK_DONE.has(taskStatus)) return 'done';
  return 'todo'; // 未知状态当待办，宁多勿漏
}

function summarize() {
  return loadGraphs().then(graphs => {
    // 只保留「确实有非终态任务」的图。空的 program/strategy 容器（tasks:[]）
    // 或全 done 的历史图，对会话上下文都是噪音，一律不展示。
    const candidates = graphs.filter(g => {
      if (TOP_DONE.has(g.status)) return false;
      const tasks = g.tasks || [];
      const hasOpenWork = tasks.some(t => !TASK_DONE.has(t.status));
      return hasOpenWork;
    });
    if (candidates.length === 0) {
      console.log('## 进行中工作\n\n_无进行中的任务图（所有 docs/superpowers/tasks/*.json 均为终态或空容器）。_');
      return;
    }

    console.log('## 进行中工作（自动注入，SSOT: docs/superpowers/tasks/*.json）\n');
    console.log('> 以下为本会话开工前真实未完成的工作。开工时优先关注「进行中/阻塞」。');
    console.log('> 继续某项任务请用 `/jx`；状态更新须改对应 task 图 JSON。\n');

    // 先进行中，后待办；同组内按 featureId 排序
    candidates.sort((a, b) => {
      const aActive = a.tasks?.some(t => TASK_ACTIVE.has(t.status)) ? 0 : 1;
      const bActive = b.tasks?.some(t => TASK_ACTIVE.has(t.status)) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (a.featureId || '').localeCompare(b.featureId || '');
    });

    for (const g of candidates) {
      const tasks = g.tasks || [];
      const active = tasks.filter(t => TASK_ACTIVE.has(t.status));
      const todo = tasks.filter(t => TASK_TODO.has(t.status) || (!TASK_ACTIVE.has(t.status) && !TASK_DONE.has(t.status)));
      const done = tasks.filter(t => TASK_DONE.has(t.status));

      // 彻底没动静的纯 draft/pending 大任务图也展示，但只给计数
      console.log(`### ${g.featureId || '(无 featureId)'} — ${g.title || ''}`);
      console.log(`顶层状态: \`${g.status || '?'}\` · 任务: ${done.length} done / ${active.length} active / ${todo.length} todo`);

      if (active.length) {
        console.log(`\n**进行中 / 阻塞（${active.length}）:**`);
        for (const t of active) {
          const mark = t.status === 'blocked' ? '⛔' : '▶';
          const reason = t.blockedReason ? ` — ${t.blockedReason}` : '';
          console.log(`- ${mark} \`${t.id}\` ${t.title || ''} [${t.status}]${reason}`);
        }
      }

      if (todo.length) {
        const shown = todo.slice(0, 5);
        console.log(`\n**待办（${todo.length}）:**`);
        for (const t of shown) {
          const pri = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '⚪';
          console.log(`- ${pri} \`${t.id}\` ${t.title || ''}`);
        }
        if (todo.length > shown.length) {
          console.log(`- …还有 ${todo.length - shown.length} 条`);
        }
      }
      console.log('');
    }
  });
}

summarize().catch(e => {
  // fail open: hook 报错不应阻断会话启动
  process.stderr.write(`[in-progress-summary] failed: ${e.message}\n`);
  process.exit(0);
});
