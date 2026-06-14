#!/usr/bin/env node
/**
 * check-design-tokens.mjs (luban 版)
 *
 * Scan luban frontend .vue / .tsx files for design token violations:
 * - Hardcoded color values that should use --lb-* (luban-ui) variables
 * - Missing page shell / card token usage
 *
 * TODO（待从 luban-ui 提取确认）:
 *   - TOKEN_COLORS_HEX 白名单当前为占位（沿用 kangdou 色值作为示例），
 *     须在 packages/ui/luban-ui 提取真实 token 后回填。
 *   - TOKEN_PREFIX 当前假设为 "--lb-"，若 luban-ui 使用其他前缀（如 --luban-*）须同步修改。
 *   - FRONTEND_DIR 默认指向 packages/ui/luban-ui，可按需调整。
 *
 * Usage:
 *   node scripts/check-design-tokens.mjs                          # scan staged .vue/.tsx files
 *   node scripts/check-design-tokens.mjs --all                    # scan all .vue/.tsx files under FRONTEND_DIR
 *   node scripts/check-design-tokens.mjs --path packages/ui/luban-ui/src   # scan specific path
 *
 * Exit code: 0 = clean, 1 = warnings, 2 = errors
 */

import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, relative } from "path";

// ============================================================================
// TODO（待确认）：Token 白名单 — 从 luban-ui 提取真实 token 后回填
// ============================================================================
// 当前为占位（沿用 kangdou 示例色值）。luban-ui token 提取方法：
//   1. 在 packages/ui/luban-ui 中检索 tokens.css / tokens.scss / design-tokens.ts
//   2. 提取所有 :root 或 [data-theme] 下定义的颜色变量值
//   3. 把 HEX 值（含大小写）填入下方 Set
const TOKEN_COLORS_HEX = new Set([
  // 占位（待 luban-ui 回填，下列为示例，不代表 luban 实际品牌色）：
  "#2ecc71", "#2ECC71",
  "#f39c12", "#F39C12",
  "#e74c3c", "#E74C3C",
  "#2c3e50", "#2C3E50",
  "#7f8c8d", "#7F8C8D",
  "#3498db", "#3498DB",
]);

// ============================================================================
// TODO（待确认）：CSS 变量前缀
// ============================================================================
// 假设 luban-ui 使用 --lb- 前缀。若实际为 --luban-* / --lb-ui-* 等，须修改此处与 hasVarRef()。
const TOKEN_PREFIX = "--lb-";

const ROOT = process.cwd();
// 默认扫描 luban-ui 物料库；可通过 --front-end 覆盖
const FRONTEND_DIR = resolve(ROOT, "packages/ui/luban-ui");

// Colors that are commonly used and acceptable outside tokens
const ALLOWED_STANDALONE_COLORS = new Set([
  "#fff", "#FFF", "#ffffff", "#FFFFFF",
  "#000", "#000000",
  "transparent", "currentColor", "inherit",
  "white", "black",
]);

