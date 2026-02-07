/**
 * get_ci_requirements MCP Tool
 *
 * Returns the CI/CD pipeline configuration including provider, pipeline steps,
 * quality gates, SonarQube thresholds, and deployment strategies.
 *
 * User Story 5: AI queries CI/CD standards so that when creating pipelines,
 * they automatically include required steps like build, test, sonar, docker, and deploy.
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type { ToolResponse, CICD, ResponseMetadata } from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const getCIRequirementsTool = {
  name: 'get_ci_requirements',
  config: {
    title: 'Get CI/CD Requirements',
    description:
      'Retrieve CI/CD pipeline configuration including provider, required steps, quality gates, SonarQube thresholds, security scanning, deployment stages, branch strategy, and testing requirements. Optionally pass a service name to merge service-specific CI overrides with global standards.',
    inputSchema: z.object({
      service_name: z
        .string()
        .optional()
        .describe(
          'Service name for service-specific CI/CD overrides. If omitted, returns global CI/CD standards.'
        ),
    }),
  },
};

/**
 * Input parameters for get_ci_requirements
 */
export interface GetCIRequirementsInput {
  service_name?: string;
}

/**
 * Options for the getCIRequirements handler
 */
export interface GetCIRequirementsOptions {
  baseDir: string;
}

/**
 * Handler function for get_ci_requirements tool
 *
 * @param input - Optional service name for service-specific overrides
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with CI/CD configuration or error
 */
export async function getCIRequirements(
  input: GetCIRequirementsInput,
  options: GetCIRequirementsOptions
): Promise<ToolResponse<CICD>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  const result = await store.getCIRequirements(input.service_name);

  const sources = ['architecture/cicd.yaml'];
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

  // Enhanced error for missing cicd.yaml
  if (result.error.type === 'file' && result.error.message.includes('not found')) {
    return {
      success: false,
      error: {
        ...result.error,
        message: `${result.error.message}. Run 'arch init --repair' to create a cicd.yaml template.`,
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
export function formatMcpResult(response: ToolResponse<CICD>) {
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
