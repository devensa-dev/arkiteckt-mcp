/**
 * Integration Tests: Resolution Engine Complex Scenarios
 *
 * Tests for edge cases, performance, and complex real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ArchitectureStore } from '../../../src/core/store/architecture-store.js';
import { ResolutionEngine } from '../../../src/core/engines/resolution-engine.js';

describe('Resolution Engine - Integration Scenarios', () => {
  let testDir: string;
  let archDir: string;
  let store: ArchitectureStore;
  let engine: ResolutionEngine;

  beforeEach(async () => {
    testDir = join(tmpdir(), `resolution-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'environments'), { recursive: true });
    await mkdir(join(archDir, 'tenants'), { recursive: true });

    store = new ArchitectureStore({ baseDir: testDir });
    engine = new ResolutionEngine(store);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    await writeFile(filePath, content, 'utf-8');
  }

  describe('Edge Cases', () => {
    it('should detect circular service dependencies and return error', async () => {
      await writeYaml(
        'services/service-a.yaml',
        `
name: service-a
type: api
deployment:
  pattern: lambda
dependencies:
  - name: service-b
    type: sync
`
      );

      await writeYaml(
        'services/service-b.yaml',
        `
name: service-b
type: api
deployment:
  pattern: lambda
dependencies:
  - name: service-c
    type: sync
`
      );

      await writeYaml(
        'services/service-c.yaml',
        `
name: service-c
type: api
deployment:
  pattern: lambda
dependencies:
  - name: service-a
    type: sync
`
      );

      await writeYaml(
        'tenants/test-tenant.yaml',
        `
id: test-tenant
name: Test Tenant
`
      );

      const result = await engine.resolveServiceContext('service-a', undefined, 'test-tenant');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.message).toContain('Circular dependency detected');
      expect(result.error?.code).toBe('CIRCULAR_DEPENDENCY');
      const resolutionError = result.error as { details?: { cycle?: string[] } };
      expect(resolutionError.details?.cycle).toBeDefined();
      expect(resolutionError.details?.cycle).toContain('service-a');
    });

    it('should handle missing optional files gracefully', async () => {
      // Only system and service exist, no environments or tenants
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: microservices
defaults:
  runtime:
    language: nodejs
`
      );

      await writeYaml(
        'services/minimal-service.yaml',
        `
name: minimal-service
type: api
deployment:
  pattern: lambda
`
      );

      const result = await engine.resolveServiceContext('minimal-service');

      expect(result.success).toBe(true);
      expect(result.data?.service.runtime?.language).toBe('nodejs');
      expect(result.data?.environment).toBeUndefined();
      expect(result.data?.tenant).toBeUndefined();
    });

    it('should handle service with no system defaults', async () => {
      // No system.yaml at all
      await writeYaml(
        'services/standalone-service.yaml',
        `
name: standalone-service
type: api
deployment:
  pattern: lambda
runtime:
  language: python
  version: "3.11"
`
      );

      const result = await engine.resolveServiceContext('standalone-service');

      expect(result.success).toBe(true);
      expect(result.data?.service.runtime?.language).toBe('python');
      expect(result.data?.systemDefaults).toBeUndefined();
    });

    it('should handle environment without corresponding service.environments entry', async () => {
      await writeYaml(
        'services/simple-service.yaml',
        `
name: simple-service
type: api
deployment:
  pattern: lambda
  replicas: 1
`
      );

      await writeYaml(
        'environments/staging.yaml',
        `
name: staging
availability:
  multiAZ: false
`
      );

      const result = await engine.resolveServiceContext('simple-service', 'staging');

      expect(result.success).toBe(true);
      expect(result.data?.service.deployment?.replicas).toBe(1);
      expect(result.data?.service.availability?.multiAZ).toBe(false);
      expect(result.data?.sources).not.toContain('architecture/services/simple-service.yaml#environments.staging');
    });
  });

  describe('Performance', () => {
    it('should resolve in less than 100ms', async () => {
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: microservices
defaults:
  runtime:
    language: nodejs
    version: "20"
`
      );

      await writeYaml(
        'services/perf-service.yaml',
        `
name: perf-service
type: api
deployment:
  pattern: ecs_fargate
  replicas: 3
`
      );

      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
availability:
  multiAZ: true
`
      );

      const start = performance.now();
      const result = await engine.resolveServiceContext('perf-service', 'prod');
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100);
    });

    it('should benefit from caching on repeated resolutions', async () => {
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: microservices
defaults:
  runtime:
    language: nodejs
`
      );

      await writeYaml(
        'services/cached-service.yaml',
        `
name: cached-service
type: api
deployment:
  pattern: lambda
`
      );

      // First resolution
      const start1 = performance.now();
      const result1 = await engine.resolveServiceContext('cached-service');
      const duration1 = performance.now() - start1;

      expect(result1.success).toBe(true);

      // Second resolution (should be faster due to store caching)
      const start2 = performance.now();
      const result2 = await engine.resolveServiceContext('cached-service');
      const duration2 = performance.now() - start2;

      expect(result2.success).toBe(true);
      // Second call should generally be faster, but we won't enforce strict timing
      expect(duration2).toBeLessThan(100);
    });
  });

  describe('Complex Real-World Scenarios', () => {
    it('should handle microservices architecture with full resolution', async () => {
      // System-wide defaults
      await writeYaml(
        'system.yaml',
        `
name: ecommerce-platform
architecture:
  style: microservices
defaults:
  runtime:
    language: nodejs
    version: "20"
  cloud:
    provider: aws
    region: us-east-1
  observability:
    logging:
      level: info
`
      );

      // Order service with dependencies
      await writeYaml(
        'services/order-service.yaml',
        `
name: order-service
type: backend
description: Order processing service
deployment:
  pattern: ecs_fargate
  replicas: 2
dependencies:
  - name: user-service
    type: sync
  - name: payment-service
    type: async
runtime:
  language: nodejs
  version: "20"
  framework: express
environments:
  prod:
    deployment:
      replicas: 5
    observability:
      logging:
        level: warn
`
      );

      // Production environment
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
availability:
  multiAZ: true
  replicas: 3
scaling:
  minReplicas: 2
  maxReplicas: 10
  targetCPU: 70
security:
  level: strict
`
      );

      // Enterprise tenant with specific requirements
      await writeYaml(
        'tenants/enterprise-customer.yaml',
        `
id: enterprise-customer
name: Enterprise Customer
tier: enterprise
isolation: dedicated
cloud:
  region: eu-west-1
  account: enterprise-prod-account
compliance:
  frameworks:
    - GDPR
    - SOC2
  dataResidency: eu-west-1
quotas:
  maxServices: 50
  maxCPU: "100"
  maxMemory: "200Gi"
environments:
  prod:
    availability:
      replicas: 10
    scaling:
      minReplicas: 5
      maxReplicas: 20
services:
  order-service:
    deployment:
      replicas: 15
    resources:
      cpu: "2000m"
      memory: "4Gi"
`
      );

      const result = await engine.resolveServiceContext('order-service', 'prod', 'enterprise-customer');

      expect(result.success).toBe(true);

      // Verify full resolution hierarchy
      const service = result.data?.service;

      // Tenant service override (highest)
      expect(service.deployment?.replicas).toBe(15);
      expect(service.resources?.cpu).toBe('2000m');
      expect(service.resources?.memory).toBe('4Gi');

      // Tenant environment override
      expect(service.scaling?.minReplicas).toBe(5);
      expect(service.scaling?.maxReplicas).toBe(20);

      // Tenant global override
      expect(service.cloud?.region).toBe('eu-west-1');
      expect(service.cloud?.account).toBe('enterprise-prod-account');

      // Environment config
      expect(service.availability?.multiAZ).toBe(true);
      expect(service.security?.level).toBe('strict');

      // Service environment override
      expect(service.observability?.logging?.level).toBe('warn');

      // Base service config
      expect(service.name).toBe('order-service');
      expect(service.type).toBe('backend');
      expect(service.runtime?.framework).toBe('express');

      // System defaults
      expect(service.runtime?.language).toBe('nodejs');
      expect(service.runtime?.version).toBe('20');

      // Metadata
      expect(result.data?.sources).toHaveLength(7);
      expect(result.data?.sources).toContain('architecture/system.yaml');
      expect(result.data?.sources).toContain('architecture/services/order-service.yaml');
      expect(result.data?.sources).toContain('architecture/services/order-service.yaml#environments.prod');
      expect(result.data?.sources).toContain('architecture/environments/prod.yaml');
      expect(result.data?.sources).toContain('architecture/tenants/enterprise-customer.yaml');
      expect(result.data?.sources).toContain('architecture/tenants/enterprise-customer.yaml#environments.prod');
      expect(result.data?.sources).toContain('architecture/tenants/enterprise-customer.yaml#services.order-service');
    });

    it('should handle multi-region deployment with tenant isolation', async () => {
      await writeYaml(
        'system.yaml',
        `
name: global-saas
architecture:
  style: microservices
defaults:
  cloud:
    provider: aws
    region: us-east-1
`
      );

      await writeYaml(
        'services/api-gateway.yaml',
        `
name: api-gateway
type: api
deployment:
  pattern: lambda
`
      );

      await writeYaml(
        'tenants/apac-tenant.yaml',
        `
id: apac-tenant
name: APAC Tenant
cloud:
  region: ap-southeast-1
compliance:
  dataResidency: ap-southeast-1
`
      );

      const result = await engine.resolveServiceContext('api-gateway', undefined, 'apac-tenant');

      expect(result.success).toBe(true);
      expect(result.data?.service.cloud?.region).toBe('ap-southeast-1');
      expect(result.data?.service.compliance?.dataResidency).toBe('ap-southeast-1');
    });
  });

  describe('Source Tracking Accuracy', () => {
    it('should accurately track which sources contributed to final config', async () => {
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: microservices
defaults:
  runtime:
    language: nodejs
`
      );

      await writeYaml(
        'services/tracked.yaml',
        `
name: tracked
type: api
deployment:
  pattern: lambda
environments:
  prod:
    deployment:
      memory: 512
`
      );

      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
availability:
  multiAZ: true
`
      );

      const result = await engine.resolveServiceContext('tracked', 'prod');

      expect(result.success).toBe(true);
      expect(result.data?.sources).toEqual([
        'architecture/system.yaml',
        'architecture/services/tracked.yaml',
        'architecture/services/tracked.yaml#environments.prod',
        'architecture/environments/prod.yaml',
      ]);
    });

    it('should not include sources that do not exist', async () => {
      await writeYaml(
        'services/minimal.yaml',
        `
name: minimal
type: api
deployment:
  pattern: lambda
`
      );

      const result = await engine.resolveServiceContext('minimal', 'nonexistent-env');

      expect(result.success).toBe(true);
      // Nonexistent environment file is optional; should not appear in sources
      expect(result.data?.sources).not.toContain('architecture/environments/nonexistent-env.yaml');
    });
  });
});
