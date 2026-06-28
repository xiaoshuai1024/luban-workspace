#!/usr/bin/env node
// verify-plan-ssot.mjs — taskGraph JSON SSOT 校验 + 旅程覆盖率度量
//
// 用法:
//   node scripts/verify-plan-ssot.mjs validate <path-to-json>   # 校验单个 JSON schema
//   node scripts/verify-plan-ssot.mjs journey-coverage          # 聚合旅程总盘 + 扫 spec 标签 → 覆盖率矩阵
//
// 零依赖:仅用 Node 内置 fs / path。
// 详见 docs/dev/ssot-task-graph.md「旅程覆盖」节。

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const TASKS_DIR = 'docs/superpowers/tasks';
const VALID_SUBSYSTEMS = ['engine', 'bff', 'ui', 'web', 'backend-java', 'client', 'cross'];
const VALID_ENTRY_SUBSYSTEMS = ['engine', 'website', 'workspace'];
const VALID_PRIORITIES = ['P0', 'P1', 'P2'];

// ── 颜色(非 TTY 自动降级) ──────────────────────────────
const TTY = process.stdout.isTTY;
const C = TTY
  ? { G: '\x1b[0;32m', R: '\x1b[0;31m', Y: '\x1b[0;33m', C: '\x1b[0;36m', B: '\x1b[1m', N: '\x1b[0m' }
  : { G: '', R: '', Y: '', C: '', B: '', N: '' };

// ── 工具:读 JSON(容错) ─────────────────────────────────
function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    return { __parseError: String(e.message || e) };
  }
}

// ── 命令分发 ────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'validate') {
  process.exit(cmdValidate(args[0]));
} else if (cmd === 'validate-sprint-refs') {
  process.exit(cmdValidateSprintRefs());
} else if (cmd === 'journey-coverage' || cmd === undefined) {
  process.exit(cmdJourneyCoverage());
} else {
  console.error(`未知命令: ${cmd}`);
  console.error('用法: verify-plan-ssot.mjs [validate <json> | validate-sprint-refs | journey-coverage]');
  process.exit(2);
}

// ════════════════════════════════════════════════════════
// validate <json>
// ════════════════════════════════════════════════════════
function cmdValidate(jsonPath) {
  if (!jsonPath) {
    console.error(`${C.R}用法: verify-plan-ssot.mjs validate <path-to-json>${C.N}`);
    return 2;
  }
  if (!existsSync(jsonPath)) {
    console.error(`${C.R}文件不存在: ${jsonPath}${C.N}`);
    return 2;
  }

  const data = readJson(jsonPath);
  if (data.__parseError) {
    console.error(`${C.R}✗ JSON 解析失败: ${data.__parseError}${C.N}`);
    return 1;
  }

  // 全局旅程注册表（journey-registry.json）：只有 journeys[]，无 featureId/tasks
  const isRegistry = /journey-registry\.json$/.test(jsonPath);

  const errs = [];
  const warns = [];

  // 顶层必填（registry 豁免）
  if (!isRegistry) {
    for (const f of ['featureId', 'title']) {
      if (!data[f]) errs.push(`缺少顶层字段: ${f}`);
    }
  }

  // tasks 数组（registry 豁免）
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  if (!isRegistry && tasks.length === 0) warns.push('tasks 为空或缺失');
  const taskIds = new Set();
  for (const t of tasks) {
    if (!t.id) errs.push(`task 缺少 id: ${JSON.stringify(t).slice(0, 80)}`);
    else taskIds.add(t.id);
    if (t.subsystem && !VALID_SUBSYSTEMS.includes(t.subsystem)) {
      errs.push(`task ${t.id} subsystem 非法: ${t.subsystem}`);
    }
    if (Array.isArray(t.dependsOn)) {
      for (const dep of t.dependsOn) {
        if (!taskIds.has(dep) && !tasks.some(x => x.id === dep)) {
          errs.push(`task ${t.id} dependsOn 指向不存在的 id: ${dep}`);
        }
      }
    }
    // task.journey 软引用:存在 journeys 时检查
    if (t.journey) {
      const jids = (data.journeys || []).map(j => j.id);
      if (jids.length > 0 && !jids.includes(t.journey)) {
        errs.push(`task ${t.id} journey 指向不存在的旅程: ${t.journey}`);
      }
    }
  }

  // journeys 数组(可选)
  const journeys = Array.isArray(data.journeys) ? data.journeys : [];
  const jids = new Set();
  for (const j of journeys) {
    if (!j.id) { errs.push(`journey 缺少 id`); continue; }
    if (jids.has(j.id)) errs.push(`journey id 重复: ${j.id}`);
    jids.add(j.id);
    if (j.ref === true) continue; // ref 类型只校验 id
    if (j.priority && !VALID_PRIORITIES.includes(j.priority)) {
      errs.push(`journey ${j.id} priority 非法: ${j.priority}(应为 P0/P1/P2)`);
    }
    if (j.entrySubsystem && !VALID_ENTRY_SUBSYSTEMS.includes(j.entrySubsystem)) {
      errs.push(`journey ${j.id} entrySubsystem 非法: ${j.entrySubsystem}`);
    }
  }

  // 输出
  const rel = relative(ROOT, jsonPath) || jsonPath;
  if (warns.length) warns.forEach(w => console.log(`${C.Y}⚠ ${rel}: ${w}${C.N}`));
  if (errs.length) {
    errs.forEach(e => console.error(`${C.R}✗ ${rel}: ${e}${C.N}`));
    console.error(`${C.R}❌ 校验失败: ${errs.length} 个错误${C.N}`);
    return 1;
  }
  console.log(`${C.G}✓ ${rel}: schema 校验通过${C.N}`);
  return 0;
}

