/**
 * Architecture Store
 *
 * Main abstraction for reading architecture configuration files.
 * Provides caching, validation, and typed access to all architecture entities.
 */

import { join } from 'path';
import { readdir } from 'fs/promises';
import { Cache } from './cache.js';
import { YamlParser, type EntityType } from './yaml-parser.js';
import type {
  Result,
  ArchitectureError,
  FileError,
  CacheOptions,
  System,
  Service,
  Environment,
  Observability,
  CICD,
  Security,
  ADR,
  Tenant,
  Rule,
  RuleSet,
  Capability,
  CapabilitySet,
} from '../../shared/types/index.js';

/**
 * Architecture store configuration options
 */
export interface ArchitectureStoreOptions {
  baseDir: string;
  cache?: CacheOptions;
}

/**
 * Interface for architecture store operations
 */
export interface IArchitectureStore {
  // Single entities
  getSystem(): Promise<Result<System, ArchitectureError>>;
  getService(name: string): Promise<Result<Service, ArchitectureError>>;
  getEnvironment(name: string): Promise<Result<Environment, ArchitectureError>>;
  getObservability(): Promise<Result<Observability, ArchitectureError>>;
  getCICD(): Promise<Result<CICD, ArchitectureError>>;
  getSecurity(): Promise<Result<Security, ArchitectureError>>;
  getADR(id: string): Promise<Result<ADR, ArchitectureError>>;
  getTenant(name: string): Promise<Result<Tenant, ArchitectureError>>;

  // Collections
  getServices(): Promise<Result<Service[], ArchitectureError>>;
  getEnvironments(): Promise<Result<Environment[], ArchitectureError>>;
  getADRs(): Promise<Result<ADR[], ArchitectureError>>;
  getTenants(): Promise<Result<Tenant[], ArchitectureError>>;
  getRules(): Promise<Result<Rule[], ArchitectureError>>;
  getCapabilities(): Promise<Result<Capability[], ArchitectureError>>;

  // Cache management
  invalidateCache(): void;
  invalidateCacheKey(key: string): void;
}

/**
 * Architecture Store implementation
 *
 * Reads architecture configuration files from the file system,
 * validates them against Zod schemas, and caches results.
 *
 * @example
 * ```typescript
 * const store = new ArchitectureStore({ baseDir: '/path/to/project' });
 * const system = await store.getSystem();
 * if (system.success) {
 *   console.log(system.data.name);
 * }
 * ```
 */
export class ArchitectureStore implements IArchitectureStore {
  private readonly baseDir: string;
  private readonly cache: Cache<unknown>;
  private readonly parser: YamlParser;

  constructor(options: ArchitectureStoreOptions) {
    this.baseDir = options.baseDir;
    this.cache = new Cache(options.cache);
    this.parser = new YamlParser();
  }

  // ============================================================================
  // Single Entity Methods
  // ============================================================================

  async getSystem(): Promise<Result<System, ArchitectureError>> {
    return this.loadSingleEntity<System>('system', 'system.yaml');
  }

  async getService(name: string): Promise<Result<Service, ArchitectureError>> {
    return this.loadSingleEntity<Service>('service', `services/${name}.yaml`, name);
  }

  async getEnvironment(name: string): Promise<Result<Environment, ArchitectureError>> {
    return this.loadSingleEntity<Environment>('environment', `environments/${name}.yaml`, name);
  }

  async getObservability(): Promise<Result<Observability, ArchitectureError>> {
    return this.loadSingleEntity<Observability>('observability', 'observability.yaml');
  }

  async getCICD(): Promise<Result<CICD, ArchitectureError>> {
    return this.loadSingleEntity<CICD>('cicd', 'cicd.yaml');
  }

  async getSecurity(): Promise<Result<Security, ArchitectureError>> {
    return this.loadSingleEntity<Security>('security', 'security.yaml');
  }

  async getADR(id: string): Promise<Result<ADR, ArchitectureError>> {
    return this.loadSingleEntity<ADR>('adr', `adrs/${id}.yaml`, id);
  }

  async getTenant(name: string): Promise<Result<Tenant, ArchitectureError>> {
    return this.loadSingleEntity<Tenant>('tenant', `tenants/${name}.yaml`, name);
  }

  // ============================================================================
  // Collection Methods
  // ============================================================================

