/**
 * ADR Schema
 *
 * Architecture Decision Record schema for documenting decisions,
 * their rationale, trade-offs, and reconsideration conditions.
 */

import { z } from 'zod';

/**
 * ADR status values
 */
export const ADRStatusSchema = z.enum([
  'proposed',
  'accepted',
  'deprecated',
  'superseded',
  'rejected',
]);

/**
 * Stakeholder who participated in the decision
 */
export const StakeholderSchema = z.looseObject({
  name: z.string(),
  role: z.string().optional(),
  opinion: z.enum(['for', 'against', 'neutral']).optional(),
});

/**
 * Option that was considered
 */
export const OptionSchema = z.looseObject({
  name: z.string().describe('Option name'),
  description: z.string().optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  selected: z.boolean().default(false),
});

/**
 * Trade-off associated with the decision
 */
export const TradeOffSchema = z.looseObject({
  description: z.string().describe('What was traded off'),
  gained: z.string().optional().describe('What was gained'),
  lost: z.string().optional().describe('What was sacrificed'),
  mitigation: z.string().optional().describe('How the loss is mitigated'),
});

/**
 * Condition that would trigger reconsideration of the decision
 */
export const ReconsiderationConditionSchema = z.looseObject({
  trigger: z.string().describe('What would trigger reconsideration'),
  likelihood: z.enum(['low', 'medium', 'high']).optional(),
  impact: z.enum(['low', 'medium', 'high']).optional(),
  monitoringMetric: z.string().optional().describe('Metric to monitor for this condition'),
});

/**
 * Reference to related ADRs or documents
 */
export const ReferenceSchema = z.looseObject({
  type: z.enum(['adr', 'document', 'url', 'ticket']),
  id: z.string().describe('Reference identifier'),
  title: z.string().optional(),
  url: z.string().optional(),
  relationship: z.enum(['supersedes', 'superseded-by', 'related', 'implements', 'conflicts']).optional(),
});

/**
 * ADR Schema - Architecture Decision Record
 */
export const ADRSchema = z.looseObject({
  // Schema version for migrations
  schemaVersion: z.string().default('1.0.0'),

  // Identification
  id: z.string().describe('Unique ADR identifier (e.g., ADR-001)'),
  title: z.string().min(1).describe('Decision title'),

  // Lifecycle
  status: ADRStatusSchema.default('proposed'),
  date: z.string().describe('Decision date (ISO 8601)'),
  lastUpdated: z.string().optional().describe('Last update date'),

  // Context
  context: z.string().describe('What is the issue that motivates this decision?'),

  // Decision
  decision: z.string().describe('What is the decision that was made?'),

  // Rationale
  rationale: z.string().optional().describe('Why was this decision made?'),

  // Options considered
  options: z.array(OptionSchema).optional(),

  // Consequences
  consequences: z
    .object({
      positive: z.array(z.string()).optional(),
      negative: z.array(z.string()).optional(),
      neutral: z.array(z.string()).optional(),
    })
    .optional(),

  // Trade-offs
  tradeOffs: z.array(TradeOffSchema).optional(),

  // Reconsideration conditions
  reconsiderWhen: z.array(ReconsiderationConditionSchema).optional(),

  // Scope and applicability
  scope: z
    .looseObject({
      services: z.array(z.string()).optional().describe('Services affected'),
      environments: z.array(z.string()).optional().describe('Environments affected'),
      teams: z.array(z.string()).optional().describe('Teams affected'),
    })
    .optional(),

  // People involved
  stakeholders: z.array(StakeholderSchema).optional(),
  deciders: z.array(z.string()).optional().describe('Who made the final decision'),

  // Related documents
  references: z.array(ReferenceSchema).optional(),

  // Tags for categorization
  tags: z.array(z.string()).optional(),

  // Notes and additional context
  notes: z.string().optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type ADRStatus = z.infer<typeof ADRStatusSchema>;
export type Stakeholder = z.infer<typeof StakeholderSchema>;
export type Option = z.infer<typeof OptionSchema>;
export type TradeOff = z.infer<typeof TradeOffSchema>;
export type ReconsiderationCondition = z.infer<typeof ReconsiderationConditionSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
export type ADR = z.infer<typeof ADRSchema>;
