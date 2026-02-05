/**
 * Rule Schema
 *
 * Enforceable constraint definitions with scope, requirement,
 * severity, and explanation. Rules can be used to validate
 * architecture compliance.
 */

import { z } from 'zod';

/**
 * Rule severity levels
 */
export const RuleSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

/**
 * Rule scope - where the rule applies
 */
export const RuleScopeSchema = z.looseObject({
  // Apply to all or specific items
  all: z.boolean().optional().describe('Apply to all items in scope'),

  // Specific targets
  services: z.array(z.string()).optional().describe('Specific services'),
  environments: z.array(z.string()).optional().describe('Specific environments'),
  tenants: z.array(z.string()).optional().describe('Specific tenants'),

  // Pattern matching
  servicePattern: z.string().optional().describe('Regex pattern for service names'),
  tagSelector: z.record(z.string(), z.string()).optional().describe('Match by tags'),

  // Type matching
  serviceTypes: z.array(z.string()).optional().describe('Service types (api, worker, etc.)'),
  deploymentPatterns: z.array(z.string()).optional().describe('Deployment patterns (lambda, ecs, etc.)'),
});

/**
 * Rule condition - what triggers the rule
 * Supports simple property checks and custom expressions.
 * For complex logical operations, use 'expression' with CEL/JSONPath.
 */
export const RuleConditionSchema = z.looseObject({
  // Property-based conditions
  property: z.string().optional().describe('Property path to check'),
  operator: z
    .enum(['exists', 'not-exists', 'equals', 'not-equals', 'contains', 'matches', 'gt', 'gte', 'lt', 'lte', 'in', 'not-in'])
    .optional(),
  value: z.unknown().optional().describe('Value to compare against'),

  // Custom expression (CEL, JSONPath, etc.) - use for complex logic
  expression: z.string().optional().describe('Custom expression'),
  expressionLanguage: z.enum(['cel', 'jsonpath', 'jmespath', 'rego']).optional(),

  // Logical operators - simplified to avoid recursive types
  // For complex boolean logic, use expression languages above
  allOf: z.array(z.string()).optional().describe('All conditions must match (condition IDs or expressions)'),
  anyOf: z.array(z.string()).optional().describe('Any condition must match (condition IDs or expressions)'),
  negate: z.boolean().optional().describe('Negate the condition result'),
});

/**
 * Remediation guidance
 */
export const RemediationSchema = z.looseObject({
  description: z.string().describe('How to fix the violation'),
  automated: z.boolean().default(false).describe('Can be auto-remediated'),
  command: z.string().optional().describe('Command to run for auto-remediation'),
  documentation: z.string().optional().describe('Link to documentation'),
  example: z.string().optional().describe('Example of compliant configuration'),
});

/**
 * Rule category for organization
 */
export const RuleCategorySchema = z.enum([
  'security',
  'compliance',
  'reliability',
  'performance',
  'cost',
  'operational',
  'naming',
  'documentation',
  'testing',
  'custom',
]);

/**
 * Rule Schema - Enforceable constraint
 */
export const RuleSchema = z.looseObject({
  // Schema version for migrations
  schemaVersion: z.string().default('1.0.0'),

  // Identification
  id: z.string().describe('Unique rule identifier'),
  name: z.string().min(1).describe('Rule name'),
  description: z.string().optional().describe('What this rule checks'),

  // Classification
  category: RuleCategorySchema.optional(),
  severity: RuleSeveritySchema.default('error'),

  // Enable/disable
  enabled: z.boolean().default(true),

  // Rule scope - where it applies
  scope: RuleScopeSchema,

  // Rule condition - what triggers a violation
  condition: RuleConditionSchema,

  // Requirement - what must be true
  requirement: z.string().describe('Human-readable requirement statement'),

  // Explanation for violations
  explanation: z.string().optional().describe('Why this rule exists'),

  // Remediation guidance
  remediation: RemediationSchema.optional(),

  // Exceptions
  exceptions: z
    .array(
      z.object({
        scope: RuleScopeSchema,
        reason: z.string(),
        approvedBy: z.string().optional(),
        expiresAt: z.string().optional().describe('Expiration date (ISO 8601)'),
      })
    )
    .optional(),

  // Related rules
  relatedRules: z.array(z.string()).optional().describe('Related rule IDs'),

  // Compliance mapping
  compliance: z
    .array(
      z.object({
        framework: z.string(),
        control: z.string(),
        requirement: z.string().optional(),
      })
    )
    .optional(),

  // Tags for filtering
  tags: z.array(z.string()).optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Rule set - collection of rules
 */
export const RuleSetSchema = z.looseObject({
  schemaVersion: z.string().default('1.0.0'),
  name: z.string().min(1).describe('Rule set name'),
  description: z.string().optional(),
  rules: z.array(RuleSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;
export type RuleScope = z.infer<typeof RuleScopeSchema>;
export type RuleCondition = z.infer<typeof RuleConditionSchema>;
export type Remediation = z.infer<typeof RemediationSchema>;
export type RuleCategory = z.infer<typeof RuleCategorySchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type RuleSet = z.infer<typeof RuleSetSchema>;
