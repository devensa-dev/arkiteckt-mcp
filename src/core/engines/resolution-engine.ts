/**
 * Resolution Engine
 *
 * Merges configuration from multiple sources with proper priority ordering:
 * System → Service → Service.environments → Environment → Tenant → Tenant.environments → Tenant.services
 *
 * Implements FR-004: Merge order Tenant → Environment → Service → System → Global
 * (in the merge array, later items override earlier items)
 */

import { ArchitectureStore } from '../store/architecture-store.js';
import { deepMerge } from './deep-merge.js';
import { detectServiceDependencyCycle, buildDependencyGraph } from './cycle-detector.js';
import type {
  Result,
  ArchitectureError,
  Service,
  Environment,
  Tenant,
  GlobalDefaults,
} from '../../shared/types/index.js';

/**
 * Fully resolved service configuration with all overrides applied
 *
 * This type represents the result of merging:
 * - System defaults
 * - Base service config
 * - Service environment-specific overrides
 * - Environment config
 * - Tenant global overrides
 * - Tenant environment-specific overrides
 * - Tenant service-specific overrides
 */
export interface ResolvedServiceContext {
  /** The merged service configuration */
  service: Service;

  /** Environment configuration (if resolved) */
  environment?: Environment | undefined;

  /** Tenant configuration (if resolved) */
  tenant?: Tenant | undefined;

  /** System defaults that were applied */
  systemDefaults?: GlobalDefaults | undefined;

  /** Sources that contributed to this resolution (in merge order) */
  sources: string[];

  /** ISO timestamp when resolution occurred */
  resolvedAt: string;
}

/**
 * Fully resolved environment configuration with tenant overrides applied
 *
 * Merge order:
 * 1. environments/{name}.yaml → base environment config
 * 2. tenants/{tenant}.yaml#environments.{name} → tenant env overrides (HIGHEST)
 */
export interface ResolvedEnvironmentContext {
  /** The merged environment configuration */
  environment: Environment;

  /** Tenant configuration (if resolved) */
  tenant?: Tenant | undefined;

  /** Sources that contributed to this resolution (in merge order) */
  sources: string[];

  /** ISO timestamp when resolution occurred */
  resolvedAt: string;
}

/**
 * Resolution error type
 */
export interface ResolutionError {
  type: 'validation';
  message: string;
  path: string;
  code?: 'CIRCULAR_DEPENDENCY' | 'MISSING_REFERENCE';
  details?: {
    cycle?: string[];
    missingEntity?: string;
  };
}

/**
 * Resolution Engine
 *
 * Resolves complete service context by merging configurations
 * from multiple sources following the spec-defined priority order.
 *
 * @example
 * ```typescript
 * const store = new ArchitectureStore({ baseDir: '/path/to/project' });
 * const engine = new ResolutionEngine(store);
 * const resolved = await engine.resolveServiceContext('api-service', 'prod');
 * if (resolved.success) {
 *   console.log(resolved.data.service); // Merged service config
 *   console.log(resolved.data.sources);  // Which files contributed
 * }
 * ```
 */
export class ResolutionEngine {
  constructor(private readonly store: ArchitectureStore) {}

