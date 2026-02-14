/**
 * Scan Result Schemas
 *
 * Types for codebase scanning output. The scanner detects services,
 * dependencies, deployment patterns, CI/CD, and observability from
 * an existing codebase and returns structured results for user review.
 */

import { z } from 'zod';
import { DeploymentPatternSchema, ServiceTypeSchema } from './service.schema.js';

// ============================================================================
// Detected Dependency — inter-service dependency found in source code
// ============================================================================

export const DetectedDependencySchema = z.object({
  targetService: z.string().describe('Name of the dependency (must match another detected service)'),
  type: z.enum(['sync', 'async', 'unknown']).describe('Communication type'),
  protocol: z.string().optional().describe('Protocol (http, grpc, amqp, etc.)'),
  evidence: z.string().describe('Where/how the dependency was detected'),
});

// ============================================================================
// Detected Service — a service found during codebase scan
// ============================================================================

export const DetectedServiceSchema = z.object({
  name: z.string().describe('Inferred service name'),
  path: z.string().describe('Relative path in project'),
  type: ServiceTypeSchema.optional().describe('Inferred service type'),
  runtime: z
    .object({
      language: z.string().describe('Programming language'),
      version: z.string().optional().describe('Language version'),
      framework: z.string().optional().describe('Framework (express, spring, etc.)'),
    })
    .optional(),
  deploymentPattern: DeploymentPatternSchema.optional().describe('Inferred deployment pattern'),
  deploymentEvidence: z.array(z.string()).describe('Evidence for inferred deployment pattern'),
  dependencies: z.array(DetectedDependencySchema).describe('Detected dependencies on other services'),
  confidence: z.number().min(0).max(1).describe('Detection confidence (0.0–1.0)'),
});

// ============================================================================
// Detected CI/CD — pipeline configuration found
// ============================================================================

export const DetectedCICDSchema = z.object({
  provider: z.string().describe('CI/CD provider (github-actions, gitlab-ci, etc.)'),
  configFile: z.string().describe('Path to CI/CD configuration file'),
  steps: z.array(z.string()).describe('Detected pipeline step names'),
});

// ============================================================================
// Detected Observability — monitoring/alerting tools found
// ============================================================================

export const DetectedObservabilitySchema = z.object({
  tools: z.array(z.string()).describe('Detected observability tools (datadog, prometheus, etc.)'),
  evidence: z.array(z.string()).describe('Where/how the tools were detected'),
});

// ============================================================================
// Detected System — project-level metadata
// ============================================================================

export const DetectedSystemSchema = z.object({
  name: z.string().optional().describe('Project name from package.json or repo name'),
  cloud: z.string().optional().describe('Cloud provider inferred from infra files'),
  region: z.string().optional().describe('Region inferred from configuration'),
});

// ============================================================================
// Scan Written Files — output when write=true
// ============================================================================

export const ScanWrittenFilesSchema = z.object({
  files: z.array(z.string()).describe('YAML files written to architecture/'),
  skipped: z.array(z.string()).describe('Files skipped (already exist, etc.)'),
  errors: z.array(z.string()).describe('Files that failed to write'),
});

// ============================================================================
// Scan Result — full output from codebase scan
// ============================================================================

export const ScanResultSchema = z.object({
  services: z.array(DetectedServiceSchema).describe('Detected services'),
  cicd: DetectedCICDSchema.optional().describe('Detected CI/CD configuration'),
  observability: DetectedObservabilitySchema.optional().describe('Detected observability setup'),
  system: DetectedSystemSchema.optional().describe('Detected project metadata'),
  scanDuration: z.number().describe('Scan duration in milliseconds'),
  warnings: z.array(z.string()).describe('Warnings about ambiguous or skipped items'),
  written: ScanWrittenFilesSchema.optional().describe('Files written (only when write=true)'),
});

// ============================================================================
// Type inference
// ============================================================================

export type DetectedDependency = z.infer<typeof DetectedDependencySchema>;
export type DetectedService = z.infer<typeof DetectedServiceSchema>;
export type DetectedCICD = z.infer<typeof DetectedCICDSchema>;
export type DetectedObservability = z.infer<typeof DetectedObservabilitySchema>;
export type DetectedSystem = z.infer<typeof DetectedSystemSchema>;
export type ScanWrittenFiles = z.infer<typeof ScanWrittenFilesSchema>;
export type ScanResult = z.infer<typeof ScanResultSchema>;
