/**
 * 依赖环检测 — 仿 cardo 的 DFS 实现。
 *
 * 用于 addDependency 前置校验：检查新增 from→to 边是否会形成环。
 * 这里实现为纯函数（不依赖 sprint 对象），便于单测；story-store 内部另有 wouldCreateCycle 包装。
 */

export interface DepEdge {
  from: string;
  to: string;
}

/**
 * 给定现有边集，检查新增 (from→to) 是否会形成环。
 * 算法：构建邻接表，从 to 出发 DFS，看能否回到 from。
 */
export function wouldCreateCycleFromEdges(
  edges: ReadonlyArray<DepEdge>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;

  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from)!.add(e.to);
  }
  // 加上待新增的边
  if (!adj.has(from)) adj.set(from, new Set());
  adj.get(from)!.add(to);

  // DFS：从 from 出发能否回到 from（经过 ≥1 步）
  const visited = new Set<string>();
  const stack: string[] = [from];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const neighbors = adj.get(node);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (next === from) return true;
      if (!visited.has(next)) {
        visited.add(next);
        stack.push(next);
      }
    }
  }
  return false;
}

/**
 * 整图环检测：返回找到的第一个环（若存在）。
 * 用于启动期校验 sprint.dependencies 是否已被外部手动改成含环。
 */
export function findCycle(edges: ReadonlyArray<DepEdge>): string[] | null {
  const adj = new Map<string, Set<string>>();
  const nodes = new Set<string>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from)!.add(e.to);
    nodes.add(e.from);
    nodes.add(e.to);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n, WHITE);

  const path: string[] = [];

  function dfs(u: string): string[] | null {
    color.set(u, GRAY);
    path.push(u);
    const neighbors = adj.get(u);
    if (neighbors) {
      for (const v of neighbors) {
        const c = color.get(v) ?? WHITE;
        if (c === GRAY) {
          // 找到环：从 path 中 v 的位置开始
          const start = path.indexOf(v);
          return path.slice(start).concat(v);
        }
        if (c === WHITE) {
          const cycle = dfs(v);
          if (cycle) return cycle;
        }
      }
    }
    path.pop();
    color.set(u, BLACK);
    return null;
  }

  for (const n of nodes) {
    if (color.get(n) === WHITE) {
      const cycle = dfs(n);
      if (cycle) return cycle;
    }
  }
  return null;
}

/**
 * 拓扑排序（Kahn 算法）。返回分层结构：每层是可并行的节点集合。
 * 用于看板渲染「就绪/阻塞」列、并行派发计划。
 */
export function topologicalLayers(edges: ReadonlyArray<DepEdge>): string[][] {
  const adj = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  const nodes = new Set<string>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from)!.add(e.to);
    nodes.add(e.from);
    nodes.add(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    if (!inDegree.has(e.from)) inDegree.set(e.from, inDegree.get(e.from) ?? 0);
  }

  const layers: string[][] = [];
  let current = [...nodes].filter((n) => (inDegree.get(n) ?? 0) === 0);
  const visited = new Set<string>();

  while (current.length > 0) {
    layers.push(current);
    const next: string[] = [];
    for (const n of current) {
      visited.add(n);
      const neighbors = adj.get(n);
      if (!neighbors) continue;
      for (const v of neighbors) {
        const d = (inDegree.get(v) ?? 0) - 1;
        inDegree.set(v, d);
        if (d === 0 && !visited.has(v)) next.push(v);
      }
    }
    current = next;
  }

  // 检测剩余节点（环）
  const leftover = [...nodes].filter((n) => !visited.has(n));
  if (leftover.length > 0) {
    layers.push(leftover); // 环内节点作为最后一层（标记问题但不崩溃）
  }
  return layers;
}