// ════════════════════════════════════════════════════════
// journey-coverage — 核心度量命令
// ════════════════════════════════════════════════════════
function cmdJourneyCoverage() {
  const tasksRoot = join(ROOT, TASKS_DIR);
  if (!existsSync(tasksRoot)) {
    console.error(`${C.R}✗ 未找到 ${TASKS_DIR}${C.N}`);
    return 2;
  }

  // ── Step 1: 聚合旅程总盘(分母) ──────────────────────
  // 首次定义(完整字段)为准;ref 引用合并 scenarios。
  const journeys = new Map(); // id → {id,title,priority,scenarios,entrySubsystem,declaredIn[]}
  const jsonFiles = readdirSync(tasksRoot)
    .filter(f => f.endsWith('.json'))
    .map(f => join(tasksRoot, f));

  let conflictWarns = [];
  for (const jf of jsonFiles) {
    const data = readJson(jf);
    if (data.__parseError || !Array.isArray(data.journeys)) continue;
    const rel = relative(ROOT, jf);
    for (const j of data.journeys) {
      if (!j || !j.id) continue;
      const existing = journeys.get(j.id);
      if (!existing) {
        // 首次定义(ref=true 却从未定义过 → 降级为 declared)
        journeys.set(j.id, {
          id: j.id,
          title: j.title || j.id,
          priority: j.priority || 'P2',
          scenarios: Array.isArray(j.scenarios) ? [...j.scenarios] : [],
          entrySubsystem: j.entrySubsystem || '-',
          declaredIn: [rel],
          refOnly: j.ref === true,
        });
      } else {
        existing.declaredIn.push(rel);
        // 合并 scenarios(去重)
        if (Array.isArray(j.scenarios)) {
          for (const s of j.scenarios) {
            if (!existing.scenarios.includes(s)) existing.scenarios.push(s);
          }
        }
        // 检测冲突:同 id 不同 title/priority
        if (j.ref !== true && j.title && j.title !== existing.title) {
          conflictWarns.push(`${j.id}: title 冲突 (${rel}: "${j.title}" vs "${existing.title}")`);
        }
        if (j.ref !== true && j.priority && j.priority !== existing.priority) {
          conflictWarns.push(`${j.id}: priority 冲突 (${rel}: ${j.priority} vs ${existing.priority})`);
        }
      }
    }
  }

  if (journeys.size === 0) {
    console.log(`${C.Y}⚠ 未在任何 taskGraph JSON 中声明 journeys。${C.N}`);
    console.log(`${C.Y}  旅程覆盖率度量需要至少一个 plan 声明 journeys(见 docs/dev/ssot-task-graph.md)。${C.N}`);
    return 0;
  }

  // ── Step 2: 扫描 spec 文件的 @J-xxx 标签(分子) ──────
  const specJourneyMap = scanSpecTags(); // Map<journeyId, Set<specRelPath>>

  // ── Step 3: 计算覆盖率矩阵 ──────────────────────────
  const rows = [];
  let p0Total = 0, p0Covered = 0, p0Gaps = [];
  let p1Total = 0, p1Covered = 0;
  let p2Total = 0, p2Covered = 0;

  for (const j of journeys.values()) {
    const specs = specJourneyMap.get(j.id) || new Set();
    const covered = specs.size > 0;
    const status = covered ? '✓ 已覆盖' : `${C.R}✗ GAP${C.N}`;
    rows.push({
      id: j.id,
      title: j.title,
      priority: j.priority,
      scenarioCount: j.scenarios.length,
      specCount: specs.size,
      specs: [...specs],
      covered,
    });
    if (j.priority === 'P0') {
      p0Total++;
      if (covered) p0Covered++; else p0Gaps.push(j.id);
    } else if (j.priority === 'P1') {
      p1Total++;
      if (covered) p1Covered++;
    } else {
      p2Total++;
      if (covered) p2Covered++;
    }
  }

  // ── Step 4: 输出 ────────────────────────────────────
  console.log('');
  console.log(`${C.C}═══════════════════════════════════════════════════════════${C.N}`);
  console.log(`${C.C}  旅程覆盖率报告 (Journey Coverage)${C.N}`);
  console.log(`${C.C}═══════════════════════════════════════════════════════════${C.N}`);
  console.log('');

  // 主表
  const hdr = ['旅程 ID', '优先级', '场景数', '绑定 spec 数', '状态'];
  printfRow(hdr, [20, 8, 8, 12, 14]);
  printfRow(['─'.repeat(20), '─'.repeat(8), '─'.repeat(8), '─'.repeat(12), '─'.repeat(14)], [20, 8, 8, 12, 14]);
  for (const r of rows) {
    const prioColor = r.priority === 'P0' ? C.R : (r.priority === 'P1' ? C.Y : C.N);
    const statusStr = r.covered ? `${C.G}✓ 已覆盖${C.N}` : `${C.R}✗ GAP${C.N}`;
    printfRowRaw([
      r.id,
      `${prioColor}${r.priority}${C.N}`,
      String(r.scenarioCount),
      String(r.specCount),
      statusStr,
    ], [20, 8, 8, 12, 14]);
  }
  console.log('');

  // 缺口明细(P0/P1)
  const gapRows = rows.filter(r => !r.covered);
  if (gapRows.length) {
    console.log(`${C.R}缺口明细:${C.N}`);
    for (const r of gapRows) {
      const prioColor = r.priority === 'P0' ? C.R : C.Y;
      console.log(`  ${prioColor}[${r.priority}]${C.N} ${r.id} (${r.title}) — 无 spec 绑定 @${r.id}`);
    }
    console.log('');
  }

  // 汇总
  const p0Pct = p0Total ? Math.round((p0Covered / p0Total) * 100) : 100;
  const p1Pct = p1Total ? Math.round((p1Covered / p1Total) * 100) : 0;
  const p2Pct = p2Total ? Math.round((p2Covered / p2Total) * 100) : 0;
  console.log(`${C.C}═══════════════════════════════════════════════════════════${C.N}`);
  console.log(`  ${C.B}P0 覆盖: ${p0Covered}/${p0Total} (${p0Pct}%)${C.N}  ${p0Pct === 100 ? C.G : C.R}${p0Pct === 100 ? '✓' : '✗'}${C.N}  P1: ${p1Covered}/${p1Total} (${p1Pct}%)  P2: ${p2Covered}/${p2Total} (${p2Pct}%)`);
  console.log(`  旅程总数: ${journeys.size}  已覆盖: ${rows.filter(r => r.covered).length}  GAP: ${gapRows.length}`);
  console.log(`${C.C}═══════════════════════════════════════════════════════════${C.N}`);

  // 冲突警告
  if (conflictWarns.length) {
    console.log('');
    conflictWarns.forEach(w => console.log(`${C.Y}⚠ 旅程 id 冲突: ${w}${C.N}`));
  }

  // ── 门禁:P0 阻断 ────────────────────────────────────
  console.log('');
  if (p0Gaps.length > 0) {
    console.log(`${C.R}❌ P0 旅程阻断: ${p0Gaps.length} 个 P0 旅程无 spec 绑定 → exit 1${C.N}`);
    console.log(`${C.R}   ${p0Gaps.join(', ')}${C.N}`);
    return 1;
  }
  console.log(`${C.G}✅ 旅程覆盖率门禁通过(P0 = 100%)${C.N}`);
  return 0;
}

