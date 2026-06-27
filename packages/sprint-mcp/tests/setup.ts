/**
 * vitest 配置 + 测试用临时目录工具。
 */
import { defineConfig } from 'vitest/config';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/http/**'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});

/** 创建临时仓库根，含 docs/superpowers/{tasks,sprints} 结构 */
export function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'sprint-mcp-test-'));
  mkdirSync(join(root, 'docs', 'superpowers', 'tasks'), { recursive: true });
  mkdirSync(join(root, 'docs', 'superpowers', 'sprints'), { recursive: true });
  return root;
}

/** 在临时根写一个 task graph JSON */
export function seedTaskGraph(
  root: string,
  featureId: string,
  data: Record<string, unknown>,
): void {
  writeFileSync(join(root, 'docs', 'superpowers', 'tasks', `${featureId}.json`), JSON.stringify(data, null, 2));
}
