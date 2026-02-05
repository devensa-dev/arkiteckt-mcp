import { describe, it, expect } from 'vitest';
import {
  TenantSchema,
  IsolationLevelSchema,
  TenantTierSchema,
  TenantCloudConfigSchema,
  ResourceQuotaSchema,
  TenantFeaturesSchema,
  TenantEnvironmentOverrideSchema,
} from '../../../src/core/schemas/tenant.schema.js';

describe('TenantSchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal tenant', () => {
      const input = {
        id: 'tenant-001',
        name: 'Acme Corp',
      };

      const result = TenantSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('tenant-001');
        expect(result.data.isolation).toBe('shared');
        expect(result.data.active).toBe(true);
      }
    });

    it('should validate a full tenant configuration', () => {
      const input = {
        schemaVersion: '1.0.0',
        id: 'tenant-001',
        name: 'Enterprise Client',
        description: 'Enterprise tier customer',
        tier: 'enterprise',
        isolation: 'dedicated',
        cloud: {
          provider: 'aws',
          region: 'eu-west-1',
          account: '987654321098',
          vpc: 'vpc-12345',
        },
        compliance: {
          frameworks: ['GDPR', 'ISO27001'],
          dataResidency: 'eu',
          certifications: ['ISO 27001:2013'],
        },
        quotas: {
          maxServices: 100,
          maxCPU: '1000',
          maxMemory: '2000Gi',
          maxStorage: '10Ti',
          maxRequests: 10000,
        },
        features: {
          enabled: ['sso', 'audit-logs'],
          disabled: ['beta-features'],
          beta: ['new-dashboard'],
        },
        environments: {
          prod: {
            availability: { replicas: 5, multiAZ: true },
            scaling: { minReplicas: 3, maxReplicas: 20 },
          },
        },
        services: {
          'api-service': {
            deployment: { replicas: 3 },
            resources: { cpu: '500m', memory: '1Gi' },
          },
        },
        branding: {
          domain: 'enterprise.example.com',
          subdomain: 'enterprise',
          customDomains: ['api.enterprise.com'],
        },
        contact: {
          name: 'John Smith',
          email: 'john@enterprise.com',
          phone: '+1234567890',
        },
        billing: {
          model: 'subscription',
          currency: 'USD',
        },
        active: true,
        createdAt: '2026-01-01T00:00:00Z',
      };

      const result = TenantSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe('enterprise');
        expect(result.data.isolation).toBe('dedicated');
        expect(result.data.compliance?.frameworks).toContain('GDPR');
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing required fields', () => {
      const input = {
        name: 'Test Tenant',
      };

      const result = TenantSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const input = {
        id: 'tenant-001',
        name: 'Test',
        contact: {
          email: 'invalid-email',
        },
      };

      const result = TenantSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('IsolationLevelSchema', () => {
  it('should validate all isolation levels', () => {
    const levels = ['shared', 'pool', 'dedicated', 'siloed'];
    levels.forEach((level) => {
      const result = IsolationLevelSchema.safeParse(level);
      expect(result.success).toBe(true);
    });
  });
});

describe('TenantTierSchema', () => {
  it('should validate all tiers', () => {
    const tiers = ['free', 'starter', 'professional', 'enterprise', 'custom'];
    tiers.forEach((tier) => {
      const result = TenantTierSchema.safeParse(tier);
      expect(result.success).toBe(true);
    });
  });
});

describe('TenantCloudConfigSchema', () => {
  it('should validate cloud config', () => {
    const input = {
      provider: 'gcp',
      region: 'europe-west1',
      account: 'project-id',
    };

    const result = TenantCloudConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('ResourceQuotaSchema', () => {
  it('should validate resource quotas', () => {
    const input = {
      maxServices: 50,
      maxCPU: '100',
      maxMemory: '500Gi',
    };

    const result = ResourceQuotaSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject negative values', () => {
    const input = {
      maxServices: -1,
    };

    const result = ResourceQuotaSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('TenantFeaturesSchema', () => {
  it('should validate feature flags', () => {
    const input = {
      enabled: ['feature-a', 'feature-b'],
      disabled: ['feature-c'],
      beta: ['feature-d'],
    };

    const result = TenantFeaturesSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('TenantEnvironmentOverrideSchema', () => {
  it('should validate environment overrides', () => {
    const input = {
      availability: {
        replicas: 3,
        multiAZ: true,
      },
      scaling: {
        minReplicas: 2,
        maxReplicas: 10,
      },
      resources: {
        cpu: '1000m',
        memory: '2Gi',
      },
    };

    const result = TenantEnvironmentOverrideSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
