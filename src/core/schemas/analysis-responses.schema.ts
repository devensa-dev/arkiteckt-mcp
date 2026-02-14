/**
 * Analysis Response Schemas
 *
 * Types for architecture validation, environment comparison,
 * and deployment pattern migration responses.
 */

import { z } from 'zod';
import { ArtifactRequirementSchema } from './capability.schema.js';

// ============================================================================
// Validation Issue — a single problem found during validation
// ============================================================================

export const ValidationIssueSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']).describe('Issue severity'),
  entity: z.string().describe('Affected entity name'),
  entityType: z.string().describe('Entity type (service, environment, etc.)'),
  path: z.string().describe('Dot-notation path to the problematic field'),
  message: z.string().describe('Human-readable issue description'),
  suggestion: z.string().optional().describe('Suggested fix'),
});

// ============================================================================
// Validation Report — cross-entity validation results
// ============================================================================

export const ValidationReportSchema = z.object({
  valid: z.boolean().describe('Whether the architecture passed all checks'),
  issues: z.array(ValidationIssueSchema).describe('All detected issues'),
  warnings: z.array(z.string()).describe('General warnings'),
  dependencyAnalysis: z.object({
    cycles: z.array(z.array(z.string())).describe('Detected circular dependency chains'),
    orphans: z.array(z.string()).describe('Services with no dependents and no dependencies'),
    missingRefs: z.array(z.string()).describe('Referenced but not defined services'),
  }),
});

// ============================================================================
// Field Diff — a single field-level difference between environments
// ============================================================================

export const FieldDiffSchema = z.object({
  path: z.string().describe('Dot-notation path to the differing field'),
  valueA: z.unknown().describe('Value in environment A'),
  valueB: z.unknown().describe('Value in environment B'),
  onlyIn: z.enum(['A', 'B']).optional().describe('Field exists in only one environment'),
});

// ============================================================================
// Environment Diff — comparison of two environments
// ============================================================================

export const EnvironmentDiffSchema = z.object({
  envA: z.string().describe('First environment name'),
  envB: z.string().describe('Second environment name'),
  differences: z.array(FieldDiffSchema).describe('All field-level differences'),
  summary: z.string().describe('Human-readable summary of differences'),
});

// ============================================================================
// Migration Step — a single step in a migration guide
// ============================================================================

export const MigrationStepSchema = z.object({
  order: z.number().int().positive().describe('Step order'),
  title: z.string().describe('Step title'),
  description: z.string().describe('Detailed step description'),
  category: z.string().describe('Step category (infrastructure, code, ci, etc.)'),
});

// ============================================================================
// Breaking Change — something that will break during migration
// ============================================================================

export const BreakingChangeSchema = z.object({
  what: z.string().describe('What will break'),
  why: z.string().describe('Why it breaks'),
  fix: z.string().describe('How to fix it'),
});

// ============================================================================
// Migration Guide — deployment pattern migration output
// ============================================================================

export const MigrationGuideSchema = z.object({
  service: z.unknown().describe('Updated service config (Service type at runtime)'),
  fromPattern: z.string().describe('Original deployment pattern'),
  toPattern: z.string().describe('Target deployment pattern'),
  artifactsToAdd: z.array(ArtifactRequirementSchema).describe('New artifacts needed'),
  artifactsToRemove: z.array(ArtifactRequirementSchema).describe('Artifacts no longer needed'),
  migrationSteps: z.array(MigrationStepSchema).describe('Ordered migration steps'),
  breakingChanges: z.array(BreakingChangeSchema).describe('Breaking changes with remediation'),
});

// ============================================================================
// Type inference
// ============================================================================

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type ValidationReport = z.infer<typeof ValidationReportSchema>;
export type FieldDiff = z.infer<typeof FieldDiffSchema>;
export type EnvironmentDiff = z.infer<typeof EnvironmentDiffSchema>;
export type MigrationStep = z.infer<typeof MigrationStepSchema>;
export type BreakingChange = z.infer<typeof BreakingChangeSchema>;
export type MigrationGuide = z.infer<typeof MigrationGuideSchema>;
