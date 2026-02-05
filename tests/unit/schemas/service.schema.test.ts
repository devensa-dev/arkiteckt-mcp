import { describe, it, expect } from 'vitest';
import {
  ServiceSchema,
  DeploymentPatternSchema,
  ServiceTypeSchema,
  DeploymentConfigSchema,
  ContainerConfigSchema,
  ResilienceSchema,
} from '../../../src/core/schemas/service.schema.js';

describe('ServiceSchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal service', () => {
      const input = {
        name: 'order-service',
        deployment: {
          pattern: 'lambda',
        },
      };

      const result = ServiceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('order-service');
        expect(result.data.deployment.pattern).toBe('lambda');
      }
    });

    it('should validate a full service configuration', () => {
      const input = {
        schemaVersion: '1.0.0',
        name: 'order-service',
        description: 'Handles order processing',
        type: 'api',
        runtime: {
          language: 'typescript',
          version: '5.0',
          framework: 'express',
          entrypoint: 'src/index.ts',
        },
        container: {
          image: 'node:20-alpine',
          port: 3000,
          healthCheck: {
            path: '/health',
            interval: 30,
            timeout: 5,
            retries: 3,
          },
          resources: {
            cpu: '256',
            memory: '512Mi',
          },
        },
        deployment: {
          pattern: 'ecs_fargate',
          replicas: 3,
          strategy: 'rolling',
          autoScaling: {
            enabled: true,
            minReplicas: 2,
            maxReplicas: 10,
            targetCPU: 70,
          },
        },
        dependencies: [
          {
            name: 'user-service',
            type: 'sync',
            protocol: 'http',
          },
          {
            name: 'notification-service',
            type: 'async',
            protocol: 'amqp',
          },
        ],
        resilience: {
          circuitBreaker: {
            enabled: true,
            threshold: 5,
            timeout: 30000,
          },
          retry: {
            enabled: true,
            maxAttempts: 3,
            backoff: 'exponential',
          },
          timeout: 5000,
        },
        observability: {
          profile: 'default',
          slo: {
            availability: 99.9,
            latencyP99: 500,
          },
        },
        owner: 'platform-team',
      };

      const result = ServiceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('api');
        expect(result.data.deployment.pattern).toBe('ecs_fargate');
        expect(result.data.dependencies?.length).toBe(2);
        expect(result.data.resilience?.circuitBreaker?.enabled).toBe(true);
      }
    });

    it('should allow environment-specific overrides', () => {
      const input = {
        name: 'order-service',
        deployment: { pattern: 'kubernetes' },
        environments: {
          prod: {
            deployment: {
              replicas: 5,
            },
          },
          dev: {
            deployment: {
              replicas: 1,
            },
          },
        },
      };

      const result = ServiceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.environments?.prod?.deployment?.replicas).toBe(5);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing name', () => {
      const input = {
        deployment: { pattern: 'lambda' },
      };

      const result = ServiceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing deployment', () => {
      const input = {
        name: 'order-service',
      };

      const result = ServiceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid deployment pattern', () => {
      const input = {
        name: 'order-service',
        deployment: { pattern: 'invalid' },
      };

      const result = ServiceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('DeploymentPatternSchema', () => {
  it('should validate all deployment patterns', () => {
    const patterns = ['lambda', 'ecs_fargate', 'ecs_ec2', 'ec2', 'kubernetes', 'container', 'static'];
    patterns.forEach((pattern) => {
      const result = DeploymentPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    });
  });
});

describe('ServiceTypeSchema', () => {
  it('should validate all service types', () => {
    const types = ['api', 'worker', 'scheduled', 'event-processor', 'frontend', 'backend', 'library', 'infrastructure'];
    types.forEach((type) => {
      const result = ServiceTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  });
});

describe('ContainerConfigSchema', () => {
  it('should validate container config with defaults', () => {
    const input = {
      port: 3000,
      healthCheck: {},
    };

    const result = ContainerConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.healthCheck?.path).toBe('/health');
      expect(result.data.healthCheck?.interval).toBe(30);
    }
  });
});

describe('ResilienceSchema', () => {
  it('should validate resilience patterns', () => {
    const input = {
      circuitBreaker: { enabled: true },
      retry: { enabled: true, maxAttempts: 3 },
      timeout: 5000,
      bulkhead: { enabled: false },
    };

    const result = ResilienceSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
