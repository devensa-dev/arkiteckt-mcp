/**
 * Cache Class with TTL Support
 *
 * Generic in-memory cache with time-to-live expiration.
 * Provides O(1) lookups with lazy expiration and optional max entries eviction.
 */

import type { CacheEntry, CacheOptions } from '../../shared/types/index.js';

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

/**
 * Default TTL in milliseconds (5 minutes)
 */
const DEFAULT_TTL = 300000;

/**
 * Generic cache with TTL support
 *
 * @example
 * ```typescript
 * const cache = new Cache<User>({ ttl: 60000 }); // 1 minute TTL
 * cache.set('user:123', { id: '123', name: 'Alice' });
 * const user = cache.get('user:123'); // Returns user or undefined if expired
 * ```
 */
export class Cache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtl: number;
  private readonly maxEntries: number | undefined;
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;

  constructor(options?: CacheOptions) {
    this.defaultTtl = options?.ttl ?? DEFAULT_TTL;
    this.maxEntries = options?.maxEntries;
  }

  /**
   * Store a value in the cache
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Optional TTL override in milliseconds
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict oldest entry if at capacity (only for new keys)
    if (this.maxEntries && this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictOldest();
    }

    this.store.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    });
  }

  /**
   * Retrieve a value from the cache
   *
   * Returns undefined if key doesn't exist or entry has expired.
   * Expired entries are automatically removed.
   *
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this._misses++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.store.delete(key);
      this._misses++;
      return undefined;
    }

    this._hits++;
    return entry.data;
  }

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key
   * @returns true if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   *
   * @param key - Cache key
   * @returns true if key was deleted
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get all cache keys (including potentially expired ones)
   *
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get the current number of entries (including potentially expired ones)
   *
   * @returns Number of entries
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats including hits, misses, size, and evictions
   */
  stats(): CacheStats {
    return {
      hits: this._hits,
      misses: this._misses,
      size: this.store.size,
      evictions: this._evictions,
    };
  }

  /**
   * Check if an entry has expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict the oldest entry from the cache
   */
  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this._evictions++;
    }
  }
}
