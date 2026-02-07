/**
 * get_system_context MCP Tool
 *
 * Returns the system configuration from system.yaml.
 * This is the foundational query that all other operations depend on.
 *
 * User Story 1: AI can call `get_system_context` to understand team's architecture
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type { ToolResponse, System, ResponseMetadata } from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const getSystemContextTool = {
  name: 'get_system_context',
  config: {
    title: 'Get System Context',
    description:
      'Retrieve the system configuration including architecture style, cloud provider, runtime defaults, and global constraints. This is the foundational query for understanding the team\'s architecture.',
    inputSchema: z.object({}),
  },
};

/**
 * Options for the getSystemContext handler
 */
export interface GetSystemContextOptions {
  baseDir: string;
}

/**
 * Handler function for get_system_context tool
 *
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with system configuration or error
 */
export async function getSystemContext(
  options: GetSystemContextOptions
): Promise<ToolResponse<System>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  const result = await store.getSystem();

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: ['architecture/system.yaml'],
  };

  if (result.success) {
    return {
      success: true,
      data: result.data,
      metadata,
    };
  }

  // Enhance error with guidance for missing system.yaml
  if (result.error.type === 'file' && result.error.message.includes('not found')) {
    return {
      success: false,
      error: {
        ...result.error,
        message: `${result.error.message}. Run 'arch init' to initialize the architecture repository with a system.yaml template.`,
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
export function formatMcpResult(response: ToolResponse<System>) {
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