// ── spec 扫描:递归找 *.spec.ts/*.cy.ts,正则提 @J-xxx ──
function scanSpecTags() {
  const map = new Map(); // journeyId → Set<relPath>
  const specDirs = [
    'packages/engine/luban/e2e',
    'packages/web/luban-website/e2e',
    'packages/ui/luban-ui/apps/luban-ui-e2e/src/e2e',
    'e2e/flows',
  ];
  const tagRe = /@(J-[A-Za-z0-9_-]+)/g;
  for (const dir of specDirs) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    walkSpecs(abs).forEach(file => {
      const content = readFileSync(file, 'utf8');
      const rel = relative(ROOT, file);
      let m;
      while ((m = tagRe.exec(content)) !== null) {
        const jid = m[1];
        if (!map.has(jid)) map.set(jid, new Set());
        map.get(jid).add(rel);
      }
    });
  }
  return map;
}

function walkSpecs(dir) {
  const out = [];
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      out.push(...walkSpecs(full));
    } else {
      const ext = extname(name);
      if ((ext === '.ts' || ext === '.js') &&
          (name.endsWith('.spec.ts') || name.endsWith('.cy.ts') || name.endsWith('.test.ts'))) {
        out.push(full);
      }
    }
  }
  return out;
}

// ── 表格打印工具(支持 ANSI 颜色宽度补偿) ──────────────
function visibleLen(s) {
  // 去掉 ANSI 转义后计算可见长度
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}
function printfRow(cells, widths) {
  printfRowRaw(cells, widths);
}
function printfRowRaw(cells, widths) {
  const parts = cells.map((c, i) => {
    const w = widths[i] || 10;
    const vis = visibleLen(c);
    const pad = Math.max(0, w - vis);
    return c + ' '.repeat(pad);
  });
  console.log('  ' + parts.join('  '));
}

