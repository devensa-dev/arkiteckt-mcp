/**
 * Write Response Schemas
 *
 * Standardized response types for all write, update, and delete operations.
 * These types wrap the entity data with file path, impact analysis,
 * and guidance for downstream effects.
 */

import { z } from 'zod';
import { ArtifactRequirementSchema } from './capability.schema.js';

// ============================================================================
// Field Change — a single field that changed
// ============================================================================

export const FieldChangeSchema = z.object({
  path: z.string().describe('Dot-notation path (e.g., "runtime.version")'),
  before: z.unknown(),
  after: z.unknown(),
});

// ============================================================================
// Service Impact — how a service is affected by a change
// ============================================================================

export const ServiceImpactSchema = z.object({
  name: z.string().describe('Affected service name'),
  reason: z.string().describe('Why this service is affected (e.g., "inherits changed runtime defaults")'),
  fields: z.array(FieldChangeSchema).describe('Specific fields affected'),
});

// ============================================================================
// Artifacts Delta — new/removed artifacts when pattern changes
// ============================================================================

export const ArtifactsDeltaSchema = z.object({
  added: z.array(ArtifactRequirementSchema).describe('New artifacts needed'),
  removed: z.array(ArtifactRequirementSchema).describe('Artifacts no longer needed'),
});

// ============================================================================
// Impact Analysis — downstream effects of a write operation
// ============================================================================

export const ImpactAnalysisSchema = z.object({
  affectedServices: z.array(ServiceImpactSchema).describe('Services affected by this change'),
  affectedEnvironments: z.array(z.string()).optional().describe('Environments affected'),
  artifactsDelta: ArtifactsDeltaSchema.optional().describe('Artifact changes when pattern changes'),
});

// ============================================================================
// Write Response — standardized response for create/update operations
// ============================================================================

export const WriteResponseSchema = z.object({
  entity: z.unknown().describe('The created or updated entity'),
  filePath: z.string().describe('Absolute path to written file'),
  operation: z.enum(['create', 'update']).describe('Type of write operation'),
  impact: ImpactAnalysisSchema.optional().describe('Downstream effects'),
  nextSteps: z.array(z.string()).optional().describe('Human-readable action items'),
});

// ============================================================================
// Delete Response — standardized response for delete operations
// ============================================================================

export const DeleteResponseSchema = z.object({
  deleted: z.string().describe('Entity name that was deleted'),
  entityType: z.enum(['service', 'environment']).describe('Type of deleted entity'),
  filePath: z.string().describe('Path of deleted file'),
  warnings: z.array(z.string()).describe('Orphaned deps, broken refs, etc.'),
  forced: z.boolean().describe('Whether deletion was forced past dependency checks'),
});

// ============================================================================
// Type inference
// ============================================================================

export type FieldChange = z.infer<typeof FieldChangeSchema>;
export type ServiceImpact = z.infer<typeof ServiceImpactSchema>;
export type ArtifactsDelta = z.infer<typeof ArtifactsDeltaSchema>;
export type ImpactAnalysis = z.infer<typeof ImpactAnalysisSchema>;

/**
 * Generic write response — use with concrete entity type at the call site:
 *   WriteResponse & { entity: Service }
 */
export type WriteResponse = z.infer<typeof WriteResponseSchema>;
export type DeleteResponse = z.infer<typeof DeleteResponseSchema>;
