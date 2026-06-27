/**
 * Release Store — Release（发布）注册表 CRUD。
 * 全局单文件：docs/superpowers/sprints/releases.json
 */

import { releasesFile, readJsonOrNull, writeJsonAtomic, pathExists } from './repo.js';
import type { Release, ReleaseRegistry, ReleaseStatus, Sprint } from '../types.js';
import { getSprint } from './sprint-store.js';

const NOW = () => new Date().toISOString();

const EMPTY_REGISTRY: ReleaseRegistry = { releases: [] };

async function loadRegistry(root: string): Promise<ReleaseRegistry> {
  const reg = await readJsonOrNull<ReleaseRegistry>(releasesFile(root));
  return reg ?? { ...EMPTY_REGISTRY };
}

async function saveRegistry(root: string, reg: ReleaseRegistry): Promise<void> {
  reg.releases.sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''));
  await writeJsonAtomic(releasesFile(root), reg);
}

export async function createRelease(
  root: string,
  releaseId: string,
  fields: { name: string; version?: string; releaseDate?: string; notes?: string },
): Promise<Release> {
  const reg = await loadRegistry(root);
  if (reg.releases.some((r) => r.releaseId === releaseId)) {
    throw new Error(`Release 已存在: ${releaseId}`);
  }
  const now = NOW();
  const release: Release = {
    releaseId,
    name: fields.name,
    version: fields.version,
    status: 'planned',
    sprintIds: [],
    releaseDate: fields.releaseDate,
    notes: fields.notes,
    createdAt: now,
    metadata: { updatedAt: now },
  };
  reg.releases.push(release);
  await saveRegistry(root, reg);
  return release;
}

export async function getRelease(root: string, releaseId: string): Promise<Release | null> {
  const reg = await loadRegistry(root);
  return reg.releases.find((r) => r.releaseId === releaseId) ?? null;
}

export async function listReleases(root: string): Promise<Release[]> {
  const reg = await loadRegistry(root);
  return reg.releases;
}

export async function updateRelease(
  root: string,
  releaseId: string,
  patch: Partial<Pick<Release, 'name' | 'version' | 'status' | 'releaseDate' | 'notes'>>,
): Promise<Release> {
  const reg = await loadRegistry(root);
  const r = reg.releases.find((x) => x.releaseId === releaseId);
  if (!r) throw new Error(`Release 不存在: ${releaseId}`);
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (r as unknown as Record<string, unknown>)[k] = v;
  }
  r.metadata.updatedAt = NOW();
  await saveRegistry(root, reg);
  return r;
}

export async function attachSprint(root: string, releaseId: string, sprintId: string): Promise<Release> {
  // 校验 sprint 存在
  const sprint = await getSprint(root, sprintId);
  if (!sprint) throw new Error(`Sprint 不存在: ${sprintId}`);
  const reg = await loadRegistry(root);
  const r = reg.releases.find((x) => x.releaseId === releaseId);
  if (!r) throw new Error(`Release 不存在: ${releaseId}`);
  if (!r.sprintIds.includes(sprintId)) r.sprintIds.push(sprintId);
  r.metadata.updatedAt = NOW();
  await saveRegistry(root, reg);
  return r;
}

export async function releaseIt(root: string, releaseId: string): Promise<Release> {
  const reg = await loadRegistry(root);
  const r = reg.releases.find((x) => x.releaseId === releaseId);
  if (!r) throw new Error(`Release 不存在: ${releaseId}`);
  // 校验所有 attached sprint 已 completed
  for (const sid of r.sprintIds) {
    const s = await getSprint(root, sid);
    if (s && s.status !== 'completed') {
      throw new Error(`Sprint ${sid} 未 completed，不能发布`);
    }
  }
  r.status = 'released';
  r.metadata.updatedAt = NOW();
  await saveRegistry(root, reg);
  return r;
}

export async function registryExists(root: string): Promise<boolean> {
  return pathExists(releasesFile(root));
}

export type { Sprint, ReleaseStatus };
