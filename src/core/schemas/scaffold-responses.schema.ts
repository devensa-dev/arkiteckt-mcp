/**
 * Scaffold Response Schemas
 *
 * Types for scaffolding and readiness checking responses.
 * Scaffolding provides ordered, deployment-pattern-aware workflows
 * that guide developers through building a service end to end.
 */

import { z } from 'zod';
import { ArtifactTypeSchema } from './capability.schema.js';

// ============================================================================
// Workflow Step — a single step in a scaffolding workflow
// ============================================================================

export const WorkflowStepSchema = z.object({
  stepNumber: z.number().int().positive().describe('Order in the workflow'),
  category: z
    .enum(['code', 'infrastructure', 'testing', 'observability', 'security', 'documentation'])
    .describe('Step category'),
  title: z.string().describe('Short step title'),
  description: z.string().describe('Detailed step description'),
  artifacts: z
    .array(
      z.object({
        type: ArtifactTypeSchema,
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean().default(true),
      })
    )
    .describe('Artifacts produced in this step'),
  patternSpecific: z.boolean().describe('Whether this step varies by deployment pattern'),
  environmentNotes: z.record(z.string(), z.string()).describe('Per-environment notes (e.g., { dev: "...", prod: "..." })'),
});

// ============================================================================
// Scaffold Response — full scaffolding output
// ============================================================================

export const ScaffoldResponseSchema = z.object({
  service: z.unknown().describe('Created service config (Service type at runtime)'),
  filePath: z.string().describe('Path to written service YAML'),
  workflow: z.array(WorkflowStepSchema).describe('Ordered workflow steps'),
  checklist: z.array(z.string()).describe('Flat human-readable checklist'),
});

// ============================================================================
// Artifact Check — single artifact in a readiness report
// ============================================================================

export const ArtifactCheckSchema = z.object({
  type: z.string().describe('Artifact type from capability schema'),
  name: z.string().describe('Artifact name'),
  required: z.boolean().describe('Whether this artifact is required'),
  exists: z.boolean().describe('Whether this artifact was found'),
  path: z.string().optional().describe('Where the artifact was found (if exists)'),
});

// ============================================================================
// Readiness Report — service readiness assessment
// ============================================================================

export const ReadinessReportSchema = z.object({
  serviceName: z.string(),
  deploymentPattern: z.string(),
  readinessScore: z.number().min(0).max(100).describe('Completeness score 0-100'),
  completed: z.array(ArtifactCheckSchema).describe('Artifacts that exist'),
  missing: z.array(ArtifactCheckSchema).describe('Artifacts that are missing'),
  recommendations: z.array(z.string()).describe('Human-readable recommendations'),
});

// ============================================================================
// Type inference
// ============================================================================

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type ScaffoldResponse = z.infer<typeof ScaffoldResponseSchema>;
export type ArtifactCheck = z.infer<typeof ArtifactCheckSchema>;
export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;
