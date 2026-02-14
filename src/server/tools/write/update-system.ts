/**
 * update_system MCP Tool
 *
 * Updates the system-level configuration with deep-merge and validation.
 * Returns impact analysis showing which services are affected by defaults changes.
 *
 * User Story 2: Tech leads can update system config with impact analysis
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { ImpactAnalyzer } from '../../../core/engines/impact-analyzer.js';
import type {
  System,
  WriteResponse,
  ToolResponse,
  ResponseMetadata,
  ImpactAnalysis,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const updateSystemTool = {
  name: 'update_system',
  config: {
    title: 'Update System',
    description:
      'Update system-level configuration and defaults. Provides impact analysis showing which services will inherit the changed defaults. Arrays in updates replace entirely.',
    inputSchema: z.object({
      updates: z.record(z.unknown()).describe('Partial system config to deep-merge'),
    }),
  },
};

/**
 * Input parameters for update_system
 */
export interface UpdateSystemInput {
  updates: Record<string, unknown>;
}

/**
 * Options for the updateSystem handler
 */
export interface UpdateSystemOptions {
  baseDir: string;
}

/**
 * Handler function for update_system tool
 *
 * @param input - System update parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with WriteResponse containing updated system and impact analysis
 */
export async function updateSystem(
  input: UpdateSystemInput,
  options: UpdateSystemOptions
): Promise<ToolResponse<WriteResponse & { entity: System }>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  const impactAnalyzer = new ImpactAnalyzer(store);

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: ['architecture/system.yaml'],
  };

  // Get existing system config to detect defaults changes
  const existingSystemResult = await store.getSystem();
  if (!existingSystemResult.success) {
    return {
      success: false,
      error: existingSystemResult.error,
      metadata,
    };
  }

  const oldDefaults = existingSystemResult.data.defaults;

  // Update the system via store
  const updateResult = await store.updateSystem(input.updates);

  if (!updateResult.success) {
    return {
      success: false,
      error: updateResult.error,
      metadata,
    };
  }

  const newDefaults = updateResult.data.defaults;

  // Analyze impact on services inheriting defaults
  let impact: ImpactAnalysis | undefined;
  if (oldDefaults && newDefaults) {
    const affectedServices = await impactAnalyzer.analyzeSystemDefaultsChange(
      oldDefaults,
      newDefaults
    );

    if (affectedServices.length > 0) {
      impact = {
        affectedServices,
      };
    }
  }

  // Build next steps
  const nextSteps: string[] = [];
  if (impact?.affectedServices && impact.affectedServices.length > 0) {
    nextSteps.push(
      `Review ${impact.affectedServices.length} service(s) affected by defaults changes`
    );
    nextSteps.push('Validate service configurations still work with new defaults');
  }

  // Build WriteResponse
  const writeResponse: WriteResponse & { entity: System } = {
    entity: updateResult.data,
    filePath: `${options.baseDir}/architecture/system.yaml`,
    operation: 'update',
    impact,
    nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
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
export function formatMcpResult(response: ToolResponse<WriteResponse & { entity: System }>) {
  if (response.success && response.data) {
    const { entity, filePath, impact, nextSteps } = response.data;

    const textParts = [
      `✅ System configuration updated successfully`,
      `📁 File: ${filePath}`,
      `🌐 System: ${entity.name}`,
    ];

    if (impact?.affectedServices && impact.affectedServices.length > 0) {
      textParts.push('');
      textParts.push(`⚠️  ${impact.affectedServices.length} service(s) affected by defaults changes:`);
      impact.affectedServices.forEach((svc) => {
        textParts.push(`  • ${svc.name}: ${svc.reason}`);
        svc.fields.forEach((field) => {
          textParts.push(
            `    - ${field.path}: ${JSON.stringify(field.before)} → ${JSON.stringify(field.after)}`
          );
        });
      });
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
