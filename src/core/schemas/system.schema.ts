/**
 * System Schema
 *
 * Global architectural configuration including system name, cloud provider,
 * architecture style, and runtime defaults.
 *
 * Uses z.looseObject() for cloud-agnostic extensibility - users can add
 * custom fields for ANY cloud provider or pattern.
 */

import { z } from 'zod';

/**
 * Architecture styles supported by the system
 */
export const ArchitectureStyleSchema = z.enum([
  'microservices',
  'modular-monolith',
  'serverless',
  'event-driven',
  'layered',
  'hexagonal',
]);

/**
 * Default runtime configuration
 */
export const RuntimeDefaultsSchema = z.looseObject({
  language: z.string().describe('Primary programming language'),
  version: z.string().optional().describe('Language version'),
  framework: z.string().optional().describe('Primary framework'),
  packageManager: z.string().optional().describe('Package manager (npm, yarn, pnpm, etc.)'),
});

/**
 * Global defaults that apply to all services unless overridden
 */
export const GlobalDefaultsSchema = z.looseObject({
  region: z.string().optional().describe('Default cloud region'),
  account: z.string().optional().describe('Default cloud account/project'),
  tags: z.record(z.string(), z.string()).optional().describe('Default resource tags'),
  runtime: RuntimeDefaultsSchema.optional(),
});

/**
 * Repository configuration
 */
export const RepositorySchema = z.looseObject({
  type: z.enum(['monorepo', 'polyrepo']).default('monorepo'),
  provider: z.string().optional().describe('Git provider (github, gitlab, bitbucket)'),
  defaultBranch: z.string().default('main'),
});

/**
 * System Schema - Global architectural configuration
 *
 * This is the top-level schema that defines the overall system architecture.
 * All other entities inherit defaults from this configuration.
 */
export const SystemSchema = z.looseObject({
  // Schema version for migrations
  schemaVersion: z.string().default('1.0.0'),

  // Core identification
  name: z.string().min(1).describe('System name'),
  description: z.string().optional().describe('System description'),

  // Architecture configuration
  architecture: z.looseObject({
    style: ArchitectureStyleSchema.describe('Architectural style'),
    cloud: z.string().optional().describe('Primary cloud provider (aws, gcp, azure, etc.)'),
    region: z.string().optional().describe('Primary region'),
  }),

  // Global defaults
  defaults: GlobalDefaultsSchema.optional(),

  // Repository configuration
  repository: RepositorySchema.optional(),

  // Team/ownership information
  team: z
    .looseObject({
      name: z.string().optional(),
      email: z.string().email().optional(),
      slack: z.string().optional(),
    })
    .optional(),

  // Metadata
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
});

// Type inference
export type ArchitectureStyle = z.infer<typeof ArchitectureStyleSchema>;
export type RuntimeDefaults = z.infer<typeof RuntimeDefaultsSchema>;
export type GlobalDefaults = z.infer<typeof GlobalDefaultsSchema>;
export type Repository = z.infer<typeof RepositorySchema>;
export type System = z.infer<typeof SystemSchema>;
