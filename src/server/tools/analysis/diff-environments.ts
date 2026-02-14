/**
 * diff_environments MCP Tool
 *
 * Compare two environments field-by-field and identify differences.
 * Optionally resolves environment configs for a specific service to show merged config differences.
 *
 * User Story 5: Developers get structured architecture summaries and environment comparisons
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { ResolutionEngine } from '../../../core/engines/resolution-engine.js';
import type {
  EnvironmentDiff,
  FieldDiff,
  ToolResponse,
  ResponseMetadata,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const diffEnvironmentsTool = {
  name: 'diff_environments',
  config: {
    title: 'Compare Environments',
    description:
      'Compare two environments field-by-field to identify differences. Optionally resolve configs for a specific service to show merged config differences.',
    inputSchema: z.object({
      env_a: z.string().describe('First environment name'),
      env_b: z.string().describe('Second environment name'),
      service_name: z
        .string()
        .optional()
        .describe('Resolve diff for a specific service (shows merged config differences)'),
    }),
  },
};

/**
 * Input parameters for diff_environments
 */
export interface DiffEnvironmentsInput {
  env_a: string;
  env_b: string;
  service_name?: string;
}

/**
 * Options for the diffEnvironments handler
 */
export interface DiffEnvironmentsOptions {
  baseDir: string;
}

/**
 * Compare two arbitrary objects field-by-field
 *
 * @param objA - First object
 * @param objB - Second object
 * @param prefix - Dot-notation prefix for nested fields
 * @returns Array of field differences
 */
function compareObjects(
  objA: Record<string, unknown>,
  objB: Record<string, unknown>,
  prefix = ''
): FieldDiff[] {
  const differences: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const valueA = objA[key];
    const valueB = objB[key];

    // Check if field exists in only one object
    if (!(key in objA)) {
      differences.push({
        path,
        valueA: undefined,
        valueB,
        onlyIn: 'B',
      });
      continue;
    }

    if (!(key in objB)) {
      differences.push({
        path,
        valueA,
        valueB: undefined,
        onlyIn: 'A',
      });
      continue;
    }

    // Both exist - compare values
    const isObjectA = typeof valueA === 'object' && valueA !== null && !Array.isArray(valueA);
    const isObjectB = typeof valueB === 'object' && valueB !== null && !Array.isArray(valueB);

    if (isObjectA && isObjectB) {
      // Recursively compare nested objects
      differences.push(
        ...compareObjects(
          valueA as Record<string, unknown>,
          valueB as Record<string, unknown>,
          path
        )
      );
    } else {
      // Compare primitive values or arrays
      const valueAStr = JSON.stringify(valueA);
      const valueBStr = JSON.stringify(valueB);

      if (valueAStr !== valueBStr) {
        differences.push({
          path,
          valueA,
          valueB,
        });
      }
    }
  }

  return differences;
}

/**
 * Generate human-readable summary of differences
 *
 * @param differences - Array of field differences
 * @param envA - First environment name
 * @param envB - Second environment name
 * @returns Summary string
 */
function generateSummary(differences: FieldDiff[], envA: string, envB: string): string {
  if (differences.length === 0) {
    return `${envA} and ${envB} are identical.`;
  }

  const onlyInA = differences.filter((d) => d.onlyIn === 'A');
  const onlyInB = differences.filter((d) => d.onlyIn === 'B');
  const common = differences.filter((d) => !d.onlyIn);

  const parts: string[] = [];

  if (common.length > 0) {
    parts.push(`${common.length} field${common.length === 1 ? '' : 's'} differ`);
  }

  if (onlyInA.length > 0) {
    parts.push(
      `${onlyInA.length} field${onlyInA.length === 1 ? '' : 's'} only in ${envA}`
    );
  }

  if (onlyInB.length > 0) {
    parts.push(
      `${onlyInB.length} field${onlyInB.length === 1 ? '' : 's'} only in ${envB}`
    );
  }

  return parts.join(', ') + '.';
}

/**
 * Handler function for diff_environments tool
 *
 * @param input - Environment comparison parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with EnvironmentDiff containing differences
 */
export async function diffEnvironments(
  input: DiffEnvironmentsInput,
  options: DiffEnvironmentsOptions
): Promise<ToolResponse<EnvironmentDiff>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  // Fetch both environments
  const [resultA, resultB] = await Promise.all([
    store.getEnvironment(input.env_a),
    store.getEnvironment(input.env_b),
  ]);

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [
      `architecture/environments/${input.env_a}.yaml`,
      `architecture/environments/${input.env_b}.yaml`,
    ],
  };

  // Check if both environments exist
  if (!resultA.success) {
    return {
      success: false,
      error: resultA.error,
      metadata,
    };
  }

  if (!resultB.success) {
    return {
      success: false,
      error: resultB.error,
      metadata,
    };
  }

  const envA = resultA.data;
  const envB = resultB.data;

  let differences: FieldDiff[];

  // If service_name is provided, resolve both environments for that service
  if (input.service_name) {
    const serviceResult = await store.getService(input.service_name);

    if (!serviceResult.success) {
      return {
        success: false,
        error: serviceResult.error,
        metadata,
      };
    }

    const service = serviceResult.data;
    const systemResult = await store.getSystem();

    if (!systemResult.success) {
      return {
        success: false,
        error: systemResult.error,
        metadata,
      };
    }

    const system = systemResult.data;
    const resolutionEngine = new ResolutionEngine();

    // Resolve service config for both environments
    const resolvedA = resolutionEngine.resolveService(service, envA, system);
    const resolvedB = resolutionEngine.resolveService(service, envB, system);

    metadata.sources?.push(
      `architecture/services/${input.service_name}.yaml`,
      'architecture/system.yaml'
    );

    // Compare resolved configs
    differences = compareObjects(
      resolvedA as Record<string, unknown>,
      resolvedB as Record<string, unknown>
    );
  } else {
    // Compare raw environment configs
    differences = compareObjects(
      envA as Record<string, unknown>,
      envB as Record<string, unknown>
    );
  }

  const summary = generateSummary(differences, input.env_a, input.env_b);

  const environmentDiff: EnvironmentDiff = {
    envA: input.env_a,
    envB: input.env_b,
    differences,
    summary,
  };

  return {
    success: true,
    data: environmentDiff,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(response: ToolResponse<EnvironmentDiff>) {
  if (response.success && response.data) {
    const { envA, envB, differences, summary } = response.data;

    const textParts = [
      `🔍 Environment Comparison: ${envA} vs ${envB}`,
      '',
      `📊 ${summary}`,
      '',
    ];

    if (differences.length > 0) {
      textParts.push('Differences:');
      differences.forEach((diff, i) => {
        const icon = diff.onlyIn ? '🔹' : '🔸';
        const prefix = diff.onlyIn
          ? `  ${icon} ${diff.path} (only in ${diff.onlyIn === 'A' ? envA : envB})`
          : `  ${icon} ${diff.path}`;

        if (diff.onlyIn) {
          const value = diff.onlyIn === 'A' ? diff.valueA : diff.valueB;
          textParts.push(`${prefix}: ${JSON.stringify(value)}`);
        } else {
          textParts.push(
            `${prefix}:`,
            `      ${envA}: ${JSON.stringify(diff.valueA)}`,
            `      ${envB}: ${JSON.stringify(diff.valueB)}`
          );
        }
      });
    } else {
      textParts.push('✅ No differences found.');
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
