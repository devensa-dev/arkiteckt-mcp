/**
 * get_service_context MCP Tool
 *
 * Returns the configuration for a specific service, optionally resolved for a target environment.
 *
 * User Story 2: AI can call `get_service_context(service, env, tenant)` to understand service configuration
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { ResolutionEngine } from '../../../core/engines/resolution-engine.js';
import type { ToolResponse, Service, ResponseMetadata } from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const getServiceContextTool = {
  name: 'get_service_context',
  config: {
    title: 'Get Service Context',
    description:
      'Retrieve the configuration for a specific service, optionally resolved for a target environment and tenant. Use this to understand service dependencies, deployment patterns, and environment-specific configuration with full resolution.',
    inputSchema: z.object({
      service_name: z.string().describe('Name of the service to query (e.g., "user-service")'),
      environment: z
        .string()
        .optional()
        .describe('Target environment for resolution (e.g., "dev", "staging", "prod")'),
      tenant: z.string().optional().describe('Tenant for multi-tenant resolution (e.g., "enterprise-customer")'),
    }),
  },
};

/**
 * Input parameters for get_service_context
 */
export interface GetServiceContextInput {
  service_name: string;
  environment?: string;
  tenant?: string;
}

/**
 * Options for the getServiceContext handler
 */
export interface GetServiceContextOptions {
  baseDir: string;
}

/**
 * Handler function for get_service_context tool
 *
 * @param input - Service name and optional environment
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with service configuration or error
 */
export async function getServiceContext(
  input: GetServiceContextInput,
  options: GetServiceContextOptions
): Promise<ToolResponse<Service>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  // Use resolution engine if environment or tenant is specified
  if (input.environment || input.tenant) {
    const engine = new ResolutionEngine(store);
    const resolved = await engine.resolveServiceContext(input.service_name, input.environment, input.tenant);

    if (resolved.success) {
      return {
        success: true,
        data: resolved.data.service,
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

  // No environment or tenant specified - return raw service config
  const result = await store.getService(input.service_name);

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/services/${input.service_name}.yaml`],
  };

  if (result.success) {
    return {
      success: true,
      data: result.data,
      metadata,
    };
  }

  // Enhanced error for missing service with helpful guidance
  if (result.error.type === 'file' && result.error.message.includes('not found')) {
    const allServices = await store.getServices();
    let available = 'none';

    if (allServices.success && allServices.data.length > 0) {
      available = allServices.data.map((s) => s.name).join(', ');
    }

    return {
      success: false,
      error: {
        ...result.error,
        message: `Service '${input.service_name}' not found. Available services: ${available}`,
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
export function formatMcpResult(response: ToolResponse<Service>) {
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
