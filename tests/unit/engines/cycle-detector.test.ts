/**
 * Unit Tests: Cycle Detector
 */

import { describe, it, expect } from 'vitest';
import { detectServiceDependencyCycle, wouldCreateCycle } from '../../../src/core/engines/cycle-detector.js';

describe('Cycle Detector', () => {
  describe('detectServiceDependencyCycle', () => {
    it('should not detect cycle in acyclic graph', () => {
      const graph = new Map([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', []],
      ]);

      const result = detectServiceDependencyCycle('A', graph);

      expect(result.hasCycle).toBe(false);
      expect(result.cycle).toBeUndefined();
      expect(result.message).toBeUndefined();
    });

    it('should detect simple 2-node cycle', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['A']],
      ]);

      const result = detectServiceDependencyCycle('A', graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toEqual(['A', 'B', 'A']);
      expect(result.message).toContain('Circular dependency detected');
      expect(result.message).toContain('A -> B -> A');
    });

    it('should detect 3-node cycle', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);

      const result = detectServiceDependencyCycle('A', graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toEqual(['A', 'B', 'C', 'A']);
      expect(result.message).toContain('A -> B -> C -> A');
    });

    it('should detect self-loop', () => {
      const graph = new Map([['A', ['A']]]);

      const result = detectServiceDependencyCycle('A', graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toEqual(['A', 'A']);
    });

    it('should handle complex graph with cycle', () => {
      const graph = new Map([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D', 'E']],
        ['D', ['F']],
        ['E', ['B']],
        ['F', ['C']], // Creates real cycle: C -> D -> F -> C
      ]);

      const result = detectServiceDependencyCycle('A', graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toBeDefined();
    });

    it('should handle graph with multiple disconnected components', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', []],
        ['C', ['D']],
        ['D', ['C']], // Cycle in different component
      ]);

      const resultA = detectServiceDependencyCycle('A', graph);
      expect(resultA.hasCycle).toBe(false);

      const resultC = detectServiceDependencyCycle('C', graph);
      expect(resultC.hasCycle).toBe(true);
    });

    it('should handle empty dependencies', () => {
      const graph = new Map([['A', []]]);

      const result = detectServiceDependencyCycle('A', graph);

      expect(result.hasCycle).toBe(false);
    });
  });

  describe('wouldCreateCycle', () => {
    it('should detect that new dependency would create cycle', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', []],
      ]);

      // Adding C -> A would create cycle
      const result = wouldCreateCycle('C', 'A', graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toContain('A');
      expect(result.cycle).toContain('C');
    });

    it('should detect that new dependency would not create cycle', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', []],
        ['D', []],
      ]);

      // Adding D -> A would not create cycle
      const result = wouldCreateCycle('D', 'A', graph);

      expect(result.hasCycle).toBe(false);
    });

    it('should handle adding first dependency to service', () => {
      const graph = new Map([
        ['A', []],
        ['B', []],
      ]);

      const result = wouldCreateCycle('A', 'B', graph);

      expect(result.hasCycle).toBe(false);
    });
  });
});
