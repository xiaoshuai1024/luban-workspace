/**
 * JSON 文件仓库 — 原子读写（temp + rename），保证写一半不破坏 SSOT。
 *
 * 风格对齐 scripts/*.mjs（零依赖、Node 内置），但本包可依赖 zod。
 * 目录：docs/superpowers/sprints/<sprintId>.json
 *
 * 写策略：序列化 → 写临时文件 → fs.rename 原子替换。本地单用户场景无需锁。
 */

import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** 仓库根（默认仓库根；测试时通过 env 注入） */
export function sprintsDir(root: string = process.cwd()): string {
  return join(root, 'docs', 'superpowers', 'sprints');
}

export function releasesFile(root: string = process.cwd()): string {
  return join(sprintsDir(root), 'releases.json');
}

/** sprint 文件路径 */
export function sprintFile(sprintId: string, root: string = process.cwd()): string {
  return join(sprintsDir(root), `${sprintId}.json`);
}

/** 确保目录存在（写前调用） */
export function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** 读取 JSON 文件；不存在或解析失败返回 null */
export async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 同步读取 JSON；不存在或解析失败返回 null（hook 类脚本用） */
export function readJsonOrNullSync<T>(filePath: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsSync = require('node:fs');
    const raw = fsSync.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 原子写 JSON：temp + rename */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  ensureDir(filePath);
  const json = JSON.stringify(data, null, 2) + '\n';
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, json, 'utf8');
  await fs.rename(tmp, filePath);
}

/** 列出目录下所有 .json 文件名（不含路径，不含扩展名） */
export async function listJsonIds(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((f) => f.endsWith('.json') && f !== 'releases.json')
      .map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

/** 判断文件是否存在 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** 删除文件（忽略不存在） */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
}

/**
 * 乐观写：读取 → 变换 → 写回。
 * 防止并发覆盖：使用 O_EXCL 创建 lock 文件；失败抛错。
 * 本地单用户场景通常用不到，但 sprint 关闭等关键操作可用。
 */
export async function withLock<T>(
  lockFile: string,
  fn: () => Promise<T>,
): Promise<T> {
  ensureDir(lockFile);
  try {
    const fd = await fs.open(lockFile, 'wx');
    await fd.close();
  } catch {
    throw new Error(`资源被锁: ${lockFile}`);
  }
  try {
    return await fn();
  } finally {
    await removeFile(lockFile);
  }
}
