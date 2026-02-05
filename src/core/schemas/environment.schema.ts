/**
 * Environment Schema
 *
 * Environment profile definitions including availability, scaling,
 * security settings, and database configuration for each environment
 * (local, dev, staging, prod).
 */

import { z } from 'zod';

/**
 * Environment names - standard lifecycle stages
 */
export const EnvironmentNameSchema = z.enum(['local', 'dev', 'development', 'staging', 'prod', 'production']);

/**
 * Availability configuration
 */
export const AvailabilitySchema = z.looseObject({
  replicas: z.number().int().positive().default(1).describe('Default number of replicas'),
  multiAZ: z.boolean().default(false).describe('Whether to deploy across multiple availability zones'),
  multiRegion: z.boolean().default(false).describe('Whether to deploy across multiple regions'),
  zones: z.array(z.string()).optional().describe('Specific availability zones'),
});

/**
 * Scaling configuration for the environment
 */
export const ScalingSchema = z.looseObject({
  enabled: z.boolean().default(false),
  minReplicas: z.number().int().positive().default(1),
  maxReplicas: z.number().int().positive().default(10),
  targetCPU: z.number().int().min(1).max(100).default(70),
  targetMemory: z.number().int().min(1).max(100).optional(),
  cooldownPeriod: z.number().int().positive().optional().describe('Cooldown in seconds'),
});

/**
 * Security strictness levels
 */
export const SecurityLevelSchema = z.enum(['relaxed', 'standard', 'strict', 'paranoid']);

/**
 * Environment security settings
 */
export const EnvironmentSecuritySchema = z.looseObject({
  level: SecurityLevelSchema.default('standard'),
  encryption: z
    .looseObject({
      atRest: z.boolean().default(true),
      inTransit: z.boolean().default(true),
      kmsKey: z.string().optional(),
    })
    .optional(),
  network: z
    .looseObject({
      privateOnly: z.boolean().default(false),
      allowedCIDRs: z.array(z.string()).optional(),
      vpcEndpoints: z.boolean().optional(),
    })
    .optional(),
  authentication: z
    .looseObject({
      required: z.boolean().default(true),
      mfaRequired: z.boolean().optional(),
      sessionTimeout: z.number().int().positive().optional(),
    })
    .optional(),
});

/**
 * Database configuration for the environment
 */
export const DatabaseConfigSchema = z.looseObject({
  engine: z.string().optional().describe('Database engine (postgres, mysql, dynamodb, etc.)'),
  instanceClass: z.string().optional().describe('Instance class/size'),
  multiAZ: z.boolean().optional(),
  replicas: z.number().int().min(0).optional().describe('Read replicas'),
  backup: z
    .looseObject({
      enabled: z.boolean().default(true),
      retentionDays: z.number().int().positive().default(7),
      window: z.string().optional().describe('Backup window (e.g., "03:00-04:00")'),
    })
    .optional(),
});

/**
 * Resource constraints for the environment
 */
export const ResourceConstraintsSchema = z.looseObject({
  cpu: z
    .object({
      min: z.string().optional(),
      max: z.string().optional(),
      default: z.string().optional(),
    })
    .optional(),
  memory: z
    .object({
      min: z.string().optional(),
      max: z.string().optional(),
      default: z.string().optional(),
    })
    .optional(),
  storage: z
    .object({
      max: z.string().optional(),
      default: z.string().optional(),
    })
    .optional(),
});

/**
 * Disaster recovery configuration
 */
export const DisasterRecoverySchema = z.looseObject({
  enabled: z.boolean().default(false),
  rto: z.number().int().positive().optional().describe('Recovery Time Objective in minutes'),
  rpo: z.number().int().positive().optional().describe('Recovery Point Objective in minutes'),
  backupRegion: z.string().optional(),
  strategy: z.enum(['pilot-light', 'warm-standby', 'multi-site-active']).optional(),
});

/**
 * Environment Schema - Environment profile definition
 */
export const EnvironmentSchema = z.looseObject({
  // Schema version for migrations
  schemaVersion: z.string().default('1.0.0'),

  // Core identification
  name: z.string().min(1).describe('Environment name'),
  description: z.string().optional(),

  // Lifecycle stage
  stage: EnvironmentNameSchema.optional().describe('Standard lifecycle stage'),

  // Is this a production environment?
  isProduction: z.boolean().default(false),

  // Availability configuration
  availability: AvailabilitySchema.optional(),

  // Scaling configuration
  scaling: ScalingSchema.optional(),

  // Security settings
  security: EnvironmentSecuritySchema.optional(),

  // Database defaults
  database: DatabaseConfigSchema.optional(),

  // Resource constraints
  resources: ResourceConstraintsSchema.optional(),

  // Disaster recovery (FR-026)
  disasterRecovery: DisasterRecoverySchema.optional(),

  // Cloud-specific configuration
  cloud: z
    .looseObject({
      provider: z.string().optional(),
      region: z.string().optional(),
      account: z.string().optional(),
      vpc: z.string().optional(),
      subnets: z.array(z.string()).optional(),
    })
    .optional(),

  // Feature flags for the environment
  features: z.record(z.string(), z.boolean()).optional(),

  // Environment variables to inject
  variables: z.record(z.string(), z.string()).optional(),

  // Metadata
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type EnvironmentName = z.infer<typeof EnvironmentNameSchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export type Scaling = z.infer<typeof ScalingSchema>;
export type SecurityLevel = z.infer<typeof SecurityLevelSchema>;
export type EnvironmentSecurity = z.infer<typeof EnvironmentSecuritySchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type ResourceConstraints = z.infer<typeof ResourceConstraintsSchema>;
export type DisasterRecovery = z.infer<typeof DisasterRecoverySchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
