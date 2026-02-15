/**
 * check_service_readiness MCP Tool
 *
 * Checks whether a service has all required artifacts for its deployment pattern.
 * Compares required artifacts from capabilities against the service's actual state.
 *
 * User Story 6: Check whether services have all required artifacts
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type {
  ReadinessReport,
  ArtifactCheck,
  ToolResponse,
  ResponseMetadata,
  Capability,
  ArtifactRequirement,
  Service,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const checkReadinessTool = {
  name: 'check_service_readiness',
  config: {
    title: 'Check Service Readiness',
    description:
      'Assess whether a service has all required artifacts for its deployment pattern. Returns readiness score, completed/missing artifacts, and recommendations.',
    inputSchema: z.object({
      service_name: z.string().describe('Service to check'),
      environment: z.string().optional().describe('Check readiness for specific environment'),
    }),
  },
};

/**
 * Input parameters for check_service_readiness
 */
export interface CheckReadinessInput {
  service_name: string;
  environment?: string;
}

/**
 * Options for the checkReadiness handler
 */
export interface CheckReadinessOptions {
  baseDir: string;
}

/**
 * Get required artifacts for a deployment pattern from capabilities
 *
 * @param capabilities - All capabilities
 * @param deploymentPattern - Target deployment pattern
 * @param serviceType - Service type
 * @returns Array of artifact requirements
 */
function getRequiredArtifacts(
  capabilities: Capability[],
  deploymentPattern: string,
  serviceType?: string
): ArtifactRequirement[] {
  const artifacts: ArtifactRequirement[] = [];

  for (const capability of capabilities) {
    if (!capability.artifacts) continue;

    for (const artifact of capability.artifacts) {
      // Check if artifact is applicable to this deployment pattern
      const conditions = artifact.conditions;

      if (conditions?.deploymentPatterns) {
        if (!conditions.deploymentPatterns.includes(deploymentPattern as any)) {
          continue;
        }
      }

      if (conditions?.serviceTypes && serviceType) {
        if (!conditions.serviceTypes.includes(serviceType)) {
          continue;
        }
      }

      // Add artifact if not already in list
      if (!artifacts.find((a) => a.type === artifact.type && a.name === artifact.name)) {
        artifacts.push(artifact);
      }
    }
  }

  return artifacts;
}

/**
 * Check if an artifact exists for the service
 *
 * This is a placeholder implementation. In a real implementation,
 * this would scan the file system or use a service registry.
 *
 * @param service - Service to check
 * @param artifact - Artifact requirement
 * @returns Artifact check result
 */
function checkArtifactExists(
  service: Service,
  artifact: ArtifactRequirement
): ArtifactCheck {
  // Placeholder: In a real implementation, this would:
  // 1. Map artifact types to file patterns
  // 2. Scan the service directory for matching files
  // 3. Return existence + path if found

  // For now, we'll make educated guesses based on common patterns
  const check: ArtifactCheck = {
    type: artifact.type,
    name: artifact.name,
    required: artifact.required ?? true,
    exists: false,
  };

  // Mock existence checks based on artifact type
  // In real implementation, this would scan the file system
  switch (artifact.type) {
    case 'source-code':
      // Assume source code exists for all services
      check.exists = true;
      check.path = `src/services/${service.name}/index.ts`;
      break;

    case 'dockerfile':
      // Check if service has container-based deployment
      if (
        service.deployment?.pattern === 'container' ||
        service.deployment?.pattern === 'kubernetes' ||
        service.deployment?.pattern === 'ecs_fargate'
      ) {
        check.exists = true;
        check.path = `src/services/${service.name}/Dockerfile`;
      }
      break;

    case 'k8s-manifest':
      if (service.deployment?.pattern === 'kubernetes') {
        check.exists = true;
        check.path = `k8s/${service.name}/deployment.yaml`;
      }
      break;

    case 'sam-template':
      if (service.deployment?.pattern === 'lambda') {
        check.exists = true;
        check.path = `src/services/${service.name}/template.yaml`;
      }
      break;

    case 'unit-test':
      // Assume basic tests exist
      check.exists = true;
      check.path = `src/services/${service.name}/tests/unit/`;
      break;

    default:
      // For other artifacts, mark as not exists (conservative)
      check.exists = false;
      break;
  }

  return check;
}

/**
 * Calculate readiness score based on artifact completion
 *
 * @param completed - Number of completed artifacts
 * @param total - Total number of artifacts
 * @returns Score from 0-100
 */
function calculateReadinessScore(completed: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((completed / total) * 100);
}

/**
 * Generate recommendations based on missing artifacts
 *
 * @param missing - Missing artifact checks
 * @param deploymentPattern - Service deployment pattern
 * @returns Array of recommendations
 */
