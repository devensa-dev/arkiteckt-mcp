/**
 * Impact Analyzer
 *
 * Analyzes downstream effects of architecture changes.
 * Used by write tools to provide impact analysis before committing changes.
 */

import type { ArchitectureStore } from '../store/architecture-store.js';
import type {
  Service,
  System,
  DeploymentPattern,
  ServiceImpact,
  FieldChange,
  ArtifactsDelta,
  Capability,
} from '../../shared/types/index.js';
import { buildDependencyGraph } from './cycle-detector.js';
import { deepMerge } from './deep-merge.js';

/**
 * Result of service deletion analysis
 */
export interface ServiceDeletionAnalysis {
  /** Services that depend on the service being deleted */
  dependents: string[];
  /** Whether the service can be safely deleted */
  canDelete: boolean;
  /** Warning message if there are dependents */
  message?: string;
}

/**
 * Result of environment deletion analysis
 */
export interface EnvironmentDeletionAnalysis {
  /** Services with orphaned environment-specific overrides */
  orphanedOverrides: Array<{
    service: string;
    envKey: string;
  }>;
  /** Warning message about orphaned configs */
  message?: string;
}

/**
 * Impact Analyzer
 *
 * Provides methods to analyze the downstream effects of architecture changes.
 */
export class ImpactAnalyzer {
  constructor(private readonly store: ArchitectureStore) {}

  /**
   * Analyze the impact of deleting a service
   *
   * Scans all services to find which ones depend on the service being deleted.
   *
   * @param serviceName - Service to be deleted
   * @returns Analysis result with dependents list
   */
  async analyzeServiceDeletion(serviceName: string): Promise<ServiceDeletionAnalysis> {
    const graph = await buildDependencyGraph(this.store);
    const dependents: string[] = [];

    for (const [service, deps] of graph.entries()) {
      if (service !== serviceName && deps.includes(serviceName)) {
        dependents.push(service);
      }
    }

    const canDelete = dependents.length === 0;
    const message = canDelete
      ? undefined
      : `Cannot delete service '${serviceName}'. The following services depend on it: ${dependents.join(', ')}`;

    return {
      dependents,
      canDelete,
      message,
    };
  }

  /**
   * Analyze the impact of changing system defaults
   *
   * Identifies which services will be affected by changes to system-level defaults.
   * Only services that don't explicitly override the changed defaults are affected.
   *
   * @param oldDefaults - Previous system defaults
   * @param newDefaults - New system defaults
   * @returns Array of affected services with field changes
   */
  async analyzeSystemDefaultsChange(
    oldDefaults: Partial<System['defaults']>,
    newDefaults: Partial<System['defaults']>
  ): Promise<ServiceImpact[]> {
    const servicesResult = await this.store.getServices();
    if (!servicesResult.success) {
      return [];
    }

    const affectedServices: ServiceImpact[] = [];

    for (const service of servicesResult.data) {
      const fields: FieldChange[] = [];

      // Check if runtime defaults changed and service doesn't override them
      if (oldDefaults.runtime && newDefaults.runtime) {
        if (!service.runtime) {
          // Service inherits all runtime defaults
          if (oldDefaults.runtime.language !== newDefaults.runtime.language) {
            fields.push({
              path: 'runtime.language',
              before: oldDefaults.runtime.language,
              after: newDefaults.runtime.language,
            });
          }
          if (oldDefaults.runtime.version !== newDefaults.runtime.version) {
            fields.push({
              path: 'runtime.version',
              before: oldDefaults.runtime.version,
              after: newDefaults.runtime.version,
            });
          }
        }
      }

      if (fields.length > 0) {
        affectedServices.push({
          name: service.name,
          reason: 'Inherits changed system defaults',
          fields,
        });
      }
    }

    return affectedServices;
  }

  /**
   * Analyze the impact of changing a service's deployment pattern
   *
   * Computes the artifact delta (added/removed artifacts) when a deployment pattern changes.
   *
   * @param service - Service being updated
   * @param oldPattern - Previous deployment pattern
   * @param newPattern - New deployment pattern
   * @returns Artifact delta with added/removed artifacts
   */
  async analyzeDeploymentPatternChange(
    service: Service,
    oldPattern: DeploymentPattern,
    newPattern: DeploymentPattern
  ): Promise<ArtifactsDelta> {
    const capabilitiesResult = await this.store.getCapabilities();
    if (!capabilitiesResult.success) {
      return { added: [], removed: [] };
    }

    const capabilities = capabilitiesResult.data;

    // Find capability definitions for old and new patterns
    const oldCapability = capabilities.find(
      (cap) => cap.deploymentPattern === oldPattern && cap.serviceType === service.type
    );
    const newCapability = capabilities.find(
      (cap) => cap.deploymentPattern === newPattern && cap.serviceType === service.type
    );

    const oldArtifacts = oldCapability?.artifacts ?? [];
    const newArtifacts = newCapability?.artifacts ?? [];

    // Compute added artifacts (in new but not in old)
    const added = newArtifacts.filter(
      (newArt) => !oldArtifacts.some((oldArt) => oldArt.type === newArt.type)
    );

    // Compute removed artifacts (in old but not in new)
    const removed = oldArtifacts.filter(
      (oldArt) => !newArtifacts.some((newArt) => newArt.type === oldArt.type)
    );

    return { added, removed };
  }

  /**
   * Analyze the impact of deleting an environment
   *
   * Scans all services to find orphaned environment-specific overrides.
   *
   * @param envName - Environment to be deleted
   * @returns Analysis result with orphaned overrides
   */
  async analyzeEnvironmentDeletion(envName: string): Promise<EnvironmentDeletionAnalysis> {
    const servicesResult = await this.store.getServices();
    if (!servicesResult.success) {
      return { orphanedOverrides: [] };
    }

    const orphanedOverrides: Array<{ service: string; envKey: string }> = [];

    for (const service of servicesResult.data) {
      if (service.environments && envName in service.environments) {
        orphanedOverrides.push({
          service: service.name,
          envKey: envName,
        });
      }
    }

    const message =
      orphanedOverrides.length > 0
        ? `Deleting environment '${envName}' will leave orphaned overrides in: ${orphanedOverrides.map((o) => o.service).join(', ')}`
        : undefined;

    return {
      orphanedOverrides,
      message,
    };
  }
}