// ════════════════════════════════════════════════════════
// validate-sprint-refs
// 校验所有 task graph 的 task.sprintId 指向有效且状态兼容的 sprint。
// Sprint MCP 与 task graph 联动的完整性检查。
// ════════════════════════════════════════════════════════
function cmdValidateSprintRefs() {
  const SPRINTS_DIR = join(ROOT, 'docs', 'superpowers', 'sprints');
  const errors = [];
  const warnings = [];
  let checked = 0;

  // 加载所有 sprint（featureId 豁免，仿 journey-registry 模式）
  const sprintFiles = existsSync(SPRINTS_DIR)
    ? readdirSync(SPRINTS_DIR).filter((f) => f.endsWith('.json') && f !== 'releases.json')
    : [];
  const sprintStatus = new Map();
  for (const f of sprintFiles) {
    const data = readJson(join(SPRINTS_DIR, f));
    if (data?.sprintId) {
      sprintStatus.set(data.sprintId, data.status ?? 'unknown');
    }
  }

  // 扫描所有 task graph 的 task.sprintId
  if (!existsSync(TASKS_DIR)) {
    console.log(`${C.Y}无 task graph 目录${C.N}`);
    return 0;
  }
  const taskFiles = readdirSync(TASKS_DIR).filter((f) => f.endsWith('.json'));
  for (const f of taskFiles) {
    if (/journey-registry\.json$/.test(f)) continue;
    const data = readJson(join(ROOT, TASKS_DIR, f));
    const featureId = data?.featureId ?? f.slice(0, -5);
    const tasks = Array.isArray(data?.tasks) ? data.tasks : (Array.isArray(data?.children) ? data.children : []);
    for (const t of tasks) {
      if (!t?.id || !t?.sprintId) continue;
      checked++;
      if (!sprintStatus.has(t.sprintId)) {
        errors.push(`${featureId}/${t.id}: sprintId "${t.sprintId}" 指向不存在的 sprint 文件`);
      } else {
        const status = sprintStatus.get(t.sprintId);
        if (status === 'cancelled') {
          warnings.push(`${featureId}/${t.id}: 指向已取消的 sprint "${t.sprintId}"`);
        }
      }
    }
  }

  console.log(`${C.B}Sprint 引用校验${C.N}: 检查 ${checked} 个引用 · ${sprintStatus.size} 个 sprint`);
  if (errors.length > 0) {
    console.log(`${C.R}  ✗ ${errors.length} 个错误${C.N}`);
    for (const e of errors) console.log(`    ${C.R}${e}${C.N}`);
  }
  if (warnings.length > 0) {
    console.log(`${C.Y}  ! ${warnings.length} 个警告${C.N}`);
    for (const w of warnings.slice(0, 10)) console.log(`    ${C.Y}${w}${C.N}`);
  }
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`  ${C.G}✓ 全部 sprint 引用有效${C.N}`);
  }
  return errors.length > 0 ? 1 : 0;
}