// Patterns that look like hex/rgb/hsl colors
const COLOR_RE = /(?:^|[^-\w#])(#[0-9a-fA-F]{3,8})(?:[^-\w#]|$)/g;

let errors = 0;
let warnings = 0;

function logError(file, msg) {
  console.error(`  ✗ ${file}: ${msg}`);
  errors++;
}

function logWarn(file, msg) {
  console.warn(`  ⚠ ${file}: ${msg}`);
  warnings++;
}

/** Check if a hex color string is in the token whitelist */
function isAllowedHexColor(hex) {
  const upper = hex.toUpperCase();
  if (TOKEN_COLORS_HEX.has(hex) || TOKEN_COLORS_HEX.has(upper)) return true;
  if (ALLOWED_STANDALONE_COLORS.has(hex) || ALLOWED_STANDALONE_COLORS.has(hex.toLowerCase())) return true;
  return false;
}

/** Check if a line contains a CSS variable reference (luban-ui prefix) */
function hasVarRef(line) {
  return new RegExp(`var\\(\\s*${TOKEN_PREFIX.replace("-", "\\-")}`).test(line);
}

/** Check if a line is a CSS custom property definition */
function isCssVarDef(line) {
  return /^\s*--[\w-]+\s*:/.test(line);
}

/** Check if line is inside a style block comment */
function isInComment(line) {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*\/\*/.test(line);
}

function scanVueFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const shortPath = relative(ROOT, filePath);

  // Check 1: page shell usage (luban-ui)
  // TODO（待确认）：luban-ui 的页面壳组件名待回填（占位 LbPageShell）
  const PAGE_SHELL = "LbPageShell";
  const isComponent = /\/components\//.test(filePath);
  const isPage = /\/pages\//.test(filePath) || /\/views\//.test(filePath);

  if (isPage && !isComponent) {
    const hasPageShell = new RegExp(PAGE_SHELL).test(content);
    const hasViewTemplate = /<template>/.test(content);

    if (hasViewTemplate && !hasPageShell) {
      logWarn(shortPath, `页面可能缺少 ${PAGE_SHELL} 包裹（未检测到 <${PAGE_SHELL}>）— 组件名待 luban-ui 确认`);
    }
  }

  // Check 2: Hardcoded colors
  let inStyle = false;

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Track style blocks (Vue <style>; .tsx 无 style 块，靠内联检测)
    if (/<style/.test(line)) { inStyle = true; }
    if (/<\/style>/.test(line)) { inStyle = false; return; }

    // Skip non-style lines and comments
    if (!inStyle) return;
    if (isInComment(line)) return;
    if (isCssVarDef(line)) return;
    if (hasVarRef(line)) return;

    // Check hex colors
    let match;
    COLOR_RE.lastIndex = 0;
    while ((match = COLOR_RE.exec(line)) !== null) {
      const hex = match[1];
      if (hex.length === 3 || hex.length === 4 || hex.length === 6 || hex.length === 8) {
        if (!isAllowedHexColor(hex)) {
          logError(shortPath, `第 ${lineNum} 行: 使用了非 Token 硬编码颜色 ${hex}（应使用 var(${TOKEN_PREFIX}*)）`);
        }
      }
    }
  });

  // Check 3: Template - card class usage
  // TODO（待确认）：luban-ui 卡片类名待回填（占位 lb-card）
  const CARD_CLASS = "lb-card";
  if (!inStyle && new RegExp(`class="[^"]*card[^"]*"`, "i").test(content)) {
    const lines2 = content.split("\n");
    lines2.forEach((line, i) => {
      if (/class="[^"]*card[^"]*"/i.test(line) && !new RegExp(CARD_CLASS).test(line) && !/el-card/.test(line)) {
        logWarn(shortPath, `第 ${i + 1} 行: 自定义 "card" 类名（应使用 luban-ui ${CARD_CLASS}，类名待确认）`);
      }
    });
  }

  // Check 4: Template - inline style hardcoded colors
  const inlineStyleLines = content.match(/style="[^"]*"/g);
  if (inlineStyleLines) {
    inlineStyleLines.forEach((styleAttr) => {
      const colorMatch = styleAttr.match(/color\s*:\s*(#[0-9a-fA-F]{3,8})/);
      if (colorMatch && !isAllowedHexColor(colorMatch[1])) {
        logWarn(shortPath, `Inline style 硬编码颜色 ${colorMatch[1]}（应使用 var(${TOKEN_PREFIX}*)）`);
      }
    });
  }
}

function getTargetFiles(targetPath) {
  const absTarget = targetPath ? resolve(ROOT, targetPath) : FRONTEND_DIR;
  if (!existsSync(absTarget)) {
    console.error(`路径不存在: ${targetPath || relpath(ROOT, FRONTEND_DIR)}`);
    process.exit(1);
  }
  // scan both .vue and .tsx
  return execSync(
    `find "${absTarget}" -type f \\( -name "*.vue" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.output/*"`,
    { encoding: "utf-8" }
  ).trim().split("\n").filter(Boolean);
}

function getStagedOrModifiedFiles() {
  // Default: scan staged .vue/.tsx files
  try {
    const staged = execSync("git diff --cached --name-only -- '*.vue' '*.tsx'", { encoding: "utf-8", cwd: ROOT }).trim();
    if (staged) {
      return staged.split("\n").filter(f => existsSync(resolve(ROOT, f))).map(f => resolve(ROOT, f));
    }
  } catch {
    // Not in git context, fall through
  }

  // Fallback: check modified files
  try {
    const modified = execSync("git diff --name-only -- '*.vue' '*.tsx'", { encoding: "utf-8", cwd: ROOT }).trim();
    if (modified) {
      return modified.split("\n").filter(f => existsSync(resolve(ROOT, f))).map(f => resolve(ROOT, f));
    }
  } catch {
    // Not in git context
  }

  return null;
}

function relpath(from, to) {
  try { return relative(from, to); } catch { return to; }
}

// --- Main ---
const args = process.argv.slice(2);
const isAll = args.includes("--all");
const targetPath = args.includes("--path") ? args[args.indexOf("--path") + 1] : null;

console.log("🔍 luban 设计 Token 合规检查");
console.log("=".repeat(40));
console.log(`⚠️  Token 白名单为占位，须从 packages/ui/luban-ui 提取真实 token 后回填本脚本`);
console.log("");

let files;
if (targetPath) {
  files = getTargetFiles(targetPath);
} else if (isAll) {
  files = getTargetFiles(null);
} else {
  files = getStagedOrModifiedFiles();
  if (!files || files.length === 0) {
    // Last resort: scan FRONTEND_DIR
    if (existsSync(FRONTEND_DIR)) {
      files = getTargetFiles(null);
    } else {
      console.log(`默认扫描目录不存在: ${FRONTEND_DIR}`);
      console.log(`请用 --path <dir> 指定，或先接入 packages/ui/luban-ui submodule`);
      process.exit(0);
    }
  }
}

if (!files || files.length === 0 || (files.length === 1 && !files[0])) {
  console.log("没有需要检查的 .vue/.tsx 文件");
  process.exit(0);
}

console.log(`检查 ${files.length} 个文件...\n`);

files.forEach((f) => {
  try {
    scanVueFile(f);
  } catch (e) {
    logError(relative(ROOT, f), `读取失败: ${e.message}`);
  }
});

console.log("\n" + "=".repeat(40));

if (errors > 0) {
  console.log(`❌ ${errors} 个错误, ${warnings} 个警告`);
  process.exit(2);
} else if (warnings > 0) {
  console.log(`⚠ ${warnings} 个警告（无错误）`);
  process.exit(1);
} else {
  console.log("✅ 全部通过，无违规");
  process.exit(0);
}
