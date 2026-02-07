/**
 * Unit Tests: Deep Merge Utility
 */

import { describe, it, expect } from 'vitest';
import { deepMerge } from '../../../src/core/engines/deep-merge.js';

describe('Deep Merge Utility', () => {
  describe('Basic merging', () => {
    it('should merge flat objects', () => {
      const result = deepMerge([
        ['source1', { a: 1 }],
        ['source2', { b: 2 }],
      ]);

      expect(result.merged).toEqual({ a: 1, b: 2 });
    });

    it('should deep merge nested objects', () => {
      const result = deepMerge([
        ['source1', { a: { b: 1 } }],
        ['source2', { a: { c: 2 } }],
      ]);

      expect(result.merged).toEqual({ a: { b: 1, c: 2 } });
    });

    it('should override primitives with later values', () => {
      const result = deepMerge([
        ['source1', { a: 1 }],
        ['source2', { a: 2 }],
      ]);

      expect(result.merged).toEqual({ a: 2 });
    });
  });

  describe('Array handling', () => {
    it('should replace arrays by default', () => {
      const result = deepMerge([
        ['source1', { arr: [1, 2] }],
        ['source2', { arr: [3, 4] }],
      ]);

      expect(result.merged).toEqual({ arr: [3, 4] });
    });

    it('should concatenate arrays when arrayStrategy is concat', () => {
      const result = deepMerge(
        [
          ['source1', { arr: [1, 2] }],
          ['source2', { arr: [3, 4] }],
        ],
        { arrayStrategy: 'concat' }
      );

      expect(result.merged).toEqual({ arr: [1, 2, 3, 4] });
    });
  });

  describe('Special value handling', () => {
    it('should handle null as explicit override', () => {
      const result = deepMerge([
        ['source1', { a: { b: 1 } }],
        ['source2', { a: null }],
      ]);

      expect(result.merged).toEqual({ a: null });
    });

    it('should ignore undefined values', () => {
      const result = deepMerge([
        ['source1', { a: 1 }],
        ['source2', { a: undefined }],
      ]);

      expect(result.merged).toEqual({ a: 1 });
    });

    it('should skip undefined sources entirely', () => {
      const result = deepMerge([
        ['source1', { a: 1 }],
        ['source2', undefined],
        ['source3', { b: 2 }],
      ]);

      expect(result.merged).toEqual({ a: 1, b: 2 });
    });
  });

  describe('Type mismatches', () => {
    it('should replace object with primitive', () => {
      const result = deepMerge([
        ['source1', { a: { b: 1 } }],
        ['source2', { a: 'string' }],
      ]);

      expect(result.merged).toEqual({ a: 'string' });
    });

    it('should replace primitive with object', () => {
      const result = deepMerge([
        ['source1', { a: 'string' }],
        ['source2', { a: { b: 1 } }],
      ]);

      expect(result.merged).toEqual({ a: { b: 1 } });
    });

    it('should replace array with object', () => {
      const result = deepMerge([
        ['source1', { a: [1, 2] }],
        ['source2', { a: { b: 3 } }],
      ]);

      expect(result.merged).toEqual({ a: { b: 3 } });
    });
  });

  describe('Priority order', () => {
    it('should maintain priority order (later wins)', () => {
      const result = deepMerge([
        ['s1', { a: 1 }],
        ['s2', { a: 2 }],
        ['s3', { a: 3 }],
      ]);

      expect(result.merged).toEqual({ a: 3 });
    });

    it('should apply nested priority correctly', () => {
      const result = deepMerge([
        ['s1', { config: { replicas: 1, region: 'us-east-1' } }],
        ['s2', { config: { replicas: 3 } }],
        ['s3', { config: { region: 'eu-west-1' } }],
      ]);

      expect(result.merged).toEqual({
        config: { replicas: 3, region: 'eu-west-1' },
      });
    });
  });

  describe('Source tracking', () => {
    it('should track sources when trackSources is true', () => {
      const result = deepMerge(
        [
          ['system.yaml', { replicas: 1 }],
          ['service.yaml', { replicas: 3 }],
        ],
        { trackSources: true }
      );

      expect(result.contributions).toBeDefined();
      expect(result.contributions).toHaveLength(1);
      expect(result.contributions?.[0]).toMatchObject({
        source: 'service.yaml',
        path: 'replicas',
        level: 'service',
      });
    });

    it('should not track sources when trackSources is false', () => {
      const result = deepMerge([
        ['system.yaml', { replicas: 1 }],
        ['service.yaml', { replicas: 3 }],
      ]);

      expect(result.contributions).toBeUndefined();
    });
  });

  describe('Complex scenarios', () => {
    it('should handle deeply nested merges', () => {
      const result = deepMerge([
        ['s1', { a: { b: { c: { d: 1 } } } }],
        ['s2', { a: { b: { c: { e: 2 } } } }],
        ['s3', { a: { b: { f: 3 } } }],
      ]);

      expect(result.merged).toEqual({
        a: { b: { c: { d: 1, e: 2 }, f: 3 } },
      });
    });

    it('should handle real-world service config merge', () => {
      const result = deepMerge([
        [
          'system.yaml',
          {
            runtime: { language: 'nodejs', version: '20' },
            deployment: { replicas: 1 },
          },
        ],
        [
          'service.yaml',
          {
            name: 'api-service',
            type: 'api',
            deployment: { pattern: 'lambda', replicas: 3 },
          },
        ],
        [
          'prod.yaml',
          {
            deployment: { replicas: 5 },
            scaling: { minReplicas: 3, maxReplicas: 10 },
          },
        ],
      ]);

      expect(result.merged).toEqual({
        name: 'api-service',
        type: 'api',
        runtime: { language: 'nodejs', version: '20' },
        deployment: { pattern: 'lambda', replicas: 5 },
        scaling: { minReplicas: 3, maxReplicas: 10 },
      });
    });
  });
});
