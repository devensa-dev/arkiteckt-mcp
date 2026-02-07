/**
 * Deep Merge Utility
 *
 * Provides deep merging of configuration objects with source tracking.
 * Used by the resolution engine to merge configurations across multiple layers.
 */

/**
 * Options for deep merge behavior
 */
export interface DeepMergeOptions {
  /** How to handle arrays: 'replace' (default) | 'concat' */
  arrayStrategy?: 'replace' | 'concat';
  /** Whether to track which source contributed each value */
  trackSources?: boolean;
}

/**
 * Source contribution tracking for a specific value
 */
export interface SourceContribution {
  /** File path that contributed this value */
  source: string;
  /** Dot-notation path to the contributed value (e.g., 'deployment.replicas') */
  path: string;
  /** The level in the merge hierarchy */
  level: 'global' | 'system' | 'service' | 'environment' | 'tenant';
}

/**
 * Result of deep merge operation
 */
export interface MergeResult<T> {
  /** The merged object */
  merged: T;
  /** Source contribution tracking (if trackSources=true) */
  contributions?: SourceContribution[] | undefined;
}

/**
 * Deep merge multiple objects with priority ordering
 *
 * Objects are merged in order: earlier sources provide defaults,
 * later sources override with more specific values.
 *
 * Merge rules:
 * - Objects: Deep merge recursively
 * - Arrays: Replace by default (or concat if arrayStrategy='concat')
 * - Primitives: Later value overrides earlier
 * - null: Explicit override (clears the value)
 * - undefined: Ignored (doesn't override)
 *
 * @param sources - Array of [sourceName, object] tuples, ordered by priority (lowest first)
 * @param options - Merge options
 * @returns Merged object with optional source tracking
 *
 * @example
 * ```typescript
 * const result = deepMerge([
 *   ['system.yaml', { replicas: 1, region: 'us-east-1' }],
 *   ['service.yaml', { replicas: 3 }],
 *   ['prod.yaml', { region: 'eu-west-1' }],
 * ]);
 * // result.merged = { replicas: 3, region: 'eu-west-1' }
 * ```
 */
export function deepMerge<T extends object>(
  sources: Array<[string, Partial<T> | undefined]>,
  options?: DeepMergeOptions
): MergeResult<T> {
  const opts: DeepMergeOptions = {
    arrayStrategy: options?.arrayStrategy ?? 'replace',
    trackSources: options?.trackSources ?? false,
  };

  const result = {} as T;
  const contributions: SourceContribution[] = [];

  // Track visited objects to detect circular references (reset per source)
  let visited = new WeakSet<object>();

  /**
   * Record a source contribution, replacing any previous contribution for the same path.
   */
  function trackContribution(sourceName: string, currentPath: string): void {
    const existingIdx = contributions.findIndex((c) => c.path === currentPath);
    if (existingIdx !== -1) {
      contributions.splice(existingIdx, 1);
    }
    contributions.push({
      source: sourceName,
      path: currentPath,
      level: inferLevel(sourceName),
    });
  }

  /**
   * Internal recursive merge function
   */
  function merge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
    sourceName: string,
    pathPrefix = ''
  ): void {
    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }

      const value = source[key];
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      // Handle undefined - skip it (doesn't override)
      if (value === undefined) {
        continue;
      }

      // Handle null - explicit override (clears value)
      if (value === null) {
        target[key] = null;
        if (opts.trackSources) {
          trackContribution(sourceName, currentPath);
        }
        continue;
      }

      const existing = target[key];

      // Handle arrays
      if (Array.isArray(value)) {
        if (opts.arrayStrategy === 'concat' && Array.isArray(existing)) {
          target[key] = [...existing, ...value];
        } else {
          target[key] = [...value]; // Clone to avoid reference issues
        }
        if (opts.trackSources) {
          trackContribution(sourceName, currentPath);
        }
        continue;
      }

      // Handle objects (deep merge)
      if (isPlainObject(value)) {
        // Detect circular references
        if (visited.has(value)) {
          continue;
        }
        visited.add(value);

        if (isPlainObject(existing)) {
          // Both are objects - recursive merge
          merge(existing as Record<string, unknown>, value as Record<string, unknown>, sourceName, currentPath);
        } else {
          // Existing is not an object - replace with new object
          target[key] = {};
          merge(target[key] as Record<string, unknown>, value as Record<string, unknown>, sourceName, currentPath);
          if (opts.trackSources) {
            trackContribution(sourceName, currentPath);
          }
        }
        continue;
      }

      // Handle primitives (string, number, boolean)
      target[key] = value;
      if (opts.trackSources) {
        trackContribution(sourceName, currentPath);
      }
    }
  }

  // Merge all sources in order
  for (const [sourceName, source] of sources) {
    if (source === undefined) {
      continue;
    }
    // Reset visited per source to allow the same object reference
    // (e.g., service.environments[env] extracted from the base service)
    // to be merged correctly across different sources
    visited = new WeakSet<object>();
    merge(result as Record<string, unknown>, source as Record<string, unknown>, sourceName);
  }

  return {
    merged: result,
    contributions: opts.trackSources ? contributions : undefined,
  };
}

/**
 * Check if value is a plain object (not array, Date, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check for plain object (not array, Date, etc.)
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Infer merge level from source name
 */
function inferLevel(sourceName: string): SourceContribution['level'] {
  if (sourceName.includes('system.yaml') || sourceName.includes('system/')) {
    return 'system';
  }
  if (sourceName.includes('services/') || sourceName.includes('service.yaml')) {
    return 'service';
  }
  if (sourceName.includes('environments/') || sourceName.includes('environment.yaml')) {
    return 'environment';
  }
  if (sourceName.includes('tenants/') || sourceName.includes('tenant.yaml')) {
    return 'tenant';
  }
  return 'global';
}
