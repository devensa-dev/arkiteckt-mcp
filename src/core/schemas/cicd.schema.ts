/**
 * CI/CD Schema
 *
 * CI/CD standards including pipeline provider, required steps,
 * quality gates, and SonarQube thresholds.
 */

import { z } from 'zod';

/**
 * Pipeline provider configuration
 */
export const PipelineProviderSchema = z.enum([
  'github-actions',
  'gitlab-ci',
  'jenkins',
  'circleci',
  'azure-devops',
  'aws-codepipeline',
  'bitbucket-pipelines',
  'tekton',
  'argo-workflows',
]);

/**
 * Pipeline step definition
 */
export const PipelineStepSchema = z.looseObject({
  name: z.string().describe('Step name'),
  type: z.enum(['build', 'test', 'lint', 'security', 'quality', 'deploy', 'custom']),
  required: z.boolean().default(true),
  order: z.number().int().positive().optional().describe('Execution order'),
  timeout: z.number().int().positive().optional().describe('Step timeout in minutes'),
  command: z.string().optional().describe('Command to execute'),
  image: z.string().optional().describe('Container image for the step'),
  condition: z.string().optional().describe('Condition for running the step'),
  environment: z.record(z.string(), z.string()).optional().describe('Environment variables'),
});

/**
 * Quality gate thresholds
 */
export const QualityGateSchema = z.looseObject({
  name: z.string().describe('Gate name'),
  enabled: z.boolean().default(true),
  metric: z.string().describe('Metric to evaluate'),
  operator: z.enum(['lt', 'lte', 'gt', 'gte', 'eq']),
  threshold: z.number().describe('Threshold value'),
  failOnViolation: z.boolean().default(true),
});

/**
 * SonarQube configuration
 */
export const SonarQubeSchema = z.looseObject({
  enabled: z.boolean().default(false),
  serverUrl: z.string().optional(),
  projectKey: z.string().optional(),
  qualityGate: z.string().optional().describe('Quality gate name'),
  thresholds: z
    .looseObject({
      coverage: z.number().min(0).max(100).optional(),
      duplications: z.number().min(0).max(100).optional(),
      maintainabilityRating: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
      reliabilityRating: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
      securityRating: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
      securityHotspots: z.number().int().min(0).optional(),
      newCodeCoverage: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

/**
 * Security scanning configuration
 */
export const SecurityScanSchema = z.looseObject({
  enabled: z.boolean().default(true),
  tools: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['sast', 'dast', 'sca', 'secrets', 'container', 'iac']),
        required: z.boolean().default(true),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  failOnCritical: z.boolean().default(true),
  failOnHigh: z.boolean().default(false),
  ignorePatterns: z.array(z.string()).optional(),
});

/**
 * Artifact configuration
 */
export const ArtifactConfigSchema = z.looseObject({
  registry: z.string().optional().describe('Artifact registry URL'),
  type: z.enum(['docker', 'npm', 'maven', 'nuget', 'pypi', 'generic']).optional(),
  naming: z
    .object({
      pattern: z.string().optional().describe('Artifact naming pattern'),
      includeCommit: z.boolean().default(true),
      includeBranch: z.boolean().default(false),
    })
    .optional(),
  retention: z
    .object({
      days: z.number().int().positive().optional(),
      keepLatest: z.number().int().positive().optional(),
    })
    .optional(),
});

/**
 * Deployment configuration for CI/CD
 */
export const DeploymentStageSchema = z.looseObject({
  name: z.string().describe('Stage name'),
  environment: z.string().describe('Target environment'),
  strategy: z.enum(['rolling', 'blue-green', 'canary', 'recreate']).default('rolling'),
  manual: z.boolean().default(false).describe('Requires manual approval'),
  gates: z
    .object({
      preDeployment: z.array(z.string()).optional(),
      postDeployment: z.array(z.string()).optional(),
    })
    .optional(),
  rollback: z
    .object({
      automatic: z.boolean().default(true),
      onFailure: z.boolean().default(true),
    })
    .optional(),
});

/**
 * Branch strategy configuration
 */
export const BranchStrategySchema = z.looseObject({
  type: z.enum(['gitflow', 'github-flow', 'trunk-based', 'custom']).default('github-flow'),
  mainBranch: z.string().default('main'),
  developBranch: z.string().optional(),
  featurePrefix: z.string().default('feature/'),
  releasePrefix: z.string().optional(),
  hotfixPrefix: z.string().optional(),
  protectedBranches: z.array(z.string()).optional(),
});

/**
 * CI/CD Schema - Pipeline and deployment standards
 */
export const CICDSchema = z.looseObject({
  schemaVersion: z.string().default('1.0.0'),

  // Pipeline provider
  provider: PipelineProviderSchema.optional(),

  // Required pipeline steps
  steps: z.array(PipelineStepSchema).optional(),

  // Quality gates
  qualityGates: z.array(QualityGateSchema).optional(),

  // SonarQube configuration
  sonarqube: SonarQubeSchema.optional(),

  // Security scanning
  security: SecurityScanSchema.optional(),

  // Artifact configuration
  artifacts: ArtifactConfigSchema.optional(),

  // Deployment stages
  deploymentStages: z.array(DeploymentStageSchema).optional(),

  // Branch strategy
  branchStrategy: BranchStrategySchema.optional(),

  // Test requirements
  testing: z
    .looseObject({
      unitTests: z
        .object({
          required: z.boolean().default(true),
          coverageThreshold: z.number().min(0).max(100).default(80),
        })
        .optional(),
      integrationTests: z
        .object({
          required: z.boolean().default(true),
          environments: z.array(z.string()).optional(),
        })
        .optional(),
      e2eTests: z
        .object({
          required: z.boolean().default(false),
          environments: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),

  // Notifications
  notifications: z
    .looseObject({
      onSuccess: z.array(z.string()).optional(),
      onFailure: z.array(z.string()).optional(),
      channels: z.array(z.string()).optional(),
    })
    .optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type PipelineProvider = z.infer<typeof PipelineProviderSchema>;
export type PipelineStep = z.infer<typeof PipelineStepSchema>;
export type QualityGate = z.infer<typeof QualityGateSchema>;
export type SonarQube = z.infer<typeof SonarQubeSchema>;
export type SecurityScan = z.infer<typeof SecurityScanSchema>;
export type ArtifactConfig = z.infer<typeof ArtifactConfigSchema>;
export type DeploymentStage = z.infer<typeof DeploymentStageSchema>;
export type BranchStrategy = z.infer<typeof BranchStrategySchema>;
export type CICD = z.infer<typeof CICDSchema>;
