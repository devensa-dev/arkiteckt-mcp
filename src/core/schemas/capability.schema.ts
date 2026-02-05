/**
 * Capability Schema
 *
 * High-level operation definitions listing required artifacts.
 * Capabilities define what artifacts need to be generated for
 * operations like create_service, add_endpoint, etc.
 */

import { z } from 'zod';
import { DeploymentPatternSchema } from './service.schema.js';

/**
 * Artifact type definitions
 */
export const ArtifactTypeSchema = z.enum([
  // Code artifacts
  'source-code',
  'handler',
  'controller',
  'service-layer',
  'repository',
  'model',
  'dto',

  // Test artifacts
  'unit-test',
  'integration-test',
  'e2e-test',
  'contract-test',
  'load-test',

  // Infrastructure artifacts
  'sam-template',
  'cloudformation',
  'terraform',
  'pulumi',
  'cdk',
  'dockerfile',
  'docker-compose',
  'helm-chart',
  'k8s-manifest',
  'task-definition',
  'service-definition',

  // Configuration artifacts
  'api-gateway',
  'alb-config',
  'iam-role',
  'iam-policy',
  'security-group',
  'network-policy',

  // CI/CD artifacts
  'pipeline',
  'github-action',
  'gitlab-ci',
  'jenkinsfile',
  'buildspec',

  // Observability artifacts
  'cloudwatch-alarms',
  'cloudwatch-dashboard',
  'prometheus-rules',
  'grafana-dashboard',
  'alert-config',

  // Documentation
  'readme',
  'api-docs',
  'openapi-spec',
  'adr',

  // Custom
  'custom',
]);

/**
 * Artifact requirement for a capability
 */
export const ArtifactRequirementSchema = z.looseObject({
  type: ArtifactTypeSchema.describe('Type of artifact'),
  name: z.string().describe('Artifact name or path'),
  description: z.string().optional(),
  required: z.boolean().default(true),

  // Template reference
  template: z.string().optional().describe('Template to use for generation'),

  // Conditions for when this artifact is needed
  conditions: z
    .looseObject({
      deploymentPatterns: z.array(DeploymentPatternSchema).optional(),
      serviceTypes: z.array(z.string()).optional(),
      environments: z.array(z.string()).optional(),
      features: z.array(z.string()).optional(),
    })
    .optional(),

  // Dependencies on other artifacts
  dependsOn: z.array(z.string()).optional().describe('Other artifact types this depends on'),
});

/**
 * Pattern-specific artifacts
 */
export const PatternArtifactsSchema = z.looseObject({
  pattern: DeploymentPatternSchema,
  artifacts: z.array(ArtifactRequirementSchema),

  // Pattern-specific notes
  notes: z.string().optional(),

  // What this pattern does NOT include
  excludes: z.array(z.string()).optional().describe('Artifact types explicitly not needed'),
});

/**
 * Input parameter for a capability
 */
export const CapabilityInputSchema = z.looseObject({
  name: z.string().describe('Parameter name'),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string().optional(),
  required: z.boolean().default(true),
  default: z.unknown().optional(),
  validation: z.string().optional().describe('Validation rule or regex'),
  options: z.array(z.unknown()).optional().describe('Allowed values'),
});

/**
 * Validation step for generated artifacts
 */
export const ValidationStepSchema = z.looseObject({
  name: z.string(),
  type: z.enum(['schema', 'lint', 'test', 'security', 'custom']),
  command: z.string().optional(),
  required: z.boolean().default(true),
});

/**
 * Capability Schema - High-level operation definition
 */
export const CapabilitySchema = z.looseObject({
  // Schema version for migrations
  schemaVersion: z.string().default('1.0.0'),

  // Identification
  id: z.string().describe('Unique capability identifier (e.g., create_service)'),
  name: z.string().min(1).describe('Human-readable name'),
  description: z.string().optional(),

  // Category for organization
  category: z
    .enum(['service', 'endpoint', 'infrastructure', 'observability', 'security', 'documentation', 'custom'])
    .optional(),

  // Input parameters
  inputs: z.array(CapabilityInputSchema).optional(),

  // Base artifacts (required for all patterns)
  baseArtifacts: z.array(ArtifactRequirementSchema).optional(),

  // Pattern-specific artifacts
  patternArtifacts: z.array(PatternArtifactsSchema).optional(),

  // Validation steps
  validations: z.array(ValidationStepSchema).optional(),

  // Workflow steps (order of execution)
  workflow: z
    .array(
      z.object({
        step: z.number().int().positive(),
        action: z.string(),
        description: z.string().optional(),
        artifacts: z.array(z.string()).optional().describe('Artifact types produced in this step'),
      })
    )
    .optional(),

  // Post-creation hooks
  postActions: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['command', 'validation', 'notification']),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),

  // Related capabilities
  related: z.array(z.string()).optional().describe('Related capability IDs'),

  // Tags for filtering
  tags: z.array(z.string()).optional(),

  // Examples
  examples: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        inputs: z.record(z.string(), z.unknown()),
      })
    )
    .optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Capability set - collection of capabilities
 */
export const CapabilitySetSchema = z.looseObject({
  schemaVersion: z.string().default('1.0.0'),
  name: z.string().min(1).describe('Capability set name'),
  description: z.string().optional(),
  capabilities: z.array(CapabilitySchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;
export type ArtifactRequirement = z.infer<typeof ArtifactRequirementSchema>;
export type PatternArtifacts = z.infer<typeof PatternArtifactsSchema>;
export type CapabilityInput = z.infer<typeof CapabilityInputSchema>;
export type ValidationStep = z.infer<typeof ValidationStepSchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
export type CapabilitySet = z.infer<typeof CapabilitySetSchema>;
