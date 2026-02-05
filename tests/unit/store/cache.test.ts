import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache } from '../../../src/core/store/cache.js';

describe('Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should set and get a value', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      const cache = new Cache<string>();

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      expect(cache.get('key1')).toBe('value2');
    });

    it('should delete values', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');

      const deleted = cache.delete('key1');

      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false when deleting non-existent key', () => {
      const cache = new Cache<string>();

      const deleted = cache.delete('nonexistent');

      expect(deleted).toBe(false);
    });

    it('should clear all values', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });

    it('should report correct size', () => {
      const cache = new Cache<string>();

      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });

    it('should list all keys', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const keys = cache.keys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('should handle complex object values', () => {
      interface User {
        id: string;
        name: string;
        tags: string[];
      }

      const cache = new Cache<User>();
      const user: User = { id: '123', name: 'Alice', tags: ['admin', 'active'] };
      cache.set('user:123', user);

      const retrieved = cache.get('user:123');

      expect(retrieved).toEqual(user);
    });
  });

  describe('has method', () => {
    it('should return true for existing non-expired key', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      const cache = new Cache<string>();

      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired key', () => {
      const cache = new Cache<string>({ ttl: 1000 });
      cache.set('key1', 'value1');

      vi.advanceTimersByTime(1500);

      expect(cache.has('key1')).toBe(false);
    });

    it('should remove expired entry when checking has', () => {
      const cache = new Cache<string>({ ttl: 1000 });
      cache.set('key1', 'value1');

      vi.advanceTimersByTime(1500);

      cache.has('key1');

      expect(cache.size()).toBe(0);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      const cache = new Cache<string>({ ttl: 1000 });
      cache.set('key1', 'value1');

      vi.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(600);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use default TTL when not specified', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');

      // Default is 5 minutes (300000ms)
      vi.advanceTimersByTime(299000);
      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(2000);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use custom TTL when specified on set', () => {
      const cache = new Cache<string>({ ttl: 5000 });
      cache.set('key1', 'value1', 1000);

      vi.advanceTimersByTime(1500);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should treat get on expired entry as miss', () => {
      const cache = new Cache<string>({ ttl: 1000 });
      cache.set('key1', 'value1');

      // First get - hit
      cache.get('key1');
      expect(cache.stats().hits).toBe(1);

      vi.advanceTimersByTime(1500);

      // Second get on expired - miss
      cache.get('key1');
      expect(cache.stats().misses).toBe(1);
    });

    it('should remove expired entries on get', () => {
      const cache = new Cache<string>({ ttl: 1000 });
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(1500);

      cache.get('key1');

      expect(cache.size()).toBe(1); // key1 removed, key2 still there (not accessed)
    });
  });

  describe('max entries eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const cache = new Cache<string>({ maxEntries: 2 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.size()).toBe(2);
    });

    it('should not evict when updating existing key', () => {
      const cache = new Cache<string>({ maxEntries: 2 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key1', 'updated');

      expect(cache.get('key1')).toBe('updated');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.size()).toBe(2);
      expect(cache.stats().evictions).toBe(0);
    });

    it('should track eviction count in stats', () => {
      const cache = new Cache<string>({ maxEntries: 2 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');

      expect(cache.stats().evictions).toBe(2);
    });

    it('should evict based on oldest timestamp', () => {
      const cache = new Cache<string>({ maxEntries: 3 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(100);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(100);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(100);

      // This should evict key1 (oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('stats', () => {
    it('should track hits correctly', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');

      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      expect(cache.stats().hits).toBe(3);
    });

    it('should track misses correctly', () => {
      const cache = new Cache<string>();

      cache.get('nonexistent1');
      cache.get('nonexistent2');

      expect(cache.stats().misses).toBe(2);
    });

    it('should track evictions correctly', () => {
      const cache = new Cache<string>({ maxEntries: 1 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.stats().evictions).toBe(2);
    });

    it('should report correct size', () => {
      const cache = new Cache<string>();

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.stats().size).toBe(2);
    });

    it('should count expired gets as misses', () => {
      const cache = new Cache<string>({ ttl: 1000 });
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      vi.advanceTimersByTime(1500);
      cache.get('key1'); // miss (expired)

      expect(cache.stats().hits).toBe(1);
      expect(cache.stats().misses).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string key', () => {
      const cache = new Cache<string>();
      cache.set('', 'empty-key-value');

      expect(cache.get('')).toBe('empty-key-value');
    });

    it('should handle null value', () => {
      const cache = new Cache<string | null>();
      cache.set('key1', null);

      expect(cache.get('key1')).toBeNull();
    });

    it('should handle undefined value', () => {
      const cache = new Cache<string | undefined>();
      cache.set('key1', undefined);

      // Note: undefined stored value is retrievable (different from "not found")
      expect(cache.has('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      // But stats show a hit, not a miss
      expect(cache.stats().hits).toBe(1);
    });

    it('should handle very short TTL', () => {
      const cache = new Cache<string>({ ttl: 1 });
      cache.set('key1', 'value1');

      vi.advanceTimersByTime(2);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should work without options', () => {
      const cache = new Cache();
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');
    });
  });
});
