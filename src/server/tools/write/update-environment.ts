/**
 * update_environment MCP Tool
 *
 * Updates an existing environment configuration with deep-merge and validation.
 * Returns the updated environment with guidance on affected services.
 *
 * User Story 2: Tech leads can update environments with validation
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
export const updateEnvironmentTool = {
  name: 'update_environment',
  config: {
    title: 'Update Environment',
    description:
      'Update an existing environment configuration with deep-merge and validation. Arrays in updates replace entirely (not appended).',
    inputSchema: z.object({
      name: z.string().describe('Existing environment name'),
      updates: z.record(z.unknown()).describe('Partial environment config to deep-merge'),
    }),
  },
};

/**
 * Input parameters for update_environment
 */
export interface UpdateEnvironmentInput {
  name: string;
  updates: Record<string, unknown>;
}

/**
 * Options for the updateEnvironment handler
 */
export interface UpdateEnvironmentOptions {
  baseDir: string;
}

/**
 * Handler function for update_environment tool
 *
 * @param input - Environment update parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with WriteResponse containing updated environment
 */
export async function updateEnvironment(
  input: UpdateEnvironmentInput,
  options: UpdateEnvironmentOptions
): Promise<ToolResponse<WriteResponse & { entity: Environment }>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/environments/${input.name}.yaml`],
  };

  // Update the environment via store
  const updateResult = await store.updateEnvironment(input.name, input.updates);

  if (!updateResult.success) {
    return {
      success: false,
      error: updateResult.error,
      metadata,
    };
  }

  // Build next steps
  const nextSteps: string[] = [
    'Review services with environment-specific overrides',
    'Validate that updated configs work for all services',
  ];

  // Build WriteResponse
  const writeResponse: WriteResponse & { entity: Environment } = {
    entity: updateResult.data,
    filePath: `${options.baseDir}/architecture/environments/${input.name}.yaml`,
    operation: 'update',
    impact: undefined, // TODO: Phase 4 - could scan for services with overrides
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
      `✅ Environment '${entity.name}' updated successfully`,
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
