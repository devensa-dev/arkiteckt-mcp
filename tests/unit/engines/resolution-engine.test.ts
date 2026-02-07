/**
 * Unit Tests: Resolution Engine
 *
 * Tests for FR-004: Merge order Tenant → Environment → Service → System → Global
 * Tests for User Story 7 acceptance scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ArchitectureStore } from '../../../src/core/store/architecture-store.js';
import { ResolutionEngine } from '../../../src/core/engines/resolution-engine.js';

describe('Resolution Engine', () => {
  let testDir: string;
  let archDir: string;
  let store: ArchitectureStore;
  let engine: ResolutionEngine;

  beforeEach(async () => {
    testDir = join(tmpdir(), `resolution-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

  describe('FR-004: Merge Priority Order', () => {
    it('should apply system defaults as base layer', async () => {
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
  cloud:
    region: us-east-1
`
      );

      await writeYaml(
        'services/basic-service.yaml',
        `
name: basic-service
type: api
deployment:
  pattern: lambda
`
      );

      const result = await engine.resolveServiceContext('basic-service');

      expect(result.success).toBe(true);
      expect(result.data?.service.runtime?.language).toBe('nodejs');
      expect(result.data?.service.runtime?.version).toBe('20');
      expect(result.data?.systemDefaults).toBeDefined();
    });

    it('should override system defaults with service config', async () => {
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
        'services/python-service.yaml',
        `
name: python-service
type: backend
runtime:
  language: python
  version: "3.11"
deployment:
  pattern: ecs_fargate
`
      );

      const result = await engine.resolveServiceContext('python-service');

      expect(result.success).toBe(true);
      expect(result.data?.service.runtime?.language).toBe('python');
      expect(result.data?.service.runtime?.version).toBe('3.11');
    });

    it('should apply service environment overrides', async () => {
      await writeYaml(
        'services/web-service.yaml',
        `
name: web-service
type: api
deployment:
  pattern: ecs_fargate
  replicas: 1
environments:
  prod:
    deployment:
      replicas: 5
`
      );

      const result = await engine.resolveServiceContext('web-service', 'prod');

      expect(result.success).toBe(true);
      expect(result.data?.service.deployment?.replicas).toBe(5);
      expect(result.data?.sources).toContain('architecture/services/web-service.yaml#environments.prod');
    });

    it('should apply environment-level config', async () => {
      await writeYaml(
        'services/db-service.yaml',
        `
name: db-service
type: backend
deployment:
  pattern: ecs_ec2
`
      );

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
`
      );

      const result = await engine.resolveServiceContext('db-service', 'prod');

      expect(result.success).toBe(true);
      expect(result.data?.service.availability?.multiAZ).toBe(true);
      expect(result.data?.service.scaling?.minReplicas).toBe(2);
      expect(result.data?.environment).toBeDefined();
      expect(result.data?.environment?.name).toBe('prod');
    });
  });

  describe('User Story 7: Acceptance Scenarios', () => {
    it('Scenario 1: Service with no overrides returns system defaults', async () => {
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
  cloud:
    provider: aws
    region: us-east-1
`
      );

      await writeYaml(
        'services/simple-service.yaml',
        `
name: simple-service
type: api
deployment:
  pattern: lambda
`
      );

      const result = await engine.resolveServiceContext('simple-service');

      expect(result.success).toBe(true);
      expect(result.data?.service.runtime?.language).toBe('nodejs');
      expect(result.data?.service.runtime?.version).toBe('20');
      expect(result.data?.systemDefaults).toMatchObject({
        runtime: { language: 'nodejs', version: '20' },
        cloud: { provider: 'aws', region: 'us-east-1' },
      });
    });

    it('Scenario 2: Service with env-specific database config overrides base', async () => {
      await writeYaml(
        'services/data-service.yaml',
        `
name: data-service
type: backend
deployment:
  pattern: ecs_fargate
database:
  type: postgres
  name: data-dev
environments:
  prod:
    database:
      name: data-prod
      replicas: 3
`
      );

      const resultDev = await engine.resolveServiceContext('data-service');
      expect(resultDev.success).toBe(true);
      expect(resultDev.data?.service.database?.name).toBe('data-dev');

      const resultProd = await engine.resolveServiceContext('data-service', 'prod');
      expect(resultProd.success).toBe(true);
      expect(resultProd.data?.service.database?.name).toBe('data-prod');
      expect(resultProd.data?.service.database?.replicas).toBe(3);
    });

    it('Scenario 3: Tenant with region override uses tenant region', async () => {
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: microservices
defaults:
  cloud:
    provider: aws
    region: us-east-1
`
      );

      await writeYaml(
        'services/api-service.yaml',
        `
name: api-service
type: api
deployment:
  pattern: lambda
`
      );

      await writeYaml(
        'tenants/eu-tenant.yaml',
        `
id: eu-tenant
name: EU Tenant
cloud:
  region: eu-west-1
`
      );

      const result = await engine.resolveServiceContext('api-service', undefined, 'eu-tenant');

      expect(result.success).toBe(true);
      expect(result.data?.service.cloud?.region).toBe('eu-west-1');
      expect(result.data?.tenant).toBeDefined();
      expect(result.data?.tenant?.id).toBe('eu-tenant');
    });
  });

  describe('T041: Tenant Overrides', () => {
    it('should apply tenant global overrides', async () => {
      await writeYaml(
        'services/test-service.yaml',
        `
name: test-service
type: api
deployment:
  pattern: lambda
`
      );

      await writeYaml(
        'tenants/premium-tenant.yaml',
        `
id: premium-tenant
name: Premium Tenant
cloud:
  provider: aws
  region: eu-west-1
  account: premium-account
`
      );

      const result = await engine.resolveServiceContext('test-service', undefined, 'premium-tenant');

      expect(result.success).toBe(true);
      expect(result.data?.service.cloud?.region).toBe('eu-west-1');
      expect(result.data?.service.cloud?.account).toBe('premium-account');
    });

    it('should apply tenant environment-specific overrides', async () => {
      await writeYaml(
        'services/app-service.yaml',
        `
name: app-service
type: api
deployment:
  pattern: ecs_fargate
  replicas: 2
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

      await writeYaml(
        'tenants/enterprise-tenant.yaml',
        `
id: enterprise-tenant
name: Enterprise Tenant
environments:
  prod:
    availability:
      replicas: 10
    scaling:
      minReplicas: 5
      maxReplicas: 20
`
      );

      const result = await engine.resolveServiceContext('app-service', 'prod', 'enterprise-tenant');

      expect(result.success).toBe(true);
      expect(result.data?.service.availability?.replicas).toBe(10);
      expect(result.data?.service.scaling?.minReplicas).toBe(5);
    });

    it('should apply tenant service-specific overrides (highest priority)', async () => {
      await writeYaml(
        'services/critical-service.yaml',
        `
name: critical-service
type: api
deployment:
  pattern: ecs_fargate
  replicas: 3
`
      );

      await writeYaml(
        'tenants/vip-tenant.yaml',
        `
id: vip-tenant
name: VIP Tenant
services:
  critical-service:
    deployment:
      replicas: 20
    resources:
      cpu: "4000m"
      memory: "8Gi"
`
      );

      const result = await engine.resolveServiceContext('critical-service', undefined, 'vip-tenant');

      expect(result.success).toBe(true);
      expect(result.data?.service.deployment?.replicas).toBe(20);
      expect(result.data?.service.resources?.cpu).toBe('4000m');
      expect(result.data?.service.resources?.memory).toBe('8Gi');
    });

    it('should combine tenant+environment+service overrides correctly', async () => {
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: microservices
defaults:
  runtime:
    language: nodejs
  cloud:
    region: us-east-1
`
      );

      await writeYaml(
        'services/complex-service.yaml',
        `
name: complex-service
type: api
deployment:
  pattern: ecs_fargate
  replicas: 1
environments:
  prod:
    deployment:
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

      await writeYaml(
        'tenants/multi-tenant.yaml',
        `
id: multi-tenant
name: Multi Tenant
cloud:
  region: eu-west-1
environments:
  prod:
    scaling:
      minReplicas: 5
services:
  complex-service:
    deployment:
      replicas: 10
`
      );

      const result = await engine.resolveServiceContext('complex-service', 'prod', 'multi-tenant');

      expect(result.success).toBe(true);
      // Tenant service override wins (highest priority)
      expect(result.data?.service.deployment?.replicas).toBe(10);
      // Tenant environment override
      expect(result.data?.service.scaling?.minReplicas).toBe(5);
      // Environment config
      expect(result.data?.service.availability?.multiAZ).toBe(true);
      // Tenant global override
      expect(result.data?.service.cloud?.region).toBe('eu-west-1');
      // System default preserved
      expect(result.data?.service.runtime?.language).toBe('nodejs');
    });
  });

  describe('Error handling', () => {
    it('should return error for non-existent service', async () => {
      const result = await engine.resolveServiceContext('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('file');
      expect(result.error?.message).toContain('not found');
    });

    it('should succeed for non-existent environment file (env files are optional)', async () => {
      await writeYaml(
        'services/test-service.yaml',
        `
name: test-service
type: api
deployment:
  pattern: lambda
`
      );

      await writeYaml(
        'environments/dev.yaml',
        `
name: dev
`
      );

      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
`
      );

      const result = await engine.resolveServiceContext('test-service', 'staging');

      // Environment files are optional in service resolution;
      // the staging env file doesn't exist, but resolution continues
      expect(result.success).toBe(true);
      expect(result.data?.sources).not.toContain('architecture/environments/staging.yaml');
    });

    it('should return error for non-existent tenant', async () => {
      await writeYaml(
        'services/test-service.yaml',
        `
name: test-service
type: api
deployment:
  pattern: lambda
`
      );

      const result = await engine.resolveServiceContext('test-service', undefined, 'nonexistent-tenant');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.message).toContain('nonexistent-tenant');
      expect(result.error?.message).toContain('Available tenants');
    });
  });

  describe('Source tracking', () => {
    it('should track all source files that contributed', async () => {
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
        'services/tracked-service.yaml',
        `
name: tracked-service
type: api
deployment:
  pattern: lambda
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

      const result = await engine.resolveServiceContext('tracked-service', 'prod');

      expect(result.success).toBe(true);
      expect(result.data?.sources).toContain('architecture/system.yaml');
      expect(result.data?.sources).toContain('architecture/services/tracked-service.yaml');
      expect(result.data?.sources).toContain('architecture/environments/prod.yaml');
      expect(result.data?.resolvedAt).toBeDefined();
    });
  });
});
