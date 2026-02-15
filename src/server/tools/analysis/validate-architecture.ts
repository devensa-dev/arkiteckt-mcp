/**
 * validate_architecture MCP Tool
 *
 * Performs cross-entity validation to ensure architecture consistency.
 * Checks: dependency references, cycles, schema validation, environment refs,
 * SLO definitions, resilience config, security consistency, orphaned configs.
 *
 * User Story 6: Validate cross-entity consistency and check service readiness
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { buildDependencyGraph, wouldCreateCycle } from '../../../core/engines/cycle-detector.js';
import {
  ServiceSchema,
  EnvironmentSchema,
  SystemSchema,
} from '../../../core/schemas/index.js';
import type {
  ValidationReport,
  ValidationIssue,
  ToolResponse,
  ResponseMetadata,
  Service,
  Environment,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const validateArchitectureTool = {
  name: 'validate_architecture',
  config: {
    title: 'Validate Architecture',
    description:
      'Perform cross-entity validation checks on the architecture. Validates dependency references, detects cycles, checks schema compliance, and identifies orphaned configurations.',
    inputSchema: z.object({
      scope: z
        .enum(['all', 'services', 'environments', 'dependencies', 'security'])
        .optional()
        .default('all')
        .describe('Validation scope'),
    }),
  },
};

/**
 * Input parameters for validate_architecture
 */
export interface ValidateArchitectureInput {
  scope?: 'all' | 'services' | 'environments' | 'dependencies' | 'security';
}

/**
 * Options for the validateArchitecture handler
 */
export interface ValidateArchitectureOptions {
  baseDir: string;
}

/**
 * Validate all service dependencies reference existing services
 *
 * @param services - All services in the architecture
 * @returns Array of validation issues
 */
function validateDependencyReferences(services: Service[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const serviceNames = new Set(services.map((s) => s.name));

  for (const service of services) {
    if (!service.dependencies) continue;

    for (let i = 0; i < service.dependencies.length; i++) {
      const dep = service.dependencies[i];
      if (!serviceNames.has(dep.name)) {
        issues.push({
          severity: 'error',
          entity: service.name,
          entityType: 'service',
          path: `dependencies[${i}].name`,
          message: `Dependency "${dep.name}" does not exist`,
          suggestion: `Remove the dependency or create the ${dep.name} service`,
        });
      }
    }
  }

  return issues;
}

/**
 * Detect circular dependencies in the dependency graph
 *
 * @param store - Architecture store instance
 * @returns Array of validation issues
 */
async function validateNoCycles(store: ArchitectureStore): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const graph = await buildDependencyGraph(store);

  // Check each service for cycles
  for (const service of graph.keys()) {
    const servicesResult = await store.getServices();
    if (!servicesResult.success) continue;

    const serviceData = servicesResult.data.find((s) => s.name === service);
    if (!serviceData?.dependencies) continue;

    for (const dep of serviceData.dependencies) {
      const cycleResult = wouldCreateCycle(service, dep.name, graph);
      if (cycleResult.hasCycle) {
        issues.push({
          severity: 'error',
          entity: service,
          entityType: 'service',
          path: 'dependencies',
          message: `Circular dependency detected: ${service} → ${dep.name}`,
          suggestion: 'Remove or restructure dependencies to eliminate the cycle',
        });
      }
    }
  }

  return issues;
}

/**
 * Validate all entities against their schemas
 *
 * @param store - Architecture store instance
 * @returns Array of validation issues
 */