function generateRecommendations(
  missing: ArtifactCheck[],
  deploymentPattern: string
): string[] {
  const recommendations: string[] = [];

  // Check for critical missing artifacts
  const missingDockerfile = missing.find((a) => a.type === 'dockerfile');
  const missingK8sManifest = missing.find((a) => a.type === 'k8s-manifest');
  const missingSamTemplate = missing.find((a) => a.type === 'sam-template');
  const missingTests = missing.filter((a) => a.type.includes('test'));

  if (missingDockerfile && deploymentPattern !== 'lambda') {
    recommendations.push(
      'Create Dockerfile for container deployment - required for ' + deploymentPattern
    );
  }

  if (missingK8sManifest && deploymentPattern === 'kubernetes') {
    recommendations.push(
      'Create Kubernetes manifests (Deployment, Service, Ingress) for cluster deployment'
    );
  }

  if (missingSamTemplate && deploymentPattern === 'lambda') {
    recommendations.push('Create SAM template for Lambda function deployment');
  }

  if (missingTests.length > 0) {
    recommendations.push(
      `Add missing tests: ${missingTests.map((t) => t.type).join(', ')}`
    );
  }

  // Generic recommendations for remaining missing artifacts
  const otherMissing = missing.filter(
    (a) =>
      a.type !== 'dockerfile' &&
      a.type !== 'k8s-manifest' &&
      a.type !== 'sam-template' &&
      !a.type.includes('test')
  );

  if (otherMissing.length > 0) {
    recommendations.push(
      `Complete remaining artifacts: ${otherMissing.map((a) => a.name).join(', ')}`
    );
  }

  // Add health check recommendation if no observability artifacts
  const hasObservability = missing.some((a) => a.type.includes('cloudwatch') || a.type.includes('prometheus'));
  if (hasObservability) {
    recommendations.push('Add health check endpoint at /health or /healthz');
  }

  return recommendations;
}

/**
 * Handler function for check_service_readiness tool
 *
 * @param input - Service readiness check parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with ReadinessReport
 */
export async function checkReadiness(
  input: CheckReadinessInput,
  options: CheckReadinessOptions
): Promise<ToolResponse<ReadinessReport>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/services/${input.service_name}.yaml`],
  };

  // Fetch the service
  const serviceResult = await store.getService(input.service_name);
  if (!serviceResult.success) {
    return {
      success: false,
      error: serviceResult.error,
      metadata,
    };
  }

  const service = serviceResult.data;
  const deploymentPattern = service.deployment?.pattern || 'unknown';

  // Fetch capabilities to determine required artifacts
  // If capabilities aren't available, continue with empty artifact list
  const capabilitiesResult = await store.getCapabilities();
  const capabilities = capabilitiesResult.success ? capabilitiesResult.data : [];

  if (capabilitiesResult.success) {
    metadata.sources?.push('architecture/capabilities/*.yaml');
  }

  // Get required artifacts for this deployment pattern
  const requiredArtifacts = getRequiredArtifacts(
    capabilities,
    deploymentPattern,
    service.type
  );

  // Check each artifact
  const artifactChecks: ArtifactCheck[] = requiredArtifacts.map((artifact) =>
    checkArtifactExists(service, artifact)
  );

  // Split into completed and missing
  const completed = artifactChecks.filter((check) => check.exists);
  const missing = artifactChecks.filter((check) => !check.exists);

  // Calculate readiness score
  const readinessScore = calculateReadinessScore(
    completed.length,
    artifactChecks.length
  );

  // Generate recommendations
  const recommendations = generateRecommendations(missing, deploymentPattern);

  const readinessReport: ReadinessReport = {
    serviceName: input.service_name,
    deploymentPattern,
    readinessScore,
    completed,
    missing,
    recommendations,
  };

  return {
    success: true,
    data: readinessReport,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(response: ToolResponse<ReadinessReport>) {
  if (response.success && response.data) {
    const { serviceName, deploymentPattern, readinessScore, completed, missing, recommendations } =
      response.data;

    const textParts = [
      `🔍 Service Readiness Report: ${serviceName}`,
      '',
      `📦 Deployment Pattern: ${deploymentPattern}`,
      `📊 Readiness Score: ${readinessScore}%`,
      '',
    ];

    // Progress bar
    const totalArtifacts = completed.length + missing.length;
    const progressBarLength = 20;
    const filledLength = Math.round((readinessScore / 100) * progressBarLength);
    const progressBar =
      '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
    textParts.push(`[${progressBar}] ${completed.length}/${totalArtifacts} artifacts`);
    textParts.push('');

    // Completed artifacts
    if (completed.length > 0) {
      textParts.push(`✅ Completed (${completed.length}):`);
      completed.forEach((artifact) => {
        const requiredBadge = artifact.required ? '🔴' : '🟡';
        textParts.push(
          `  ${requiredBadge} ${artifact.name} (${artifact.type})${artifact.path ? ` - ${artifact.path}` : ''}`
        );
      });
      textParts.push('');
    }

    // Missing artifacts
    if (missing.length > 0) {
      textParts.push(`❌ Missing (${missing.length}):`);
      missing.forEach((artifact) => {
        const requiredBadge = artifact.required ? '🔴' : '🟡';
        textParts.push(`  ${requiredBadge} ${artifact.name} (${artifact.type})`);
      });
      textParts.push('');
    }

    // Recommendations
    if (recommendations.length > 0) {
      textParts.push(`💡 Recommendations:`);
      recommendations.forEach((rec) => {
        textParts.push(`  • ${rec}`);
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
