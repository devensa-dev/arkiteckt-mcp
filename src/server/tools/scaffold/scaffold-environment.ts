/**
 * scaffold_environment MCP Tool
 *
 * Creates a new environment with smart defaults based on tier (dev/staging/prod).
 * Returns environment config, service impacts, infrastructure steps, and security checklist.
 *
 * User Story 4: Junior developers get guided environment scaffolding
 */

import { z } from 'zod';
import path from 'node:path';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import {
  getEnvironmentTemplate,
  getSecurityChecklist,
  getInfrastructureSteps,
} from '../../../core/templates/environment-templates.js';
import { deepMerge } from '../../../core/engines/deep-merge.js';
import type {
  Environment,
  Service,
  ToolResponse,
  ResponseMetadata,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const scaffoldEnvironmentTool = {
  name: 'scaffold_environment',
  config: {
    title: 'Scaffold Environment',
    description:
      'Create a new environment with smart defaults based on tier (dev, staging, prod). Returns environment config, service impacts, infrastructure steps, and security checklist.',
    inputSchema: z.object({
      name: z.string().describe('Environment name'),
      base_template: z
        .enum(['dev', 'staging', 'prod'])
        .optional()
        .describe('Base template tier for smart defaults'),
    }),
  },
};

/**
 * Input parameters for scaffold_environment
 */
export interface ScaffoldEnvironmentInput {
  name: string;
  base_template?: 'dev' | 'staging' | 'prod';
}

/**
 * Options for the scaffoldEnvironment handler
 */
export interface ScaffoldEnvironmentOptions {
  baseDir: string;
}

/**
 * Service impact - what each service should configure for this environment
 */
export interface ServiceImpact {
  serviceName: string;
  changes: string[];
}

/**
 * Environment scaffold response
 */
export interface EnvironmentScaffoldResponse {
  environment: Environment;
  filePath: string;
  serviceImpacts: ServiceImpact[];
  infrastructureSteps: string[];
  securityChecklist: string[];
}

/**
 * Analyze how this environment impacts existing services
 */
function analyzeServiceImpacts(
  environment: Environment,
  services: Service[]
): ServiceImpact[] {
  const impacts: ServiceImpact[] = [];

  for (const service of services) {
    const changes: string[] = [];

    // Check if service already has overrides for this environment
    const hasOverride = service.environments && service.environments[environment.name];

    if (!hasOverride) {
      // Service should add environment-specific configuration
      changes.push(`Add environment override section for '${environment.name}'`);

      // Replica recommendations based on environment tier
      if (environment.availability?.replicas) {
        const replicas = environment.availability.replicas;
        changes.push(`Configure ${replicas} replica${replicas > 1 ? 's' : ''} for this environment`);
      }

      // Resource recommendations
      if (environment.resources) {
        if (environment.resources.cpu?.default) {
          changes.push(`Set CPU resources to ${environment.resources.cpu.default}`);
        }
        if (environment.resources.memory?.default) {
          changes.push(`Set memory resources to ${environment.resources.memory.default}`);
        }
      }

      // Security recommendations
      if (environment.security) {
        const level = environment.security.level;
        if (level === 'strict' || level === 'paranoid') {
          changes.push('Enable TLS for all communication');
          changes.push('Configure private networking');
          if (environment.security.authentication?.mfaRequired) {
            changes.push('Enable MFA for administrative access');
          }
        }
      }

      // Scaling recommendations
      if (environment.scaling?.enabled) {
        changes.push(
          `Configure auto-scaling (${environment.scaling.minReplicas}-${environment.scaling.maxReplicas} replicas)`
        );
      }

      // DR recommendations
      if (environment.disasterRecovery?.enabled) {
        changes.push(
          `Configure disaster recovery with RTO ${environment.disasterRecovery.rto}min, RPO ${environment.disasterRecovery.rpo}min`
        );
      }

      impacts.push({
        serviceName: service.name,
        changes,
      });
    }
  }

  return impacts;
}

/**
 * Handler function for scaffold_environment tool
 *
 * @param input - Environment scaffolding parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with EnvironmentScaffoldResponse
 */
export async function scaffoldEnvironment(
  input: ScaffoldEnvironmentInput,
  options: ScaffoldEnvironmentOptions
): Promise<ToolResponse<EnvironmentScaffoldResponse>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  // Determine tier from base_template or infer from name
  const tier =
    input.base_template ||
    (input.name.includes('prod') || input.name.includes('production')
      ? 'prod'
      : input.name.includes('staging')
        ? 'staging'
        : 'dev');

  // Get smart defaults template for the tier
  const template = getEnvironmentTemplate(tier);

  // Build environment config from input merged with template
  const environmentConfig: Partial<Environment> = deepMerge(
    template,
    {
      name: input.name,
    },
    { arrayStrategy: 'replace' }
  );

  // Create the environment via store
  const createResult = await store.createEnvironment(input.name, environmentConfig);

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/environments/${input.name}.yaml`],
  };

  if (!createResult.success) {
    return {
      success: false,
      error: createResult.error,
      metadata,
    };
  }

  const environment = createResult.data;

  // Get all services to analyze impacts
  const servicesResult = await store.getServices();
  const services = servicesResult.success ? servicesResult.data : [];

  // Analyze service impacts
  const serviceImpacts = analyzeServiceImpacts(environment, services);

  // Get infrastructure steps for this tier
  const infrastructureSteps = getInfrastructureSteps(tier);

  // Get security checklist for this tier
  const securityChecklist = getSecurityChecklist(tier);

  const response: EnvironmentScaffoldResponse = {
    environment,
    filePath: path.join(options.baseDir, 'architecture', 'environments', `${input.name}.yaml`),
    serviceImpacts,
    infrastructureSteps,
    securityChecklist,
  };

  return {
    success: true,
    data: response,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(response: ToolResponse<EnvironmentScaffoldResponse>) {
  if (response.success && response.data) {
    const { environment, serviceImpacts, infrastructureSteps, securityChecklist } = response.data;

    const textParts = [
      `✅ Environment '${environment.name}' scaffolded successfully`,
      `🔒 Security level: ${environment.security?.level || 'standard'}`,
      `🔧 Replicas: ${environment.availability?.replicas || 1}`,
      '',
    ];

    if (serviceImpacts.length > 0) {
      textParts.push(`📦 ${serviceImpacts.length} service(s) impacted`);
    }

    textParts.push('', `🏗️  ${infrastructureSteps.length} infrastructure steps`);
    textParts.push(`🔐 ${securityChecklist.length} security checks`);

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

  // Error case
  return {
    content: [
      {
        type: 'text' as const,
        text: `❌ Failed to scaffold environment: ${response.error?.message || 'Unknown error'}`,
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
