/**
 * set_observability MCP Tool
 *
 * Creates or updates observability configuration with upsert behavior.
 * If observability.yaml exists, deep-merges with existing config; otherwise creates new.
 *
 * User Story 2: Tech leads can configure observability settings
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type {
  Observability,
  WriteResponse,
  ToolResponse,
  ResponseMetadata,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const setObservabilityTool = {
  name: 'set_observability',
  config: {
    title: 'Set Observability Configuration',
    description:
      'Create or update observability configuration with upsert behavior. If observability.yaml exists, deep-merges with existing config; otherwise creates new.',
    inputSchema: z.object({
      logging: z
        .object({
          level: z.string().optional(),
          format: z.string().optional(),
          retention_days: z.number().optional(),
        })
        .optional()
        .describe('Logging configuration'),
      metrics: z
        .object({
          provider: z.string().optional(),
          scrape_interval: z.string().optional(),
          retention: z.string().optional(),
        })
        .optional()
        .describe('Metrics configuration'),
      tracing: z
        .object({
          enabled: z.boolean().optional(),
          provider: z.string().optional(),
          sample_rate: z.number().optional(),
        })
        .optional()
        .describe('Tracing configuration'),
      alerting: z
        .object({
          enabled: z.boolean().optional(),
          channels: z.array(z.string()).optional(),
        })
        .optional()
        .describe('Alerting configuration'),
      config: z.record(z.unknown()).optional().describe('Additional observability configuration'),
    }),
  },
};

/**
 * Input parameters for set_observability
 */
export interface SetObservabilityInput {
  logging?: {
    level?: string;
    format?: string;
    retention_days?: number;
    [key: string]: unknown;
  };
  metrics?: {
    provider?: string;
    scrape_interval?: string;
    retention?: string;
    [key: string]: unknown;
  };
  tracing?: {
    enabled?: boolean;
    provider?: string;
    sample_rate?: number;
    [key: string]: unknown;
  };
  alerting?: {
    enabled?: boolean;
    channels?: string[];
    [key: string]: unknown;
  };
  config?: Record<string, unknown>;
}

/**
 * Options for the setObservability handler
 */
export interface SetObservabilityOptions {
  baseDir: string;
}

/**
 * Handler function for set_observability tool
 *
 * @param input - Observability configuration parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with WriteResponse containing created/updated observability config
 */
export async function setObservability(
  input: SetObservabilityInput,
  options: SetObservabilityOptions
): Promise<ToolResponse<WriteResponse & { entity: Observability }>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: ['architecture/observability.yaml'],
  };

  // Build observability config from input
  const observabilityConfig: Partial<Observability> = {};

  if (input.logging) {
    observabilityConfig.logging = input.logging as any;
  }

  if (input.metrics) {
    observabilityConfig.metrics = input.metrics as any;
  }

  if (input.tracing) {
    observabilityConfig.tracing = input.tracing as any;
  }

  if (input.alerting) {
    observabilityConfig.alerting = input.alerting as any;
  }

  if (input.config) {
    observabilityConfig.config = input.config as any;
  }

  // Upsert the observability config via store (creates if not exists, merges if exists)
  const upsertResult = await store.setObservability(observabilityConfig);

  if (!upsertResult.success) {
    return {
      success: false,
      error: upsertResult.error,
      metadata,
    };
  }

  // Determine if this was a create or update
  const operation = upsertResult.data.logging || upsertResult.data.metrics ? 'update' : 'create';

  // Build next steps
  const nextSteps: string[] = [
    'Review logging, metrics, and tracing configurations',
    'Configure observability agents and exporters',
  ];

  if (input.metrics?.provider) {
    nextSteps.push(`Configure ${input.metrics.provider} integration`);
  }

  if (input.tracing?.enabled) {
    nextSteps.push('Instrument services with tracing SDK');
  }

  // Build WriteResponse
  const writeResponse: WriteResponse & { entity: Observability } = {
    entity: upsertResult.data,
    filePath: `${options.baseDir}/architecture/observability.yaml`,
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
export function formatMcpResult(
  response: ToolResponse<WriteResponse & { entity: Observability }>
) {
  if (response.success && response.data) {
    const { entity, filePath, operation, nextSteps } = response.data;

    const textParts = [
      operation === 'create'
        ? `✅ Observability configuration created successfully`
        : `✅ Observability configuration updated successfully`,
      `📁 File: ${filePath}`,
    ];

    if (entity.logging) {
      textParts.push(
        `📝 Logging: level=${entity.logging.level || 'default'}, format=${entity.logging.format || 'default'}`
      );
    }

    if (entity.metrics) {
      textParts.push(`📊 Metrics: provider=${entity.metrics.provider || 'not set'}`);
    }

    if (entity.tracing) {
      textParts.push(`🔍 Tracing: ${entity.tracing.enabled ? 'enabled' : 'disabled'}`);
    }

    if (entity.alerting) {
      textParts.push(`🔔 Alerting: ${entity.alerting.enabled ? 'enabled' : 'disabled'}`);
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
