/**
 * get_capability_requirements MCP Tool
 *
 * Returns the artifact checklist for a capability operation, expanded for a specific deployment pattern.
 * This is the CORE value proposition of the MCP: AI knows what "production-ready" means.
 *
 * User Story 8: AI calls get_capability_requirements("create_service", {pattern: "lambda"})
 *               and gets the COMPLETE artifact checklist.
 * User Story 9: Different deployment patterns return different infrastructure artifacts.
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type {
  ToolResponse,
  Capability,
  ArtifactRequirement,
  DeploymentPattern,
  ValidationStep,
  CapabilityInput,
  ResponseMetadata,
} from '../../../shared/types/index.js';

/**
 * Expanded capability with pattern-filtered artifacts
 */
export interface ExpandedCapability {
  id: string;
  name: string;
  description?: string;
  category?: string;
  artifacts: ArtifactRequirement[];
  pattern?: string;
  patternNotes?: string;
  excludedArtifactTypes?: string[];
  workflow?: Array<{
    step: number;
    action: string;
    description?: string | undefined;
    artifacts?: string[] | undefined;
  }>;
  validations?: ValidationStep[] | undefined;
  inputs?: CapabilityInput[] | undefined;
}

/**
 * Tool definition for MCP server registration
 */
export const getCapabilityRequirementsTool = {
  name: 'get_capability_requirements',
  config: {
    title: 'Get Capability Requirements',
    description:
      'Retrieve the artifact checklist for a capability operation, optionally expanded for a specific deployment pattern. Returns what artifacts (code, tests, infrastructure, CI/CD, observability) are required to complete the operation in a production-ready way.',
    inputSchema: z.object({
      capability_id: z
        .string()
        .describe('Capability identifier (e.g., "create_service", "add_endpoint")'),
      pattern: z
        .string()
        .optional()
        .describe(
          'Deployment pattern for pattern-specific artifacts (e.g., "lambda", "ecs_fargate", "kubernetes")'
        ),
      service_name: z
        .string()
        .optional()
        .describe(
          'Service name to infer deployment pattern from service config (used when pattern is not explicitly provided)'
        ),
    }),
  },
};

/**
 * Input parameters for get_capability_requirements
 */
export interface GetCapabilityRequirementsInput {
  capability_id: string;
  pattern?: string;
  service_name?: string;
}

/**
 * Options for the getCapabilityRequirements handler
 */
export interface GetCapabilityRequirementsOptions {
  baseDir: string;
}

/**
 * Expand a capability with pattern-specific artifact filtering.
 *
 * Pure function (no I/O) that applies two layers of filtering:
 * 1. conditions.deploymentPatterns on baseArtifacts (whitelist)
 * 2. patternArtifacts.excludes (blacklist)
 *
 * @param capability - The capability definition to expand
 * @param pattern - Optional deployment pattern for filtering
 * @returns Expanded capability with filtered artifact list
 */
export function expandCapability(capability: Capability, pattern?: string): ExpandedCapability {
  let artifacts: ArtifactRequirement[] = [...(capability.baseArtifacts ?? [])];
  let patternNotes: string | undefined;
  let excludedTypes: string[] = [];

  if (pattern) {
    // Layer 1: Filter baseArtifacts by conditions.deploymentPatterns (whitelist)
    // If an artifact has conditions.deploymentPatterns defined,
    // only keep it if the array includes the requested pattern
    artifacts = artifacts.filter((artifact) => {
      if (!artifact.conditions?.deploymentPatterns) {
        return true;
      }
      return artifact.conditions.deploymentPatterns.includes(pattern as DeploymentPattern);
    });

    // Layer 2: Find matching patternArtifacts entry
    const patternEntry = capability.patternArtifacts?.find((pa) => pa.pattern === pattern);

    if (patternEntry) {
      // Add pattern-specific artifacts
      artifacts = [...artifacts, ...patternEntry.artifacts];

      // Apply excludes -- remove any artifacts whose type is in the excludes list
      if (patternEntry.excludes && patternEntry.excludes.length > 0) {
        excludedTypes = patternEntry.excludes;
        artifacts = artifacts.filter((artifact) => !patternEntry.excludes!.includes(artifact.type));
      }

      patternNotes = patternEntry.notes;
    }
  }

  const result: ExpandedCapability = {
    id: capability.id,
    name: capability.name,
    artifacts,
  };

  if (capability.description) result.description = capability.description;
  if (capability.category) result.category = capability.category;
  if (pattern) result.pattern = pattern;
  if (patternNotes) result.patternNotes = patternNotes;
  if (excludedTypes.length > 0) result.excludedArtifactTypes = excludedTypes;
  if (capability.workflow) result.workflow = capability.workflow;
  if (capability.validations) result.validations = capability.validations;
  if (capability.inputs) result.inputs = capability.inputs;

  return result;
}

/**
 * Handler function for get_capability_requirements tool
 *
 * @param input - Capability ID, optional pattern, optional service name
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with expanded capability or error
 */
export async function getCapabilityRequirements(
  input: GetCapabilityRequirementsInput,
  options: GetCapabilityRequirementsOptions
): Promise<ToolResponse<ExpandedCapability>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  // Determine pattern: explicit parameter takes precedence over service lookup
  let pattern = input.pattern;

  // If no explicit pattern but service_name provided, infer from service config
  if (!pattern && input.service_name) {
    const serviceResult = await store.getService(input.service_name);
    if (serviceResult.success) {
      pattern = serviceResult.data.deployment?.pattern;
    }
    // If service lookup fails, continue without pattern (graceful degradation)
  }

  // Load all capabilities
  const capabilitiesResult = await store.getCapabilities();

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: ['architecture/capabilities/'],
  };

  if (!capabilitiesResult.success) {
    if (
      capabilitiesResult.error.type === 'file' &&
      capabilitiesResult.error.message.includes('not found')
    ) {
      return {
        success: false,
        error: {
          ...capabilitiesResult.error,
          message:
            'No capabilities defined. Create capability YAML files in architecture/capabilities/ directory.',
        },
        metadata,
      };
    }
    return {
      success: false,
      error: capabilitiesResult.error,
      metadata,
    };
  }

  // Find the requested capability
  const capability = capabilitiesResult.data.find((c) => c.id === input.capability_id);

  if (!capability) {
    const availableIds = capabilitiesResult.data.map((c) => c.id).join(', ');
    return {
      success: false,
      error: {
        type: 'validation',
        message: `Capability '${input.capability_id}' not found. Available capabilities: ${availableIds || 'none'}`,
        path: 'capability_id',
      },
      metadata,
    };
  }

  // Expand the capability with pattern-specific artifacts
  const expanded = expandCapability(capability, pattern);

  // Track service source if it was used for pattern inference
  if (input.service_name && pattern && !input.pattern) {
    metadata.sources = [
      `architecture/services/${input.service_name}.yaml`,
      ...(metadata.sources ?? []),
    ];
  }

  return {
    success: true,
    data: expanded,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(response: ToolResponse<ExpandedCapability>) {
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
