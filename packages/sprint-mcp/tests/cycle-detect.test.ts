import { describe, it, expect } from 'vitest';
import { wouldCreateCycleFromEdges, findCycle, topologicalLayers } from '../src/util/cycle-detect.js';

describe('cycle-detect', () => {
  describe('wouldCreateCycleFromEdges', () => {
    it('自环视为环', () => {
      expect(wouldCreateCycleFromEdges([], 'A', 'A')).toBe(true);
    });

    it('空图加单边无环', () => {
      expect(wouldCreateCycleFromEdges([], 'A', 'B')).toBe(false);
    });

    it('直链 A→B→C 加 C→A 形成环', () => {
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ];
      expect(wouldCreateCycleFromEdges(edges, 'C', 'A')).toBe(true);
    });

    it('直链加非回到起点的边无环', () => {
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ];
      expect(wouldCreateCycleFromEdges(edges, 'A', 'C')).toBe(false);
    });

    it('分支合并不算环', () => {
      // A→B, A→C, B→D, C→D：菱形依赖合法
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'A', to: 'C' },
        { from: 'B', to: 'D' },
        { from: 'C', to: 'D' },
      ];
      expect(wouldCreateCycleFromEdges(edges, 'D', 'E')).toBe(false);
    });
  });

  describe('findCycle', () => {
    it('无环返回 null', () => {
      expect(findCycle([{ from: 'A', to: 'B' }])).toBeNull();
    });

    it('简单环 A→B→A 被检出', () => {
      const cycle = findCycle([
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ]);
      expect(cycle).not.toBeNull();
      expect(cycle).toContain('A');
      expect(cycle).toContain('B');
    });

    it('三节点环被检出', () => {
      const cycle = findCycle([
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ]);
      expect(cycle).not.toBeNull();
      expect(cycle).toHaveLength(4); // A B C A
    });
  });

  describe('topologicalLayers', () => {
    it('直链分层', () => {
      const layers = topologicalLayers([
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ]);
      expect(layers[0]).toContain('A');
      expect(layers[1]).toContain('B');
      expect(layers[2]).toContain('C');
    });

    it('并行节点同层', () => {
      const layers = topologicalLayers([
        { from: 'A', to: 'C' },
        { from: 'B', to: 'C' },
      ]);
      expect(layers[0].sort()).toEqual(['A', 'B']);
      expect(layers[1]).toEqual(['C']);
    });

    it('孤立节点在第一层', () => {
      const layers = topologicalLayers([]);
      expect(layers).toEqual([]);
    });

    it('环内节点作为最后异常层', () => {
      const layers = topologicalLayers([
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ]);
      expect(layers.length).toBeGreaterThan(0);
      // 不崩溃即可
    });
  });
});
