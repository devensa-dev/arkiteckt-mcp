/**
 * create_environment MCP Tool
 *
 * Creates a new environment configuration with smart defaults from base templates.
 * Returns the created environment with guidance on next steps.
 *
 * User Story 2: Tech leads can create environments with smart defaults
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type {
  Environment,
  WriteResponse,
  ToolResponse,
  ResponseMetadata,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const createEnvironmentTool = {
  name: 'create_environment',
  config: {
    title: 'Create Environment',
    description:
      'Create a new environment configuration with smart defaults. Optionally use base_template (dev, staging, prod) to apply preset configurations.',
    inputSchema: z.object({
      name: z.string().describe('Environment name (e.g., dev, staging, prod, qa)'),
      base_template: z
        .enum(['dev', 'staging', 'prod'])
        .optional()
        .describe('Apply smart defaults from template'),
      availability: z
        .object({
          multi_az: z.boolean().optional(),
          multi_region: z.boolean().optional(),
          failover: z.boolean().optional(),
        })
        .optional()
        .describe('Availability configuration'),
      scaling: z
        .object({
          min_replicas: z.number().optional(),
          max_replicas: z.number().optional(),
          auto_scaling: z.boolean().optional(),
        })
        .optional()
        .describe('Scaling configuration'),
      security_level: z
        .enum(['relaxed', 'standard', 'strict', 'paranoid'])
        .optional()
        .describe('Security level'),
    }),
  },
};

/**
 * Input parameters for create_environment
 */
export interface CreateEnvironmentInput {
  name: string;
  base_template?: 'dev' | 'staging' | 'prod';
  availability?: {
    multi_az?: boolean;
    multi_region?: boolean;
    failover?: boolean;
  };
  scaling?: {
    min_replicas?: number;
    max_replicas?: number;
    auto_scaling?: boolean;
  };
  security_level?: 'relaxed' | 'standard' | 'strict' | 'paranoid';
}

/**
 * Options for the createEnvironment handler
 */
export interface CreateEnvironmentOptions {
  baseDir: string;
}

/**
 * Handler function for create_environment tool
 *
 * @param input - Environment creation parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with WriteResponse containing created environment
 */
export async function createEnvironment(
  input: CreateEnvironmentInput,
  options: CreateEnvironmentOptions
): Promise<ToolResponse<WriteResponse & { entity: Environment }>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/environments/${input.name}.yaml`],
  };

  // Build environment config from input
  const environmentConfig: Partial<Environment> = {
    name: input.name,
  };

  // Apply base template defaults if specified
  // TODO: Phase 8 will add proper template system (T061)
  // For now, just apply user-provided values
  if (input.availability) {
    environmentConfig.availability = input.availability as any;
  }

  if (input.scaling) {
    environmentConfig.scaling = input.scaling as any;
  }

  if (input.security_level) {
    if (!environmentConfig.security) {
      environmentConfig.security = {} as any;
    }
    (environmentConfig.security as any).level = input.security_level;
  }

  // Create the environment via store
  const createResult = await store.createEnvironment(input.name, environmentConfig);

  if (!createResult.success) {
    return {
      success: false,
      error: createResult.error,
      metadata,
    };
  }

  // Build next steps
  const nextSteps: string[] = [
    'Configure service-specific overrides in service YAML files',
    'Review resource constraints and database configs',
  ];

  if (input.base_template === 'prod') {
    nextSteps.push('Configure disaster recovery settings');
    nextSteps.push('Review security compliance requirements');
  }

  // Build WriteResponse
  const writeResponse: WriteResponse & { entity: Environment } = {
    entity: createResult.data,
    filePath: `${options.baseDir}/architecture/environments/${input.name}.yaml`,
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
  response: ToolResponse<WriteResponse & { entity: Environment }>
) {
  if (response.success && response.data) {
    const { entity, filePath, nextSteps } = response.data;

    const textParts = [
      `✅ Environment '${entity.name}' created successfully`,
      `📁 File: ${filePath}`,
    ];

    if (entity.availability) {
      textParts.push(
        `🌐 Availability: multi-AZ=${entity.availability.multi_az || false}, multi-region=${entity.availability.multi_region || false}`
      );
    }

    if (entity.scaling) {
      textParts.push(
        `📊 Scaling: ${entity.scaling.min_replicas || 1}-${entity.scaling.max_replicas || 1} replicas`
      );
    }

    if (nextSteps && nextSteps.length > 0) {
      textParts.push('');
      textParts.push('📋 Next steps:');
      nextSteps.forEach((step, i) => {
        textParts.push(`  ${i + 1}. ${step}`);
      });
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
