import { describe, it, expect } from 'vitest';
import {
  SecuritySchema,
  ComplianceFrameworkSchema,
  IAMPolicySchema,
  SecretsManagementSchema,
  EncryptionSchema,
  AuthenticationSchema,
  AuthorizationSchema,
} from '../../../src/core/schemas/security.schema.js';

describe('SecuritySchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal security config', () => {
      const input = {};

      const result = SecuritySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate a full security config', () => {
      const input = {
        iam: {
          policies: [
            {
              name: 'service-policy',
              type: 'service',
              permissions: [
                {
                  effect: 'allow',
                  actions: ['s3:GetObject'],
                  resources: ['arn:aws:s3:::my-bucket/*'],
                },
              ],
            },
          ],
          leastPrivilege: true,
        },
        secrets: {
          provider: 'aws-secrets-manager',
          rotationEnabled: true,
          rotationDays: 90,
        },
        encryption: {
          atRest: {
            enabled: true,
            algorithm: 'AES-256',
            keyManagement: 'customer-managed',
          },
          inTransit: {
            enabled: true,
            minTLSVersion: '1.2',
            enforceHTTPS: true,
          },
        },
        authentication: {
          type: 'oidc',
          provider: 'auth0',
          mfaRequired: true,
        },
        authorization: {
          model: 'rbac',
          roles: [
            {
              name: 'admin',
              permissions: ['read', 'write', 'delete'],
            },
          ],
        },
        compliance: {
          frameworks: ['SOC2', 'HIPAA'],
          auditLogging: {
            enabled: true,
            retention: 365,
            immutable: true,
          },
        },
      };

      const result = SecuritySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encryption?.inTransit?.minTLSVersion).toBe('1.2');
        expect(result.data.compliance?.frameworks).toContain('SOC2');
      }
    });
  });
});

describe('ComplianceFrameworkSchema', () => {
  it('should validate all compliance frameworks', () => {
    const frameworks = ['SOC2', 'HIPAA', 'PCI-DSS', 'GDPR', 'ISO27001', 'FedRAMP', 'NIST'];
    frameworks.forEach((framework) => {
      const result = ComplianceFrameworkSchema.safeParse(framework);
      expect(result.success).toBe(true);
    });
  });
});

describe('IAMPolicySchema', () => {
  it('should validate an IAM policy', () => {
    const input = {
      name: 'read-policy',
      type: 'role',
      permissions: [
        {
          effect: 'allow',
          actions: ['s3:GetObject'],
          resources: ['*'],
        },
      ],
    };

    const result = IAMPolicySchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate all policy types', () => {
    const types = ['service', 'user', 'role', 'group'];
    types.forEach((type) => {
      const result = IAMPolicySchema.safeParse({ name: 'test', type });
      expect(result.success).toBe(true);
    });
  });
});

describe('SecretsManagementSchema', () => {
  it('should validate all secret providers', () => {
    const providers = ['aws-secrets-manager', 'aws-ssm', 'vault', 'azure-keyvault', 'gcp-secret-manager', 'doppler'];
    providers.forEach((provider) => {
      const result = SecretsManagementSchema.safeParse({ provider });
      expect(result.success).toBe(true);
    });
  });

  it('should apply defaults', () => {
    const result = SecretsManagementSchema.safeParse({ provider: 'vault' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rotationEnabled).toBe(true);
      expect(result.data.rotationDays).toBe(90);
    }
  });
});

describe('EncryptionSchema', () => {
  it('should validate TLS versions', () => {
    const versions = ['1.0', '1.1', '1.2', '1.3'];
    versions.forEach((version) => {
      const result = EncryptionSchema.safeParse({
        inTransit: { minTLSVersion: version },
      });
      expect(result.success).toBe(true);
    });
  });

  it('should validate key management options', () => {
    const options = ['aws-managed', 'customer-managed', 'byok'];
    options.forEach((option) => {
      const result = EncryptionSchema.safeParse({
        atRest: { keyManagement: option },
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('AuthenticationSchema', () => {
  it('should validate all auth types', () => {
    const types = ['iam', 'oidc', 'saml', 'jwt', 'api-key', 'mtls'];
    types.forEach((type) => {
      const result = AuthenticationSchema.safeParse({ type });
      expect(result.success).toBe(true);
    });
  });
});

describe('AuthorizationSchema', () => {
  it('should validate all auth models', () => {
    const models = ['rbac', 'abac', 'pbac', 'acl'];
    models.forEach((model) => {
      const result = AuthorizationSchema.safeParse({ model });
      expect(result.success).toBe(true);
    });
  });
});
