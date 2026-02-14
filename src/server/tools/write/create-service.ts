/**
 * create_service MCP Tool
 *
 * Creates a new service configuration with validation, defaults, and artifact checklist.
 * Returns the created service with a capability-driven checklist of next steps.
 *
 * User Story 1: Developers can create new service configurations through AI
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { expandCapability } from '../read/get-capability-requirements.js';
import {
  ServiceTypeSchema,
  DeploymentPatternSchema,
} from '../../../core/schemas/index.js';
import type {
  Service,
  WriteResponse,
  ToolResponse,
  ResponseMetadata,
  ArtifactRequirement,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const createServiceTool = {
  name: 'create_service',
  config: {
    title: 'Create Service',
    description:
      'Create a new service configuration with validation, smart defaults, and deployment pattern-specific artifact checklist. Returns the created service YAML and next steps.',
    inputSchema: z.object({
      name: z.string().describe('Service name (must be unique)'),
      type: ServiceTypeSchema.describe('Service type (api, worker, frontend, etc.)'),
      deployment_pattern: DeploymentPatternSchema.describe(
        'Deployment pattern (lambda, ecs_fargate, kubernetes, container)'
      ),
      description: z.string().optional().describe('Service description'),
      dependencies: z
        .array(
          z.object({
            name: z.string(),
            type: z.enum(['sync', 'async']).optional(),
            protocol: z.string().optional(),
          })
        )
        .optional()
        .describe('Service dependencies'),
      owner: z.string().optional().describe('Team or person owning this service'),
    }),
  },
};

/**
 * Input parameters for create_service
 */
export interface CreateServiceInput {
  name: string;
  type: string;
  deployment_pattern: string;
  description?: string;
  dependencies?: Array<{
    name: string;
    type?: 'sync' | 'async';
    protocol?: string;
  }>;
  owner?: string;
}

/**
 * Options for the createService handler
 */
export interface CreateServiceOptions {
  baseDir: string;
}

/**
 * Convert artifact requirements to flat checklist
 */
function buildChecklist(artifacts: ArtifactRequirement[]): string[] {
  return artifacts.map((artifact) => {
    const required = artifact.required ? '[REQUIRED]' : '[OPTIONAL]';
    return `${required} ${artifact.name}: ${artifact.description || artifact.type}`;
  });
}

/**
 * Handler function for create_service tool
 *
 * @param input - Service creation parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with WriteResponse containing created service and checklist
 */
export async function createService(
  input: CreateServiceInput,
  options: CreateServiceOptions
): Promise<ToolResponse<WriteResponse & { entity: Service }>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  // Build service config from input
  const serviceConfig: Partial<Service> = {
    name: input.name,
    type: input.type as any, // Type is validated by inputSchema
    deployment: {
      pattern: input.deployment_pattern as any, // Pattern is validated by inputSchema
    },
  };

  if (input.description) {
    serviceConfig.description = input.description;
  }

  if (input.dependencies && input.dependencies.length > 0) {
    serviceConfig.dependencies = input.dependencies.map((dep) => ({
      name: dep.name,
      type: (dep.type || 'sync') as 'sync' | 'async' | 'optional',
      protocol: dep.protocol,
    }));
  }

  if (input.owner) {
    serviceConfig.owner = input.owner;
  }

  // Create the service via store
  const createResult = await store.createService(input.name, serviceConfig);

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/services/${input.name}.yaml`],
  };

  if (!createResult.success) {
    return {
      success: false,
      error: createResult.error,
      metadata,
    };
  }

  // Get capability checklist for create_service with the deployment pattern
  const capabilitiesResult = await store.getCapabilities();
  let nextSteps: string[] = [];

  if (capabilitiesResult.success) {
    const createServiceCap = capabilitiesResult.data.find((c) => c.id === 'create_service');
    if (createServiceCap) {
      const expanded = expandCapability(createServiceCap, input.deployment_pattern);
      nextSteps = buildChecklist(expanded.artifacts);
      metadata.sources?.push('architecture/capabilities/');
    }
  }

  // Build WriteResponse
  const writeResponse: WriteResponse & { entity: Service } = {
    entity: createResult.data,
    filePath: `${options.baseDir}/architecture/services/${input.name}.yaml`,
    operation: 'create',
    impact: undefined, // No impact on creation
    nextSteps,
  };

  return {
    success: true,
    data: writeResponse,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(
  response: ToolResponse<WriteResponse & { entity: Service }>
) {
  if (response.success && response.data) {
    const { entity, filePath, nextSteps } = response.data;

    const textParts = [
      `✅ Service '${entity.name}' created successfully`,
      `📁 File: ${filePath}`,
      `🔧 Pattern: ${entity.deployment?.pattern}`,
      '',
      '📋 Next steps:',
      ...(nextSteps || []).map((step, i) => `  ${i + 1}. ${step}`),
    ];

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
