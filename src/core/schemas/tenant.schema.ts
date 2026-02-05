/**
 * Tenant Schema
 *
 * Multi-tenant configuration with overrides for cloud, region,
 * compliance, and other tenant-specific settings.
 */

import { z } from 'zod';
import { ComplianceFrameworkSchema } from './security.schema.js';

/**
 * Tenant isolation levels
 */
export const IsolationLevelSchema = z.enum([
  'shared', // Shared resources, logical separation
  'pool', // Pooled resources with some isolation
  'dedicated', // Dedicated resources per tenant
  'siloed', // Completely isolated infrastructure
]);

/**
 * Tenant tier for feature/resource allocation
 */
export const TenantTierSchema = z.enum(['free', 'starter', 'professional', 'enterprise', 'custom']);

/**
 * Cloud configuration override for tenant
 */
export const TenantCloudConfigSchema = z.looseObject({
  provider: z.string().optional().describe('Cloud provider override'),
  region: z.string().optional().describe('Region override'),
  account: z.string().optional().describe('Account/project override'),
  vpc: z.string().optional().describe('VPC override'),
});

/**
 * Resource quotas for the tenant
 */
export const ResourceQuotaSchema = z.looseObject({
  maxServices: z.number().int().positive().optional(),
  maxCPU: z.string().optional().describe('Total CPU quota'),
  maxMemory: z.string().optional().describe('Total memory quota'),
  maxStorage: z.string().optional().describe('Total storage quota'),
  maxRequests: z.number().int().positive().optional().describe('Max requests per second'),
  maxConcurrency: z.number().int().positive().optional(),
});

/**
 * Feature flags for tenant
 */
export const TenantFeaturesSchema = z.looseObject({
  enabled: z.array(z.string()).optional().describe('Explicitly enabled features'),
  disabled: z.array(z.string()).optional().describe('Explicitly disabled features'),
  beta: z.array(z.string()).optional().describe('Beta features enabled for this tenant'),
});

/**
 * Tenant-specific environment override
 */
export const TenantEnvironmentOverrideSchema = z.looseObject({
  availability: z
    .object({
      replicas: z.number().int().positive().optional(),
      multiAZ: z.boolean().optional(),
    })
    .optional(),
  scaling: z
    .object({
      minReplicas: z.number().int().positive().optional(),
      maxReplicas: z.number().int().positive().optional(),
    })
    .optional(),
  resources: z
    .object({
      cpu: z.string().optional(),
      memory: z.string().optional(),
    })
    .optional(),
});

/**
 * Tenant Schema - Multi-tenant configuration
 */
export const TenantSchema = z.looseObject({
  // Schema version for migrations
  schemaVersion: z.string().default('1.0.0'),

  // Identification
  id: z.string().describe('Unique tenant identifier'),
  name: z.string().min(1).describe('Tenant name'),
  description: z.string().optional(),

  // Tenant tier
  tier: TenantTierSchema.optional(),

  // Isolation level
  isolation: IsolationLevelSchema.default('shared'),

  // Cloud configuration overrides
  cloud: TenantCloudConfigSchema.optional(),

  // Compliance requirements
  compliance: z
    .looseObject({
      frameworks: z.array(ComplianceFrameworkSchema).optional(),
      dataResidency: z.string().optional().describe('Required data residency region'),
      certifications: z.array(z.string()).optional(),
    })
    .optional(),

  // Resource quotas
  quotas: ResourceQuotaSchema.optional(),

  // Feature configuration
  features: TenantFeaturesSchema.optional(),

  // Environment-specific overrides (keyed by environment name)
  environments: z.record(z.string(), TenantEnvironmentOverrideSchema).optional(),

  // Service-specific overrides (keyed by service name)
  services: z
    .record(
      z.string(),
      z.looseObject({
        deployment: z
          .object({
            replicas: z.number().int().positive().optional(),
            pattern: z.string().optional(),
          })
          .optional(),
        resources: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
          })
          .optional(),
      })
    )
    .optional(),

  // Branding/customization
  branding: z
    .looseObject({
      domain: z.string().optional(),
      subdomain: z.string().optional(),
      customDomains: z.array(z.string()).optional(),
      theme: z.record(z.string(), z.string()).optional(),
    })
    .optional(),

  // Contact information
  contact: z
    .looseObject({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),

  // Billing configuration
  billing: z
    .looseObject({
      model: z.enum(['usage', 'subscription', 'hybrid']).optional(),
      currency: z.string().optional(),
      paymentMethod: z.string().optional(),
    })
    .optional(),

  // Active status
  active: z.boolean().default(true),

  // Lifecycle dates
  createdAt: z.string().optional().describe('Creation date (ISO 8601)'),
  expiresAt: z.string().optional().describe('Expiration date (ISO 8601)'),

  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type IsolationLevel = z.infer<typeof IsolationLevelSchema>;
export type TenantTier = z.infer<typeof TenantTierSchema>;
export type TenantCloudConfig = z.infer<typeof TenantCloudConfigSchema>;
export type ResourceQuota = z.infer<typeof ResourceQuotaSchema>;
export type TenantFeatures = z.infer<typeof TenantFeaturesSchema>;
export type TenantEnvironmentOverride = z.infer<typeof TenantEnvironmentOverrideSchema>;
export type Tenant = z.infer<typeof TenantSchema>;
