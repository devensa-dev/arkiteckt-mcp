/**
 * delete_environment MCP Tool
 *
 * Deletes an environment configuration and reports orphaned service overrides.
 * Returns deletion confirmation with warnings about services that have environment-specific
 * configurations for the deleted environment.
 *
 * User Story 3: Developers can safely delete environments with orphaned config warnings
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type {
  DeleteResponse,
  ToolResponse,
  ResponseMetadata,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const deleteEnvironmentTool = {
  name: 'delete_environment',
  config: {
    title: 'Delete Environment',
    description:
      'Delete an environment configuration. Returns warnings about services that have environment-specific overrides for this environment (orphaned configs).',
    inputSchema: z.object({
      name: z.string().describe('Environment to delete'),
    }),
  },
};

/**
 * Input parameters for delete_environment
 */
export interface DeleteEnvironmentInput {
  name: string;
}

/**
 * Options for the deleteEnvironment handler
 */
export interface DeleteEnvironmentOptions {
  baseDir: string;
}

/**
 * Handler function for delete_environment tool
 *
 * @param input - Environment deletion parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with DeleteResponse containing deletion confirmation and orphaned config warnings
 */
export async function deleteEnvironment(
  input: DeleteEnvironmentInput,
  options: DeleteEnvironmentOptions
): Promise<ToolResponse<DeleteResponse>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/environments/${input.name}.yaml`],
  };

  // Check if environment exists
  const existingResult = await store.getEnvironment(input.name);
  if (!existingResult.success) {
    return {
      success: false,
      error: {
        type: 'validation',
        message: `Environment '${input.name}' not found`,
        entity: 'environment',
        path: 'name',
      },
      metadata,
    };
  }

  // Scan services for orphaned environment overrides (FR-008)
  const servicesResult = await store.getServices();
  const orphanedServices: string[] = [];

  if (servicesResult.success) {
    for (const service of servicesResult.data) {
      if (service.environments && input.name in service.environments) {
        orphanedServices.push(service.name);
      }
    }
  }

  // Delete the environment via store
  const deleteResult = await store.deleteEnvironment(input.name);

  if (!deleteResult.success) {
    return {
      success: false,
      error: deleteResult.error,
      metadata,
    };
  }

  // Build DeleteResponse with orphaned config warnings
  const warnings: string[] = [];
  if (orphanedServices.length > 0) {
    warnings.push(
      `WARNING: The following services have orphaned environment overrides for '${input.name}': ${orphanedServices.join(', ')}`
    );
    warnings.push(
      `These services still have 'environments.${input.name}' sections in their YAML that are no longer valid`
    );
    warnings.push(
      `You should clean up these orphaned configs manually or update the affected services`
    );
  }

  const deleteResponse: DeleteResponse = {
    deleted: input.name,
    entityType: 'environment',
    filePath: `${options.baseDir}/architecture/environments/${input.name}.yaml`,
    warnings,
    forced: false, // Environments don't have a force option
  };

  return {
    success: true,
    data: deleteResponse,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function formatMcpResult(response: ToolResponse<DeleteResponse>) {
  if (response.success && response.data) {
    const { deleted, filePath, warnings } = response.data;

    const textParts = [
      `✅ Environment '${deleted}' deleted successfully`,
      `📁 File: ${filePath}`,
    ];

    if (warnings.length > 0) {
      textParts.push('', '⚠️  Warnings:');
      warnings.forEach((warning) => {
        textParts.push(`  • ${warning}`);
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
        text: `❌ Error: ${response.error?.message ?? 'Unknown error'}`,
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