async function validateSchemas(store: ArchitectureStore): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Validate system
  const systemResult = await store.getSystem();
  if (systemResult.success) {
    const validation = SystemSchema.safeParse(systemResult.data);
    if (!validation.success) {
      issues.push({
        severity: 'error',
        entity: 'system',
        entityType: 'system',
        path: '',
        message: `Schema validation failed: ${validation.error.message}`,
      });
    }
  }

  // Validate all services
  const servicesResult = await store.getServices();
  if (servicesResult.success) {
    for (const service of servicesResult.data) {
      const validation = ServiceSchema.safeParse(service);
      if (!validation.success) {
        issues.push({
          severity: 'error',
          entity: service.name,
          entityType: 'service',
          path: '',
          message: `Schema validation failed: ${validation.error.message}`,
        });
      }
    }
  }

  // Validate all environments
  const environmentsResult = await store.getEnvironments();
  if (environmentsResult.success) {
    for (const env of environmentsResult.data) {
      const validation = EnvironmentSchema.safeParse(env);
      if (!validation.success) {
        issues.push({
          severity: 'error',
          entity: env.name,
          entityType: 'environment',
          path: '',
          message: `Schema validation failed: ${validation.error.message}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Validate environment references in service configs
 *
 * @param services - All services
 * @param environments - All environments
 * @returns Array of validation issues
 */
function validateEnvironmentReferences(
  services: Service[],
  environments: Environment[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const envNames = new Set(environments.map((e) => e.name));

  for (const service of services) {
    if (!service.environments) continue;

    for (const envName of Object.keys(service.environments)) {
      if (!envNames.has(envName)) {
        issues.push({
          severity: 'error',
          entity: service.name,
          entityType: 'service',
          path: `environments.${envName}`,
          message: `Environment "${envName}" does not exist`,
          suggestion: `Remove the override or create the ${envName} environment`,
        });
      }
    }
  }

  return issues;
}

/**
 * Check for missing SLO definitions in production services
 *
 * @param services - All services
 * @returns Array of validation issues (warnings)
 */
function validateSLODefinitions(services: Service[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const service of services) {
    // Check if service has production environment override
    const hasProdOverride = service.environments && 'prod' in service.environments;

    if (hasProdOverride || service.type === 'api' || service.type === 'web') {
      if (!service.observability?.slo) {
        issues.push({
          severity: 'warning',
          entity: service.name,
          entityType: 'service',
          path: 'observability.slo',
          message: 'No SLO defined for production service',
          suggestion: 'Add availability and latency SLO targets',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for appropriate resilience configuration based on dependency count
 *
 * @param services - All services
 * @returns Array of validation issues (info)
 */
function validateResilienceConfig(services: Service[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const service of services) {
    const depCount = service.dependencies?.length || 0;

    if (depCount >= 3 && !service.resilience) {
      issues.push({
        severity: 'info',
        entity: service.name,
        entityType: 'service',
        path: 'resilience',
        message: `Service has ${depCount} dependencies but no resilience configuration`,
        suggestion: 'Consider adding circuit breaker, retry, or timeout configurations',
      });
    }
  }

  return issues;
}

/**
 * Validate security level consistency across environments and services
 *
 * @param services - All services
 * @param environments - All environments
 * @returns Array of validation issues
 */
function validateSecurityConsistency(
  services: Service[],
  environments: Environment[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check that production environments don't use "relaxed" security
  for (const env of environments) {
    if (env.name === 'prod' || env.name === 'production') {
      if (env.security?.level === 'relaxed') {
        issues.push({
          severity: 'error',
          entity: env.name,
          entityType: 'environment',
          path: 'security.level',
          message: 'Production environment cannot use "relaxed" security level',
          suggestion: 'Use "standard" or "strict" security level for production',
        });
      }
    }
  }

  return issues;
}

/**
 * Detect orphaned environment configurations
 *
 * @param services - All services
 * @param environments - All environments
 * @returns Array of warnings
 */
function detectOrphanedConfigs(services: Service[], environments: Environment[]): string[] {
  const warnings: string[] = [];
  const envNames = new Set(environments.map((e) => e.name));

  // Check for environments that have no service-specific overrides
  for (const envName of envNames) {
    const hasOverrides = services.some(
      (s) => s.environments && envName in s.environments
    );

    if (!hasOverrides) {
      warnings.push(
        `Environment "${envName}" has no services with environment-specific overrides`
      );
    }
  }

  return warnings;
}

/**
 * Analyze dependency graph for orphans and missing references
 *
 * @param services - All services
 * @returns Dependency analysis result
 */
function analyzeDependencyGraph(services: Service[]): {
  cycles: string[][];
  orphans: string[];
  missingRefs: string[];
} {
  const serviceNames = new Set(services.map((s) => s.name));
  const hasIncomingDep = new Set<string>();
  const missingRefs = new Set<string>();

  // Track which services are depended upon
  for (const service of services) {
    if (!service.dependencies) continue;

    for (const dep of service.dependencies) {
      if (serviceNames.has(dep.name)) {
        hasIncomingDep.add(dep.name);
      } else {
        missingRefs.add(dep.name);
      }
    }
  }

  // Find orphans: no dependencies and no dependents
  const orphans: string[] = [];
  for (const service of services) {
    const hasOutgoingDeps = (service.dependencies?.length || 0) > 0;
    const hasIncomingDeps = hasIncomingDep.has(service.name);

    if (!hasOutgoingDeps && !hasIncomingDeps) {
      orphans.push(service.name);
    }
  }

  return {
    cycles: [], // Cycles are detected separately in validateNoCycles
    orphans,
    missingRefs: Array.from(missingRefs),
  };
}

/**
 * Handler function for validate_architecture tool
 *
 * @param input - Validation scope parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with ValidationReport
 */
export async function validateArchitecture(
  input: ValidateArchitectureInput,
  options: ValidateArchitectureOptions
): Promise<ToolResponse<ValidationReport>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  const scope = input.scope || 'all';

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [],
  };

  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];

  // Fetch entities
  const servicesResult = await store.getServices();
  const environmentsResult = await store.getEnvironments();

  if (!servicesResult.success) {
    return {
      success: false,
      error: servicesResult.error,
      metadata,
    };
  }

  if (!environmentsResult.success) {
    return {
      success: false,
      error: environmentsResult.error,
      metadata,
    };
  }

  const services = servicesResult.data;
  const environments = environmentsResult.data;

  // Run validation checks based on scope
  if (scope === 'all' || scope === 'dependencies') {
    issues.push(...validateDependencyReferences(services));
    issues.push(...(await validateNoCycles(store)));
  }

  if (scope === 'all' || scope === 'services') {
    issues.push(...(await validateSchemas(store)));
    issues.push(...validateSLODefinitions(services));
    issues.push(...validateResilienceConfig(services));
  }

  if (scope === 'all' || scope === 'environments') {
    issues.push(...validateEnvironmentReferences(services, environments));
    warnings.push(...detectOrphanedConfigs(services, environments));
  }

  if (scope === 'all' || scope === 'security') {
    issues.push(...validateSecurityConsistency(services, environments));
  }

  // Analyze dependency graph
  const dependencyAnalysis = analyzeDependencyGraph(services);

  // Determine if architecture is valid (no errors)
  const valid = !issues.some((issue) => issue.severity === 'error');

  const validationReport: ValidationReport = {
    valid,
    issues,
    warnings,
    dependencyAnalysis,
  };

  return {
    success: true,
    data: validationReport,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(response: ToolResponse<ValidationReport>) {
  if (response.success && response.data) {
    const { valid, issues, warnings, dependencyAnalysis } = response.data;

    const textParts = [
      `🔍 Architecture Validation Report`,
      '',
      valid ? '✅ Architecture is valid' : '❌ Architecture has errors',
      '',
    ];

    // Group issues by severity
    const errors = issues.filter((i) => i.severity === 'error');
    const warns = issues.filter((i) => i.severity === 'warning');
    const infos = issues.filter((i) => i.severity === 'info');

    if (errors.length > 0) {
      textParts.push(`🔴 Errors (${errors.length}):`);
      errors.forEach((issue) => {
        textParts.push(`  • [${issue.entityType}/${issue.entity}] ${issue.message}`);
        if (issue.suggestion) {
          textParts.push(`    💡 ${issue.suggestion}`);
        }
      });
      textParts.push('');
    }

    if (warns.length > 0) {
      textParts.push(`⚠️  Warnings (${warns.length}):`);
      warns.forEach((issue) => {
        textParts.push(`  • [${issue.entityType}/${issue.entity}] ${issue.message}`);
        if (issue.suggestion) {
          textParts.push(`    💡 ${issue.suggestion}`);
        }
      });
      textParts.push('');
    }

    if (infos.length > 0) {
      textParts.push(`ℹ️  Info (${infos.length}):`);
      infos.forEach((issue) => {
        textParts.push(`  • [${issue.entityType}/${issue.entity}] ${issue.message}`);
      });
      textParts.push('');
    }

    if (warnings.length > 0) {
      textParts.push(`📋 General Warnings:`);
      warnings.forEach((warning) => {
        textParts.push(`  • ${warning}`);
      });
      textParts.push('');
    }

    // Dependency analysis
    textParts.push(`📊 Dependency Analysis:`);
    textParts.push(`  • Orphaned services: ${dependencyAnalysis.orphans.length}`);
    if (dependencyAnalysis.orphans.length > 0) {
      textParts.push(`    ${dependencyAnalysis.orphans.join(', ')}`);
    }
    textParts.push(`  • Missing references: ${dependencyAnalysis.missingRefs.length}`);
    if (dependencyAnalysis.missingRefs.length > 0) {
      textParts.push(`    ${dependencyAnalysis.missingRefs.join(', ')}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: textParts.join('\n'),
        },
      ],
      structuredContent: {
        success: true,
        data: response.data,
        metadata: response.metadata,
      },
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `❌ Error: ${response.error?.message || 'Unknown error'}`,
      },
    ],
    structuredContent: {
      success: false,
      error: response.error,
      metadata: response.metadata,
    },
    isError: true,
  };
}