  async getServices(): Promise<Result<Service[], ArchitectureError>> {
    return this.loadCollection<Service>('service', 'services');
  }

  async getEnvironments(): Promise<Result<Environment[], ArchitectureError>> {
    return this.loadCollection<Environment>('environment', 'environments');
  }

  async getADRs(): Promise<Result<ADR[], ArchitectureError>> {
    return this.loadCollection<ADR>('adr', 'adrs');
  }

  async getTenants(): Promise<Result<Tenant[], ArchitectureError>> {
    return this.loadCollection<Tenant>('tenant', 'tenants');
  }

  async getRules(): Promise<Result<Rule[], ArchitectureError>> {
    const cacheKey = 'rules:__all__';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { success: true, data: cached as Rule[] };
    }

    const dirPath = join(this.baseDir, 'architecture', 'rules');
    const setResult = await this.loadCollectionRaw<RuleSet>(dirPath, 'ruleset');

    if (!setResult.success) {
      return setResult;
    }

    // Flatten RuleSets into individual Rules
    const rules: Rule[] = setResult.data.flatMap((ruleSet) => ruleSet.rules);
    this.cache.set(cacheKey, rules);
    return { success: true, data: rules };
  }

  async getCapabilities(): Promise<Result<Capability[], ArchitectureError>> {
    const cacheKey = 'capabilities:__all__';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { success: true, data: cached as Capability[] };
    }

    const dirPath = join(this.baseDir, 'architecture', 'capabilities');
    const setResult = await this.loadCollectionRaw<CapabilitySet>(dirPath, 'capabilityset');

    if (!setResult.success) {
      return setResult;
    }

    // Flatten CapabilitySets into individual Capabilities
    const capabilities: Capability[] = setResult.data.flatMap(
      (capabilitySet) => capabilitySet.capabilities
    );
    this.cache.set(cacheKey, capabilities);
    return { success: true, data: capabilities };
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  invalidateCache(): void {
    this.cache.clear();
  }

  invalidateCacheKey(key: string): void {
    this.cache.delete(key);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Load a single entity file with caching
   */
  private async loadSingleEntity<T>(
    entityType: EntityType,
    relativePath: string,
    identifier?: string
  ): Promise<Result<T, ArchitectureError>> {
    const cacheKey = `${entityType}:${identifier ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { success: true, data: cached as T };
    }

    const filePath = join(this.baseDir, 'architecture', relativePath);
    const result = await this.parser.parseFile<T>(filePath, entityType);

    if (result.success) {
      this.cache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Load all entities from a directory with caching
   */
  private async loadCollection<T>(
    entityType: EntityType,
    dirName: string
  ): Promise<Result<T[], ArchitectureError>> {
    const cacheKey = `${entityType}:__all__`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { success: true, data: cached as T[] };
    }

    const dirPath = join(this.baseDir, 'architecture', dirName);
    const result = await this.loadCollectionRaw<T>(dirPath, entityType);

    if (result.success) {
      this.cache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Load all files from a directory without caching
   */
  private async loadCollectionRaw<T>(
    dirPath: string,
    entityType: EntityType
  ): Promise<Result<T[], ArchitectureError>> {
    try {
      const files = await readdir(dirPath);
      const yamlFiles = files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

      const results: T[] = [];
      for (const file of yamlFiles) {
        const filePath = join(dirPath, file);
        const result = await this.parser.parseFile<T>(filePath, entityType);

        if (!result.success) {
          return result;
        }

        results.push(result.data);
      }

      return { success: true, data: results };
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;

      if (nodeErr.code === 'ENOENT') {
        return {
          success: false,
          error: {
            type: 'file',
            message: `Directory not found: ${dirPath}`,
            filePath: dirPath,
            code: 'ENOENT',
          },
        };
      }

      if (nodeErr.code === 'EACCES') {
        return {
          success: false,
          error: {
            type: 'file',
            message: `Permission denied: ${dirPath}`,
            filePath: dirPath,
            code: 'EACCES',
          },
        };
      }

      const fileError: FileError = {
        type: 'file',
        message: err instanceof Error ? err.message : 'Unknown file system error',
        filePath: dirPath,
      };
      if (nodeErr.code) {
        fileError.code = nodeErr.code;
      }
      return { success: false, error: fileError };
    }
  }
}
