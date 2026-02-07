/**
 * get_observability_requirements MCP Tool
 *
 * Returns the observability configuration including logging format,
 * metrics backend, tracing standard, alerting, SLOs, and DORA metrics.
 *
 * User Story 6: AI queries observability standards so that services
 * include proper logging, metrics, and tracing configuration.
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type { ToolResponse, Observability, ResponseMetadata } from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const getObservabilityRequirementsTool = {
  name: 'get_observability_requirements',
  config: {
    title: 'Get Observability Requirements',
    description:
      'Retrieve observability configuration including logging format, metrics backend, tracing standard, alerting channels, SLO definitions, and DORA metrics. Optionally pass a service name to resolve service-specific observability profile and overrides.',
    inputSchema: z.object({
      service_name: z
        .string()
        .optional()
        .describe(
          'Service name for service-specific observability overrides. If omitted, returns global observability standards.'
        ),
    }),
  },
};

/**
 * Input parameters for get_observability_requirements
 */
export interface GetObservabilityRequirementsInput {
  service_name?: string;
}

/**
 * Options for the getObservabilityRequirements handler
 */
export interface GetObservabilityRequirementsOptions {
  baseDir: string;
}

/**
 * Handler function for get_observability_requirements tool
 *
 * @param input - Optional service name for service-specific overrides
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with observability configuration or error
 */
export async function getObservabilityRequirements(
  input: GetObservabilityRequirementsInput,
  options: GetObservabilityRequirementsOptions
): Promise<ToolResponse<Observability>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  const result = await store.getObservabilityRequirements(input.service_name);

  const sources = ['architecture/observability.yaml'];
  if (input.service_name) {
    sources.push(`architecture/services/${input.service_name}.yaml`);
  }

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources,
  };

  if (result.success) {
    return {
      success: true,
      data: result.data,
      metadata,
    };
  }

  // Enhanced error for missing observability.yaml
  if (result.error.type === 'file' && result.error.message.includes('not found')) {
    return {
      success: false,
      error: {
        ...result.error,
        message: `${result.error.message}. Run 'arch init --repair' to create an observability.yaml template.`,
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
export function formatMcpResult(response: ToolResponse<Observability>) {
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
