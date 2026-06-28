#!/usr/bin/env node
// sprint-summary.mjs — SessionStart hook：注入当前 sprint 看板摘要
//
// 读取 docs/superpowers/sprints/*.json，找 active sprint，输出进度/进行中/阻塞。
// 零依赖（仅 Node 内置）；fail-open（任何错误都 exit 0，不阻塞会话）。
// 风格对齐 in-progress-summary.mjs。
//
// 也支持 `make sprint-status` 直接运行（TTY 彩色输出）。

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TTY = process.stdout.isTTY;
const C = TTY
  ? { G: '\x1b[0;32m', R: '\x1b[0;31m', Y: '\x1b[0;33m', C: '\x1b[0;36m', B: '\x1b[1m', DIM: '\x1b[2m', N: '\x1b[0m' }
  : { G: '', R: '', Y: '', C: '', B: '', DIM: '', N: '' };

const SPRINTS_DIR = join(process.cwd(), 'docs', 'superpowers', 'sprints');

function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function isTerminalStory(status) {
  return ['done', 'deferred'].includes(status);
}

function main() {
  if (!existsSync(SPRINTS_DIR)) {
    // 无 sprint 目录 = sprint MCP 未使用，静默退出
    return 0;
  }
  const files = readdirSync(SPRINTS_DIR).filter((f) => f.endsWith('.json') && f !== 'releases.json');
  if (files.length === 0) {
    if (TTY) console.log(`${C.DIM}（无 sprint）${C.N}`);
    return 0;
  }

  const sprints = files
    .map((f) => readJsonSafe(join(SPRINTS_DIR, f)))
    .filter(Boolean);

  // 优先 active，否则最近创建的
  const active = sprints.find((s) => s.status === 'active')
    ?? sprints.find((s) => s.status === 'planning')
    ?? null;

  if (!active) {
    const doneCount = sprints.filter((s) => s.status === 'completed').length;
    if (TTY) console.log(`${C.DIM}（${sprints.length} 个 sprint，${doneCount} 已完成，无进行中）${C.N}`);
    return 0;
  }

  const stories = active.stories ?? [];
  const total = stories.length;
  const done = stories.filter((s) => s.status === 'done').length;
  const inProg = stories.filter((s) => ['in_progress', 'review', 'testing'].includes(s.status));
  const blocked = stories.filter((s) => s.blockedReason);
  const totalPoints = stories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);
  const donePoints = stories.filter((s) => s.status === 'done').reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);

  const lines = [];
  const period = active.startDate && active.endDate ? `${active.startDate} ~ ${active.endDate}` : '未设周期';
  lines.push(`${C.B}📋 当前迭代${C.N}: ${C.C}${active.sprintId}${C.N}「${active.name}」(${period}) [${active.status}]`);
  if (active.goal) lines.push(`${C.DIM}目标: ${active.goal}${C.N}`);
  lines.push(`  进度: ${C.G}${done}/${total}${C.N} story done · 点数 ${donePoints}/${totalPoints} · ⛔阻塞 ${blocked.length}`);
  if (active.teamCapacity) {
    const utilization = totalPoints > 0 ? Math.round((totalPoints / active.teamCapacity) * 100) : 0;
    lines.push(`  容量: ${totalPoints}/${active.teamCapacity} 人天 (${utilization}% 利用率)`);
  }

  if (inProg.length > 0) {
    lines.push(`  ${C.Y}▶ 进行中${C.N}:`);
    for (const s of inProg.slice(0, 5)) {
      const pts = s.storyPoints ? ` ${s.storyPoints}pt` : '';
      const assignee = s.assignee ? ` @${s.assignee}` : '';
      const links = s.taskRefs?.length ? ` 🔗${s.taskRefs.length}` : '';
      lines.push(`    • ${s.storyId} ${s.title} (${s.status}${pts}${assignee}${links})`);
    }
    if (inProg.length > 5) lines.push(`    …还有 ${inProg.length - 5} 项`);
  }

  if (blocked.length > 0) {
    lines.push(`  ${C.R}⛔ 阻塞${C.N}:`);
    for (const s of blocked.slice(0, 3)) {
      lines.push(`    • ${s.storyId} ${s.title} — ${s.blockedReason}`);
    }
  }

  console.log(lines.join('\n'));
  return 0;
}

try {
  process.exit(main());
} catch (e) {
  // fail-open：绝不阻塞会话启动
  if (TTY) console.error(`[sprint-summary] ${e.message}`);
  process.exit(0);
}
