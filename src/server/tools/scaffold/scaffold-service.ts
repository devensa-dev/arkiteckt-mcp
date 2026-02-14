/**
 * scaffold_service MCP Tool
 *
 * Creates a new service and provides a comprehensive, ordered workflow tailored to
 * deployment pattern and environment. Guides developers through all steps needed
 * to build, test, deploy, and monitor the service.
 *
 * User Story 4: Junior developers get guided scaffolding workflows
 */

import { z } from 'zod';
import path from 'node:path';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { getServiceTemplate } from '../../../core/templates/service-templates.js';
import { expandCapability } from '../read/get-capability-requirements.js';
import { deepMerge } from '../../../core/engines/deep-merge.js';
import {
  ServiceTypeSchema,
  DeploymentPatternSchema,
} from '../../../core/schemas/index.js';
import type {
  Service,
  ToolResponse,
  ResponseMetadata,
  ArtifactRequirement,
  Environment,
} from '../../../shared/types/index.js';
import type { WorkflowStep, ScaffoldResponse } from '../../../core/schemas/scaffold-responses.schema.js';

/**
 * Tool definition for MCP server registration
 */
export const scaffoldServiceTool = {
  name: 'scaffold_service',
  config: {
    title: 'Scaffold Service',
    description:
      'Create a new service with a comprehensive, ordered workflow tailored to deployment pattern and environments. Returns service config, workflow steps organized by category, and a flat checklist.',
    inputSchema: z.object({
      name: z.string().describe('Service name (must be unique)'),
      type: ServiceTypeSchema.describe('Service type (api, worker, frontend, etc.)'),
      deployment_pattern: DeploymentPatternSchema.describe(
        'Deployment pattern (lambda, ecs_fargate, kubernetes, container)'
      ),
      description: z.string().optional().describe('Service description'),
      dependencies: z
        .array(
          z.object({
            name: z.string(),
            type: z.enum(['sync', 'async']).optional(),
            protocol: z.string().optional(),
          })
        )
        .optional()
        .describe('Service dependencies'),
      owner: z.string().optional().describe('Team or person owning this service'),
    }),
  },
};

/**
 * Input parameters for scaffold_service
 */
export interface ScaffoldServiceInput {
  name: string;
  type: string;
  deployment_pattern: string;
  description?: string;
  dependencies?: Array<{
    name: string;
    type?: 'sync' | 'async';
    protocol?: string;
  }>;
  owner?: string;
}

/**
 * Options for the scaffoldService handler
 */
export interface ScaffoldServiceOptions {
  baseDir: string;
}

/**
 * Build workflow steps from capabilities, environments, CI/CD, and observability
 */
