/**
 * Security Schema
 *
 * Security standards including IAM policies, secrets management,
 * encryption requirements, and compliance frameworks.
 */

import { z } from 'zod';

/**
 * Compliance framework definitions (FR-028)
 */
export const ComplianceFrameworkSchema = z.enum(['SOC2', 'HIPAA', 'PCI-DSS', 'GDPR', 'ISO27001', 'FedRAMP', 'NIST']);

/**
 * IAM policy template
 */
export const IAMPolicySchema = z.looseObject({
  name: z.string().describe('Policy name'),
  description: z.string().optional(),
  type: z.enum(['service', 'user', 'role', 'group']).default('service'),
  permissions: z
    .array(
      z.object({
        effect: z.enum(['allow', 'deny']),
        actions: z.array(z.string()),
        resources: z.array(z.string()),
        conditions: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  managedPolicies: z.array(z.string()).optional().describe('Managed policy ARNs/names to attach'),
  boundaries: z
    .object({
      permissionsBoundary: z.string().optional(),
      sessionDuration: z.number().int().positive().optional(),
    })
    .optional(),
});

/**
 * Secrets management configuration
 */
export const SecretsManagementSchema = z.looseObject({
  provider: z.enum(['aws-secrets-manager', 'aws-ssm', 'vault', 'azure-keyvault', 'gcp-secret-manager', 'doppler']),
  rotationEnabled: z.boolean().default(true),
  rotationDays: z.number().int().positive().default(90),
  encryptionKey: z.string().optional().describe('KMS key or encryption key reference'),
  accessControl: z
    .looseObject({
      requireMFA: z.boolean().default(false),
      allowedRoles: z.array(z.string()).optional(),
      auditAccess: z.boolean().default(true),
    })
    .optional(),
  naming: z
    .object({
      pattern: z.string().optional().describe('Secret naming pattern'),
      prefix: z.string().optional(),
    })
    .optional(),
});

/**
 * Encryption configuration
 */
export const EncryptionSchema = z.looseObject({
  atRest: z
    .looseObject({
      enabled: z.boolean().default(true),
      algorithm: z.string().default('AES-256'),
      keyManagement: z.enum(['aws-managed', 'customer-managed', 'byok']).default('aws-managed'),
      kmsKeyId: z.string().optional(),
    })
    .optional(),
  inTransit: z
    .looseObject({
      enabled: z.boolean().default(true),
      minTLSVersion: z.enum(['1.0', '1.1', '1.2', '1.3']).default('1.2'),
      enforceHTTPS: z.boolean().default(true),
      certificateProvider: z.string().optional(),
    })
    .optional(),
});

/**
 * Network security configuration
 */
export const NetworkSecuritySchema = z.looseObject({
  waf: z
    .looseObject({
      enabled: z.boolean().default(false),
      provider: z.string().optional(),
      rules: z.array(z.string()).optional(),
      rateLimit: z.number().int().positive().optional(),
    })
    .optional(),
  ddosProtection: z
    .object({
      enabled: z.boolean().default(false),
      tier: z.enum(['basic', 'standard', 'advanced']).optional(),
    })
    .optional(),
  firewallRules: z
    .array(
      z.object({
        name: z.string(),
        direction: z.enum(['inbound', 'outbound']),
        action: z.enum(['allow', 'deny']),
        protocol: z.string(),
        ports: z.array(z.string()),
        sources: z.array(z.string()).optional(),
        destinations: z.array(z.string()).optional(),
      })
    )
    .optional(),
  privateEndpoints: z
    .object({
      enabled: z.boolean().default(false),
      services: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Authentication configuration
 */
export const AuthenticationSchema = z.looseObject({
  type: z.enum(['iam', 'oidc', 'saml', 'jwt', 'api-key', 'mtls']),
  provider: z.string().optional().describe('Identity provider'),
  mfaRequired: z.boolean().default(false),
  sessionConfig: z
    .object({
      duration: z.number().int().positive().optional().describe('Session duration in seconds'),
      refreshable: z.boolean().default(true),
      idleTimeout: z.number().int().positive().optional(),
    })
    .optional(),
  tokenConfig: z
    .object({
      issuer: z.string().optional(),
      audience: z.string().optional(),
      algorithms: z.array(z.string()).optional(),
      clockSkew: z.number().int().min(0).optional(),
    })
    .optional(),
});

/**
 * Authorization configuration
 */
export const AuthorizationSchema = z.looseObject({
  model: z.enum(['rbac', 'abac', 'pbac', 'acl']).default('rbac'),
  roles: z
    .array(
      z.object({
        name: z.string(),
        permissions: z.array(z.string()),
        inherits: z.array(z.string()).optional(),
      })
    )
    .optional(),
  policies: z
    .array(
      z.object({
        name: z.string(),
        rules: z.array(z.string()),
      })
    )
    .optional(),
});

/**
 * Compliance requirements
 */
export const ComplianceSchema = z.looseObject({
  frameworks: z.array(ComplianceFrameworkSchema).optional(),
  dataClassification: z
    .object({
      enabled: z.boolean().default(false),
      levels: z.array(z.enum(['public', 'internal', 'confidential', 'restricted'])).optional(),
      defaultLevel: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
    })
    .optional(),
  auditLogging: z
    .object({
      enabled: z.boolean().default(true),
      retention: z.number().int().positive().optional().describe('Retention in days'),
      immutable: z.boolean().default(false),
    })
    .optional(),
  dataRetention: z
    .object({
      defaultDays: z.number().int().positive().optional(),
      piiRetentionDays: z.number().int().positive().optional(),
      deletionPolicy: z.enum(['soft-delete', 'hard-delete', 'archive']).optional(),
    })
    .optional(),
});

/**
 * Vulnerability management
 */
export const VulnerabilityManagementSchema = z.looseObject({
  scanning: z
    .object({
      enabled: z.boolean().default(true),
      frequency: z.enum(['continuous', 'daily', 'weekly', 'monthly']).default('daily'),
      tools: z.array(z.string()).optional(),
    })
    .optional(),
  patchPolicy: z
    .object({
      criticalSLA: z.number().int().positive().optional().describe('Hours to patch critical vulns'),
      highSLA: z.number().int().positive().optional(),
      mediumSLA: z.number().int().positive().optional(),
      autoUpdate: z.boolean().default(false),
    })
    .optional(),
});

/**
 * Security Schema - Security standards and requirements
 */
export const SecuritySchema = z.looseObject({
  schemaVersion: z.string().default('1.0.0'),

  // IAM policies
  iam: z
    .looseObject({
      policies: z.array(IAMPolicySchema).optional(),
      serviceAccounts: z
        .array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            policies: z.array(z.string()),
          })
        )
        .optional(),
      leastPrivilege: z.boolean().default(true),
    })
    .optional(),

  // Secrets management
  secrets: SecretsManagementSchema.optional(),

  // Encryption
  encryption: EncryptionSchema.optional(),

  // Network security
  network: NetworkSecuritySchema.optional(),

  // Authentication
  authentication: AuthenticationSchema.optional(),

  // Authorization
  authorization: AuthorizationSchema.optional(),

  // Compliance
  compliance: ComplianceSchema.optional(),

  // Vulnerability management
  vulnerabilities: VulnerabilityManagementSchema.optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type ComplianceFramework = z.infer<typeof ComplianceFrameworkSchema>;
export type IAMPolicy = z.infer<typeof IAMPolicySchema>;
export type SecretsManagement = z.infer<typeof SecretsManagementSchema>;
export type Encryption = z.infer<typeof EncryptionSchema>;
export type NetworkSecurity = z.infer<typeof NetworkSecuritySchema>;
export type Authentication = z.infer<typeof AuthenticationSchema>;
export type Authorization = z.infer<typeof AuthorizationSchema>;
export type Compliance = z.infer<typeof ComplianceSchema>;
export type VulnerabilityManagement = z.infer<typeof VulnerabilityManagementSchema>;
export type Security = z.infer<typeof SecuritySchema>;
