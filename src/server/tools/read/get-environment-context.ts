/**
 * get_environment_context MCP Tool
 *
 * Returns the environment profile with availability, scaling, security,
 * and database settings. Optionally applies tenant-specific overrides.
 *
 * User Story 4: AI queries environment profiles to understand
 * availability, scaling, security, and database requirements.
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { ResolutionEngine } from '../../../core/engines/resolution-engine.js';
import type { ToolResponse, Environment, ResponseMetadata } from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const getEnvironmentContextTool = {
  name: 'get_environment_context',
  config: {
    title: 'Get Environment Context',
    description:
      'Retrieve the configuration profile for a specific environment, including availability, scaling, security, database, and disaster recovery settings. Optionally applies tenant-specific overrides.',
    inputSchema: z.object({
      environment_name: z
        .string()
        .describe('Name of the environment to query (e.g., "dev", "staging", "prod")'),
      tenant: z
        .string()
        .optional()
        .describe('Tenant for tenant-specific environment overrides (e.g., "enterprise-customer")'),
    }),
  },
};

/**
 * Input parameters for get_environment_context
 */
export interface GetEnvironmentContextInput {
  environment_name: string;
  tenant?: string;
}

/**
 * Options for the getEnvironmentContext handler
 */
export interface GetEnvironmentContextOptions {
  baseDir: string;
}

/**
 * Handler function for get_environment_context tool
 *
 * @param input - Environment name and optional tenant
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with environment configuration or error
 */
export async function getEnvironmentContext(
  input: GetEnvironmentContextInput,
  options: GetEnvironmentContextOptions
): Promise<ToolResponse<Environment>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  // Use resolution engine if tenant is specified
  if (input.tenant) {
    const engine = new ResolutionEngine(store);
    const resolved = await engine.resolveEnvironmentContext(input.environment_name, input.tenant);

    if (resolved.success) {
      return {
        success: true,
        data: resolved.data.environment,
        metadata: {
          cached: false,
          resolvedAt: resolved.data.resolvedAt,
          sources: resolved.data.sources,
        },
      };
    }

    // Resolution failed - return the error
    return {
      success: false,
      error: resolved.error,
      metadata: {
        cached: false,
        resolvedAt: new Date().toISOString(),
      },
    };
  }

  // No tenant specified - return raw environment config
  const result = await store.getEnvironment(input.environment_name);

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/environments/${input.environment_name}.yaml`],
  };

  if (result.success) {
    return {
      success: true,
      data: result.data,
      metadata,
    };
  }

  // Enhanced error for missing environment with helpful guidance
  if (result.error.type === 'file' && result.error.message.includes('not found')) {
    const allEnvironments = await store.getEnvironments();
    let available = 'none';

    if (allEnvironments.success && allEnvironments.data.length > 0) {
      available = allEnvironments.data.map((e) => e.name).join(', ');
    }

    return {
      success: false,
      error: {
        ...result.error,
        message: `Environment '${input.environment_name}' not found. Available environments: ${available}`,
      },
      metadata,
    };
  }

  return {
    success: false,
    error: result.error,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(response: ToolResponse<Environment>) {
  if (response.success && response.data) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(response.data, null, 2),
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
        text: `Error: ${response.error?.message || 'Unknown error'}`,
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
