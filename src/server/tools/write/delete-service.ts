/**
 * delete_service MCP Tool
 *
 * Deletes a service configuration with safety checks for dependents.
 * Returns deletion confirmation with warnings about broken dependencies if forced.
 *
 * User Story 3: Developers can safely delete services with dependency checks
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { buildDependencyGraph } from '../../../core/engines/cycle-detector.js';
import type {
  DeleteResponse,
  ToolResponse,
  ResponseMetadata,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const deleteServiceTool = {
  name: 'delete_service',
  config: {
    title: 'Delete Service',
    description:
      'Delete a service configuration with safety checks. Prevents deletion if other services depend on it unless force=true. Returns warnings about broken dependencies when forced.',
    inputSchema: z.object({
      name: z.string().describe('Service to delete'),
      force: z
        .boolean()
        .optional()
        .default(false)
        .describe('Skip dependency check and force deletion'),
    }),
  },
};

/**
 * Input parameters for delete_service
 */
export interface DeleteServiceInput {
  name: string;
  force?: boolean;
}

/**
 * Options for the deleteService handler
 */
export interface DeleteServiceOptions {
  baseDir: string;
}

/**
 * Handler function for delete_service tool
 *
 * @param input - Service deletion parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with DeleteResponse containing deletion confirmation and warnings
 */
export async function deleteService(
  input: DeleteServiceInput,
  options: DeleteServiceOptions
): Promise<ToolResponse<DeleteResponse>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  const force = input.force ?? false;

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/services/${input.name}.yaml`],
  };

  // Check if service exists
  const existingResult = await store.getService(input.name);
  if (!existingResult.success) {
    return {
      success: false,
      error: {
        type: 'validation',
        message: `Service '${input.name}' not found`,
        entity: 'service',
        path: 'name',
      },
      metadata,
    };
  }

  // Check for dependents (FR-007)
  const graph = await buildDependencyGraph(store);
  const dependents: string[] = [];

  for (const [serviceName, deps] of graph.entries()) {
    if (serviceName !== input.name && deps.includes(input.name)) {
      dependents.push(serviceName);
    }
  }

  // Block deletion if has dependents and not forced
  if (dependents.length > 0 && !force) {
    return {
      success: false,
      error: {
        type: 'validation',
        message: `Cannot delete service '${input.name}'. The following services depend on it: ${dependents.join(', ')}. Use force=true to delete anyway.`,
        entity: 'service',
        path: 'dependencies',
      },
      metadata,
    };
  }

  // Delete the service via store
  const deleteResult = await store.deleteService(input.name, force);

  if (!deleteResult.success) {
    return {
      success: false,
      error: deleteResult.error,
      metadata,
    };
  }

  // Build DeleteResponse
  const warnings: string[] = [];
  if (force && dependents.length > 0) {
    warnings.push(
      `WARNING: Forced deletion. The following services have broken dependencies: ${dependents.join(', ')}`
    );
    warnings.push(
      `You should update these services to remove the dependency on '${input.name}'`
    );
  }

  const deleteResponse: DeleteResponse = {
    deleted: input.name,
    entityType: 'service',
    filePath: `${options.baseDir}/architecture/services/${input.name}.yaml`,
    warnings,
    forced: force,
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
    const { deleted, filePath, warnings, forced } = response.data;

    const textParts = [
      `✅ Service '${deleted}' deleted successfully`,
      `📁 File: ${filePath}`,
    ];

    if (forced) {
      textParts.push('⚠️  Forced deletion - dependency checks skipped');
    }

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