  /**
   * Resolve complete service context with all overrides applied
   *
   * Merge order (earliest to latest, later overrides earlier):
   * 1. system.yaml → defaults (global runtime, region, tags)
   * 2. services/{name}.yaml → base service config
   * 3. services/{name}.yaml#environments.{env} → service env overrides
   * 4. environments/{env}.yaml → environment defaults
   * 5. tenants/{tenant}.yaml → tenant global overrides
   * 6. tenants/{tenant}.yaml#environments.{env} → tenant env overrides
   * 7. tenants/{tenant}.yaml#services.{svc} → tenant service overrides (HIGHEST)
   *
   * @param serviceName - Name of the service to resolve
   * @param environmentName - Optional environment for env-specific overrides
   * @param tenantName - Optional tenant for tenant-specific overrides
   * @returns ResolvedServiceContext or ArchitectureError
   */
  async resolveServiceContext(
    serviceName: string,
    environmentName?: string,
    tenantName?: string
  ): Promise<Result<ResolvedServiceContext, ArchitectureError>> {
    const sources: Array<[string, Partial<Service>]> = [];
    const sourceNames: string[] = [];

    // Step 1: Load System defaults (global level)
    const systemResult = await this.store.getSystem();
    let systemDefaults: GlobalDefaults | undefined;

    if (systemResult.success && systemResult.data.defaults) {
      // Map GlobalDefaults to Service-compatible structure
      const defaults = systemResult.data.defaults;
      const serviceDefaults: Partial<Service> = {
        runtime: defaults.runtime,
        cloud: {
          region: defaults.region,
          account: defaults.account,
        },
        tags: defaults.tags,
      };
      sources.push(['architecture/system.yaml', serviceDefaults]);
      sourceNames.push('architecture/system.yaml');
      systemDefaults = systemResult.data.defaults;
    }

    // Step 2: Load base Service config
    const serviceResult = await this.store.getService(serviceName);

    if (!serviceResult.success) {
      return serviceResult; // Return the error from store
    }

    const baseService = serviceResult.data;
    sources.push([`architecture/services/${serviceName}.yaml`, baseService]);
    sourceNames.push(`architecture/services/${serviceName}.yaml`);

    // Step 3: Apply Service's own environment overrides (if present)
    if (environmentName && baseService.environments) {
      const serviceEnvOverride = baseService.environments[environmentName];
      if (serviceEnvOverride) {
        sources.push([
          `architecture/services/${serviceName}.yaml#environments.${environmentName}`,
          serviceEnvOverride as Partial<Service>,
        ]);
        sourceNames.push(`architecture/services/${serviceName}.yaml#environments.${environmentName}`);
      }
    }

    // Step 4: Load Environment config (if specified)
    let environmentData: Environment | undefined;
    if (environmentName) {
      const envResult = await this.store.getEnvironment(environmentName);

      if (envResult.success) {
        environmentData = envResult.data;
        // Environment provides cross-cutting concerns like availability, scaling
        const envOverrides = {
          availability: envResult.data.availability,
          scaling: envResult.data.scaling,
          security: envResult.data.security,
          resources: envResult.data.resources,
        };
        sources.push([`architecture/environments/${environmentName}.yaml`, envOverrides as Partial<Service>]);
        sourceNames.push(`architecture/environments/${environmentName}.yaml`);
      }
      // Environment file is optional — if not found, continue with
      // service-level environment overrides (Step 3) only
    }

    // Step 5-7: Load Tenant config and overrides (if specified)
    let tenantData: Tenant | undefined;
    if (tenantName) {
      // Check for circular dependencies before resolving tenant
      const dependencyGraph = await buildDependencyGraph(this.store);
      const cycleCheck = detectServiceDependencyCycle(serviceName, dependencyGraph);

      if (cycleCheck.hasCycle) {
        return {
          success: false,
          error: {
            type: 'validation',
            message: cycleCheck.message ?? 'Circular dependency detected',
            path: 'dependencies',
            code: 'CIRCULAR_DEPENDENCY',
            details: {
              cycle: cycleCheck.cycle,
            },
          } as ResolutionError,
        };
      }

      const tenantResult = await this.store.getTenant(tenantName);

      if (tenantResult.success) {
        tenantData = tenantResult.data;

        // Step 5: Tenant global overrides (cloud config, compliance, etc.)
        const tenantGlobal = {
          cloud: tenantResult.data.cloud,
          compliance: tenantResult.data.compliance,
          quotas: tenantResult.data.quotas,
        };
        sources.push([`architecture/tenants/${tenantName}.yaml`, tenantGlobal as Partial<Service>]);
        sourceNames.push(`architecture/tenants/${tenantName}.yaml`);

        // Step 6: Tenant environment-specific overrides
        if (environmentName && tenantResult.data.environments) {
          const tenantEnvOverride = tenantResult.data.environments[environmentName];
          if (tenantEnvOverride) {
            sources.push([
              `architecture/tenants/${tenantName}.yaml#environments.${environmentName}`,
              tenantEnvOverride as Partial<Service>,
            ]);
            sourceNames.push(`architecture/tenants/${tenantName}.yaml#environments.${environmentName}`);
          }
        }

        // Step 7: Tenant service-specific overrides (HIGHEST PRIORITY)
        if (tenantResult.data.services) {
          const tenantServiceOverride = tenantResult.data.services[serviceName];
          if (tenantServiceOverride) {
            sources.push([
              `architecture/tenants/${tenantName}.yaml#services.${serviceName}`,
              tenantServiceOverride as Partial<Service>,
            ]);
            sourceNames.push(`architecture/tenants/${tenantName}.yaml#services.${serviceName}`);
          }
        }
      } else {
        // Non-existent tenant - return error with available tenants
        const allTenants = await this.store.getTenants();
        const available = allTenants.success ? allTenants.data.map((t) => t.name).join(', ') : 'none';

        return {
          success: false,
          error: {
            type: 'validation',
            message: `Tenant '${tenantName}' not found. Available tenants: ${available}`,
            path: 'tenant',
            code: 'MISSING_REFERENCE',
            details: {
              missingEntity: tenantName,
            },
          } as ResolutionError,
        };
      }
    }

    // Step 8: Deep merge all sources
    const mergeResult = deepMerge<Service>(sources);

    return {
      success: true,
      data: {
        service: mergeResult.merged,
        environment: environmentData,
        tenant: tenantData,
        systemDefaults,
        sources: sourceNames,
        resolvedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Resolve environment context with optional tenant overrides
   *
   * Merge order (earliest to latest, later overrides earlier):
   * 1. environments/{name}.yaml → base environment config
   * 2. tenants/{tenant}.yaml#environments.{name} → tenant env overrides
   *
   * @param environmentName - Name of the environment to resolve
   * @param tenantName - Optional tenant for tenant-specific overrides
   * @returns ResolvedEnvironmentContext or ArchitectureError
   */
  async resolveEnvironmentContext(
    environmentName: string,
    tenantName?: string
  ): Promise<Result<ResolvedEnvironmentContext, ArchitectureError>> {
    const sourceNames: string[] = [];

    // Step 1: Load base environment config
    const envResult = await this.store.getEnvironment(environmentName);

    if (!envResult.success) {
      // Non-existent environment - return error with available environments
      if (envResult.error.type === 'file' && envResult.error.message.includes('not found')) {
        const allEnvs = await this.store.getEnvironments();
        const available = allEnvs.success ? allEnvs.data.map((e) => e.name).join(', ') : 'none';

        return {
          success: false,
          error: {
            type: 'validation',
            message: `Environment '${environmentName}' not found. Available environments: ${available}`,
            path: 'environment',
            code: 'MISSING_REFERENCE',
            details: {
              missingEntity: environmentName,
            },
          } as ResolutionError,
        };
      }
      return envResult;
    }

    sourceNames.push(`architecture/environments/${environmentName}.yaml`);

    // If no tenant, return the raw environment directly
    if (!tenantName) {
      return {
        success: true,
        data: {
          environment: envResult.data,
          sources: sourceNames,
          resolvedAt: new Date().toISOString(),
        },
      };
    }

    // Step 2: Load tenant and apply environment-specific overrides
    const tenantResult = await this.store.getTenant(tenantName);

    if (!tenantResult.success) {
      // Non-existent tenant - return error with available tenants
      const allTenants = await this.store.getTenants();
      const available = allTenants.success ? allTenants.data.map((t) => t.name).join(', ') : 'none';

      return {
        success: false,
        error: {
          type: 'validation',
          message: `Tenant '${tenantName}' not found. Available tenants: ${available}`,
          path: 'tenant',
          code: 'MISSING_REFERENCE',
          details: {
            missingEntity: tenantName,
          },
        } as ResolutionError,
      };
    }

    sourceNames.push(`architecture/tenants/${tenantName}.yaml`);

    // Check for tenant environment-specific overrides
    const tenantEnvOverride = tenantResult.data.environments?.[environmentName];

    if (tenantEnvOverride) {
      // Deep merge base environment with tenant overrides
      const sources: Array<[string, Partial<Environment>]> = [
        [`architecture/environments/${environmentName}.yaml`, envResult.data],
        [
          `architecture/tenants/${tenantName}.yaml#environments.${environmentName}`,
          tenantEnvOverride as Partial<Environment>,
        ],
      ];

      sourceNames.push(`architecture/tenants/${tenantName}.yaml#environments.${environmentName}`);
      const mergeResult = deepMerge<Environment>(sources);

      return {
        success: true,
        data: {
          environment: mergeResult.merged,
          tenant: tenantResult.data,
          sources: sourceNames,
          resolvedAt: new Date().toISOString(),
        },
      };
    }

    // Tenant exists but has no overrides for this environment
    return {
      success: true,
      data: {
        environment: envResult.data,
        tenant: tenantResult.data,
        sources: sourceNames,
        resolvedAt: new Date().toISOString(),
      },
    };
  }
}
