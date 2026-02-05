import { describe, it, expect } from 'vitest';
import {
  EnvironmentSchema,
  EnvironmentNameSchema,
  AvailabilitySchema,
  ScalingSchema,
  SecurityLevelSchema,
  EnvironmentSecuritySchema,
  DatabaseConfigSchema,
  DisasterRecoverySchema,
} from '../../../src/core/schemas/environment.schema.js';

describe('EnvironmentSchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal environment', () => {
      const input = {
        name: 'production',
      };

      const result = EnvironmentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('production');
        expect(result.data.isProduction).toBe(false);
      }
    });

    it('should validate a full production environment', () => {
      const input = {
        schemaVersion: '1.0.0',
        name: 'production',
        description: 'Production environment',
        stage: 'prod',
        isProduction: true,
        availability: {
          replicas: 3,
          multiAZ: true,
          multiRegion: false,
          zones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
        },
        scaling: {
          enabled: true,
          minReplicas: 2,
          maxReplicas: 20,
          targetCPU: 70,
          targetMemory: 80,
          cooldownPeriod: 300,
        },
        security: {
          level: 'strict',
          encryption: {
            atRest: true,
            inTransit: true,
            kmsKey: 'alias/prod-key',
          },
          network: {
            privateOnly: true,
            allowedCIDRs: ['10.0.0.0/8'],
            vpcEndpoints: true,
          },
        },
        database: {
          engine: 'postgres',
          instanceClass: 'db.r5.large',
          multiAZ: true,
          replicas: 2,
          backup: {
            enabled: true,
            retentionDays: 30,
            window: '03:00-04:00',
          },
        },
        disasterRecovery: {
          enabled: true,
          rto: 60,
          rpo: 15,
          backupRegion: 'us-west-2',
          strategy: 'warm-standby',
        },
        cloud: {
          provider: 'aws',
          region: 'us-east-1',
          account: '123456789012',
        },
        features: {
          featureA: true,
          featureB: false,
        },
        variables: {
          LOG_LEVEL: 'info',
        },
      };

      const result = EnvironmentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isProduction).toBe(true);
        expect(result.data.availability?.multiAZ).toBe(true);
        expect(result.data.security?.level).toBe('strict');
        expect(result.data.disasterRecovery?.strategy).toBe('warm-standby');
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing name', () => {
      const input = {
        isProduction: true,
      };

      const result = EnvironmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid stage', () => {
      const input = {
        name: 'custom-env',
        stage: 'invalid-stage',
      };

      const result = EnvironmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('EnvironmentNameSchema', () => {
  it('should validate all environment names', () => {
    const names = ['local', 'dev', 'development', 'staging', 'prod', 'production'];
    names.forEach((name) => {
      const result = EnvironmentNameSchema.safeParse(name);
      expect(result.success).toBe(true);
    });
  });
});

describe('SecurityLevelSchema', () => {
  it('should validate all security levels', () => {
    const levels = ['relaxed', 'standard', 'strict', 'paranoid'];
    levels.forEach((level) => {
      const result = SecurityLevelSchema.safeParse(level);
      expect(result.success).toBe(true);
    });
  });
});

describe('AvailabilitySchema', () => {
  it('should apply defaults', () => {
    const result = AvailabilitySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.replicas).toBe(1);
      expect(result.data.multiAZ).toBe(false);
    }
  });
});

describe('ScalingSchema', () => {
  it('should apply defaults', () => {
    const result = ScalingSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
      expect(result.data.minReplicas).toBe(1);
      expect(result.data.maxReplicas).toBe(10);
      expect(result.data.targetCPU).toBe(70);
    }
  });
});

describe('DisasterRecoverySchema', () => {
  it('should validate DR strategies', () => {
    const strategies = ['pilot-light', 'warm-standby', 'multi-site-active'];
    strategies.forEach((strategy) => {
      const input = { enabled: true, strategy };
      const result = DisasterRecoverySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