function buildWorkflow(
  service: Service,
  artifacts: ArtifactRequirement[],
  environments: Environment[],
  hasCICD: boolean,
  hasObservability: boolean
): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  let stepNumber = 1;

  // Step 1: Code - Create source code structure
  const codeArtifacts = artifacts.filter(
    (a) => a.type === 'source-code' || a.type === 'handler' || a.type === 'controller'
  );
  steps.push({
    stepNumber: stepNumber++,
    category: 'code',
    title: 'Create source code structure',
    description: `Set up the service entry point and core logic for ${service.deployment.pattern} deployment.`,
    artifacts: codeArtifacts.map((a) => ({
      type: a.type,
      name: a.name,
      description: a.description,
      required: a.required,
    })),
    patternSpecific: true,
    environmentNotes: buildEnvironmentNotes(service, environments, 'code'),
  });

  // Step 2: Infrastructure - Set up deployment configuration
  const infraArtifacts = artifacts.filter(
    (a) =>
      a.type === 'dockerfile' ||
      a.type === 'k8s-manifest' ||
      a.type === 'sam-template' ||
      a.type === 'terraform' ||
      a.type === 'helm-chart'
  );
  if (infraArtifacts.length > 0) {
    steps.push({
      stepNumber: stepNumber++,
      category: 'infrastructure',
      title: 'Set up deployment configuration',
      description: `Create infrastructure-as-code for ${service.deployment.pattern} deployment.`,
      artifacts: infraArtifacts.map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        required: a.required,
      })),
      patternSpecific: true,
      environmentNotes: buildEnvironmentNotes(service, environments, 'infrastructure'),
    });
  }

  // Step 3: Testing - Write tests
  const testArtifacts = artifacts.filter(
    (a) => a.type === 'unit-test' || a.type === 'integration-test' || a.type === 'e2e-test'
  );
  if (testArtifacts.length > 0) {
    steps.push({
      stepNumber: stepNumber++,
      category: 'testing',
      title: 'Write unit and integration tests',
      description: 'Create comprehensive test suites to ensure service reliability.',
      artifacts: testArtifacts.map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        required: a.required,
      })),
      patternSpecific: false,
      environmentNotes: buildEnvironmentNotes(service, environments, 'testing'),
    });
  }

  // Step 4: CI/CD - Set up pipeline
  if (hasCICD) {
    const cicdArtifacts = artifacts.filter(
      (a) => a.type === 'pipeline' || a.type === 'github-action' || a.type === 'gitlab-ci'
    );
    steps.push({
      stepNumber: stepNumber++,
      category: 'infrastructure',
      title: 'Configure CI/CD pipeline',
      description: 'Set up automated build, test, and deployment pipeline.',
      artifacts: cicdArtifacts.map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        required: a.required,
      })),
      patternSpecific: true,
      environmentNotes: {
        dev: 'Auto-deploy on merge to main',
        staging: 'Auto-deploy after dev validation',
        prod: 'Manual approval required',
      },
    });
  }

  // Step 5: Observability - Add monitoring
  if (hasObservability) {
    const obsArtifacts = artifacts.filter(
      (a) =>
        a.type === 'cloudwatch-alarms' ||
        a.type === 'prometheus-rules' ||
        a.type === 'grafana-dashboard'
    );
    steps.push({
      stepNumber: stepNumber++,
      category: 'observability',
      title: 'Set up monitoring and alerts',
      description: 'Configure metrics, logs, traces, and alerts for the service.',
      artifacts: obsArtifacts.map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        required: a.required,
      })),
      patternSpecific: false,
      environmentNotes: buildEnvironmentNotes(service, environments, 'observability'),
    });
  }

  // Step 6: Security - Configure security controls
  steps.push({
    stepNumber: stepNumber++,
    category: 'security',
    title: 'Configure security controls',
    description: 'Set up IAM roles, security groups, and access policies.',
    artifacts: artifacts
      .filter(
        (a) => a.type === 'iam-role' || a.type === 'iam-policy' || a.type === 'security-group'
      )
      .map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        required: a.required,
      })),
    patternSpecific: true,
    environmentNotes: {
      dev: 'Relaxed security for development',
      staging: 'Standard security controls',
      prod: 'Strict security with MFA and encryption',
    },
  });

  // Step 7: Documentation - Create documentation
  const docArtifacts = artifacts.filter(
    (a) => a.type === 'readme' || a.type === 'api-docs' || a.type === 'openapi-spec'
  );
  if (docArtifacts.length > 0) {
    steps.push({
      stepNumber: stepNumber++,
      category: 'documentation',
      title: 'Create documentation',
      description: 'Document service API, deployment process, and operational runbooks.',
      artifacts: docArtifacts.map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        required: a.required,
      })),
      patternSpecific: false,
      environmentNotes: {},
    });
  }

  return steps;
}

/**
 * Build environment-specific notes for a workflow category
 */
function buildEnvironmentNotes(
  service: Service,
  environments: Environment[],
  category: string
): Record<string, string> {
  const notes: Record<string, string> = {};

  for (const env of environments) {
    if (category === 'code') {
      if (env.stage === 'dev' || env.stage === 'development') {
        notes[env.name] = 'Use local dependencies and mock external services';
      } else if (env.stage === 'prod' || env.stage === 'production') {
        notes[env.name] = 'Use production-ready dependencies and real integrations';
      }
    } else if (category === 'infrastructure') {
      if (env.availability?.multiAZ) {
        notes[env.name] = `Deploy across ${env.availability.replicas || 2} replicas in multiple AZs`;
      } else {
        notes[env.name] = `Single-instance deployment (${env.availability?.replicas || 1} replica)`;
      }
    } else if (category === 'testing') {
      if (env.stage === 'prod' || env.stage === 'production') {
        notes[env.name] = 'Run full E2E tests before deployment';
      } else if (env.stage === 'staging') {
        notes[env.name] = 'Run integration tests after deployment';
      }
    } else if (category === 'observability') {
      if (env.stage === 'prod' || env.stage === 'production') {
        notes[env.name] = 'Critical alerts with PagerDuty integration';
      } else {
        notes[env.name] = 'Warning alerts to Slack';
      }
    }
  }

  return notes;
}

