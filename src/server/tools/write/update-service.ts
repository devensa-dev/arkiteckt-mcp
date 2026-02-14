/**
 * update_service MCP Tool
 *
 * Updates an existing service configuration with deep-merge, validation, and impact analysis.
 * Returns the updated service with impact analysis when deployment pattern changes.
 *
 * User Story 2: Tech leads can update services with validation and impact analysis
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { ImpactAnalyzer } from '../../../core/engines/impact-analyzer.js';
import type {
  Service,
  WriteResponse,
  ToolResponse,
  ResponseMetadata,
  ImpactAnalysis,
  DeploymentPattern,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const updateServiceTool = {
  name: 'update_service',
  config: {
    title: 'Update Service',
    description:
      'Update an existing service configuration with deep-merge and validation. Provides impact analysis when deployment pattern changes. Arrays in updates replace entirely (not appended).',
    inputSchema: z.object({
      name: z.string().describe('Existing service name'),
      updates: z.record(z.unknown()).describe('Partial service config to deep-merge'),
    }),
  },
};

/**
 * Input parameters for update_service
 */
export interface UpdateServiceInput {
  name: string;
  updates: Record<string, unknown>;
}

/**
 * Options for the updateService handler
 */
export interface UpdateServiceOptions {
  baseDir: string;
}

/**
 * Handler function for update_service tool
 *
 * @param input - Service update parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with WriteResponse containing updated service and impact analysis
 */
export async function updateService(
  input: UpdateServiceInput,
  options: UpdateServiceOptions
): Promise<ToolResponse<WriteResponse & { entity: Service }>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  const impactAnalyzer = new ImpactAnalyzer(store);

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/services/${input.name}.yaml`],
  };

  // Check if deployment pattern is changing to trigger artifact delta analysis
  const existingServiceResult = await store.getService(input.name);
  if (!existingServiceResult.success) {
    return {
      success: false,
      error: existingServiceResult.error,
      metadata,
    };
  }

  const oldPattern = existingServiceResult.data.deployment?.pattern;
  const newPattern = (input.updates.deployment as any)?.pattern as DeploymentPattern | undefined;

  // Update the service via store
  const updateResult = await store.updateService(input.name, input.updates);

  if (!updateResult.success) {
    return {
      success: false,
      error: updateResult.error,
      metadata,
    };
  }

  // Build impact analysis
  let impact: ImpactAnalysis | undefined;

  // If deployment pattern changed, analyze artifact delta
  if (newPattern && oldPattern && newPattern !== oldPattern) {
    const artifactsDelta = await impactAnalyzer.analyzeDeploymentPatternChange(
      updateResult.data,
      oldPattern,
      newPattern
    );

    impact = {
      affectedServices: [],
      artifactsDelta,
    };
  }

  // Build next steps
  const nextSteps: string[] = [];
  if (impact?.artifactsDelta) {
    if (impact.artifactsDelta.added.length > 0) {
      nextSteps.push(
        `Add ${impact.artifactsDelta.added.length} new artifacts for ${newPattern} pattern`
      );
    }
    if (impact.artifactsDelta.removed.length > 0) {
      nextSteps.push(
        `Remove ${impact.artifactsDelta.removed.length} artifacts no longer needed`
      );
    }
  }

  // Build WriteResponse
  const writeResponse: WriteResponse & { entity: Service } = {
    entity: updateResult.data,
    filePath: `${options.baseDir}/architecture/services/${input.name}.yaml`,
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
export function formatMcpResult(
  response: ToolResponse<WriteResponse & { entity: Service }>
) {
  if (response.success && response.data) {
    const { entity, filePath, impact, nextSteps } = response.data;

    const textParts = [
      `✅ Service '${entity.name}' updated successfully`,
      `📁 File: ${filePath}`,
      `🔧 Pattern: ${entity.deployment?.pattern}`,
    ];

    if (impact?.artifactsDelta) {
      if (impact.artifactsDelta.added.length > 0) {
        textParts.push('');
        textParts.push('➕ Artifacts to add:');
        impact.artifactsDelta.added.forEach((artifact) => {
          textParts.push(`  • ${artifact.name} (${artifact.type})`);
        });
      }
      if (impact.artifactsDelta.removed.length > 0) {
        textParts.push('');
        textParts.push('➖ Artifacts to remove:');
        impact.artifactsDelta.removed.forEach((artifact) => {
          textParts.push(`  • ${artifact.name} (${artifact.type})`);
        });
      }
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
