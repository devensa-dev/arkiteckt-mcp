/**
 * set_cicd MCP Tool
 *
 * Creates or updates CI/CD configuration with upsert behavior.
 * If cicd.yaml exists, deep-merges with existing config; otherwise creates new.
 *
 * User Story 2: Tech leads can configure CI/CD pipelines
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import {
  PipelineProviderSchema,
  PipelineStepSchema,
  QualityGateSchema,
} from '../../../core/schemas/index.js';
import type {
  CICD,
  WriteResponse,
  ToolResponse,
  ResponseMetadata,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const setCICDTool = {
  name: 'set_cicd',
  config: {
    title: 'Set CI/CD Configuration',
    description:
      'Create or update CI/CD pipeline configuration with upsert behavior. If cicd.yaml exists, deep-merges with existing config; otherwise creates new.',
    inputSchema: z.object({
      provider: PipelineProviderSchema.optional().describe('CI/CD provider'),
      steps: z.array(PipelineStepSchema).optional().describe('Pipeline steps'),
      quality_gates: z.array(QualityGateSchema).optional().describe('Quality gates'),
      config: z.record(z.unknown()).optional().describe('Additional CI/CD configuration'),
    }),
  },
};

/**
 * Input parameters for set_cicd
 */
export interface SetCICDInput {
  provider?: string;
  steps?: Array<{
    type: string;
    name: string;
    [key: string]: unknown;
  }>;
  quality_gates?: Array<{
    name: string;
    enabled?: boolean;
    metric: string;
    operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
    threshold: number;
    [key: string]: unknown;
  }>;
  config?: Record<string, unknown>;
}

/**
 * Options for the setCICD handler
 */
export interface SetCICDOptions {
  baseDir: string;
}

/**
 * Handler function for set_cicd tool
 *
 * @param input - CI/CD configuration parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with WriteResponse containing created/updated CI/CD config
 */
export async function setCICD(
  input: SetCICDInput,
  options: SetCICDOptions
): Promise<ToolResponse<WriteResponse & { entity: CICD }>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: ['architecture/cicd.yaml'],
  };

  // Build CI/CD config from input
  const cicdConfig: Partial<CICD> = {};

  if (input.provider) {
    cicdConfig.provider = input.provider as any;
  }

  if (input.steps) {
    cicdConfig.steps = input.steps as any;
  }

  if (input.quality_gates) {
    cicdConfig.qualityGates = input.quality_gates as any;
  }

  if (input.config) {
    cicdConfig.config = input.config as any;
  }

  // Upsert the CI/CD config via store (creates if not exists, merges if exists)
  const upsertResult = await store.setCICD(cicdConfig);

  if (!upsertResult.success) {
    return {
      success: false,
      error: upsertResult.error,
      metadata,
    };
  }

  // Determine if this was a create or update
  const operation = upsertResult.data.provider ? 'update' : 'create';

  // Build next steps
  const nextSteps: string[] = [
    'Review pipeline steps and quality gates',
    'Configure CI/CD secrets and credentials',
  ];

  if (input.provider === 'github-actions') {
    nextSteps.push('Create .github/workflows/ directory with workflow files');
  } else if (input.provider === 'gitlab-ci') {
    nextSteps.push('Create .gitlab-ci.yml in repository root');
  }

  // Build WriteResponse
  const writeResponse: WriteResponse & { entity: CICD } = {
    entity: upsertResult.data,
    filePath: `${options.baseDir}/architecture/cicd.yaml`,
    operation: operation as 'create' | 'update',
    impact: undefined,
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
export function formatMcpResult(response: ToolResponse<WriteResponse & { entity: CICD }>) {
  if (response.success && response.data) {
    const { entity, filePath, operation, nextSteps } = response.data;

    const textParts = [
      operation === 'create'
        ? `✅ CI/CD configuration created successfully`
        : `✅ CI/CD configuration updated successfully`,
      `📁 File: ${filePath}`,
    ];

    if (entity.provider) {
      textParts.push(`🔧 Provider: ${entity.provider}`);
    }

    if (entity.steps && entity.steps.length > 0) {
      textParts.push(`📋 Pipeline steps: ${entity.steps.length}`);
    }

    if (entity.qualityGates && entity.qualityGates.length > 0) {
      textParts.push(`✓ Quality gates: ${entity.qualityGates.length}`);
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