/**
 * Convert workflow to flat checklist
 */
function buildChecklist(workflow: WorkflowStep[]): string[] {
  const checklist: string[] = [];

  for (const step of workflow) {
    checklist.push(`${step.stepNumber}. [${step.category}] ${step.title}`);
  }

  return checklist;
}

/**
 * Handler function for scaffold_service tool
 *
 * @param input - Service scaffolding parameters
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with ScaffoldResponse
 */
export async function scaffoldService(
  input: ScaffoldServiceInput,
  options: ScaffoldServiceOptions
): Promise<ToolResponse<ScaffoldResponse>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });

  // Get smart defaults template for the deployment pattern
  const template = getServiceTemplate(input.deployment_pattern as any);

  // Build service config from input merged with template
  const serviceConfig: Partial<Service> = deepMerge(
    template,
    {
      name: input.name,
      type: input.type as any,
      deployment: {
        pattern: input.deployment_pattern as any,
      },
      description: input.description,
      dependencies: input.dependencies?.map((dep) => ({
        name: dep.name,
        type: (dep.type || 'sync') as 'sync' | 'async' | 'optional',
        protocol: dep.protocol,
      })),
      owner: input.owner,
    },
    { arrayStrategy: 'replace' }
  );

  // Create the service via store
  const createResult = await store.createService(input.name, serviceConfig);

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`architecture/services/${input.name}.yaml`],
  };

  if (!createResult.success) {
    return {
      success: false,
      error: createResult.error,
      metadata,
    };
  }

  const service = createResult.data;

  // Get capability artifacts for the deployment pattern
  const capabilitiesResult = await store.getCapabilities();
  let artifacts: ArtifactRequirement[] = [];

  if (capabilitiesResult.success) {
    const createServiceCap = capabilitiesResult.data.find((c) => c.id === 'create_service');
    if (createServiceCap) {
      artifacts = expandCapability(createServiceCap, {
        deploymentPattern: input.deployment_pattern,
        serviceType: input.type,
      });
    }
  }

  // Get environments for environment-specific notes
  const environmentsResult = await store.getEnvironments();
  const environments = environmentsResult.success ? environmentsResult.data : [];

  // Check for CI/CD configuration
  const cicdResult = await store.getCICD();
  const hasCICD = cicdResult.success;

  // Check for observability configuration
  const observabilityResult = await store.getObservability();
  const hasObservability = observabilityResult.success;

  // Build workflow steps
  const workflow = buildWorkflow(service, artifacts, environments, hasCICD, hasObservability);

  // Build flat checklist
  const checklist = buildChecklist(workflow);

  const response: ScaffoldResponse = {
    service,
    filePath: path.join(options.baseDir, 'architecture', 'services', `${input.name}.yaml`),
    workflow,
    checklist,
  };

  return {
    success: true,
    data: response,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(response: ToolResponse<ScaffoldResponse>) {
  if (response.success && response.data) {
    const { service, workflow, checklist } = response.data;

    const textParts = [
      `✅ Service '${service.name}' scaffolded successfully`,
      `🔧 Pattern: ${service.deployment?.pattern}`,
      `📋 ${workflow.length} workflow steps created`,
      '',
      '🚀 Workflow:',
      ...checklist.map((item) => `  ${item}`),
    ];

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

  // Error case
  return {
    content: [
      {
        type: 'text' as const,
        text: `❌ Failed to scaffold service: ${response.error?.message || 'Unknown error'}`,
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
