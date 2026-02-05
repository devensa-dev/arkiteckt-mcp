import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ArchitectureStore } from '../../../src/core/store/architecture-store.js';

describe('ArchitectureStore', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(tmpdir(), `arch-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    archDir = join(testDir, 'architecture');

    // Create directory structure
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'environments'), { recursive: true });
    await mkdir(join(archDir, 'adrs'), { recursive: true });
    await mkdir(join(archDir, 'tenants'), { recursive: true });
    await mkdir(join(archDir, 'rules'), { recursive: true });
    await mkdir(join(archDir, 'capabilities'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  // Helper to write test YAML files
  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    await writeFile(filePath, content, 'utf-8');
  }

  describe('getSystem', () => {
    it('should load and parse system.yaml', async () => {
      await writeYaml('system.yaml', `
name: test-platform
architecture:
  style: microservices
  cloud: aws
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getSystem();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test-platform');
        expect(result.data.architecture.style).toBe('microservices');
      }
    });

    it('should cache system on first load', async () => {
      await writeYaml('system.yaml', `
name: cached-system
architecture:
  style: modular-monolith
  cloud: gcp
`);

      const store = new ArchitectureStore({ baseDir: testDir });

      // First load
      const result1 = await store.getSystem();
      expect(result1.success).toBe(true);

      // Modify file (cache should still return old value)
      await writeYaml('system.yaml', `
name: modified-system
architecture:
  style: microservices
  cloud: aws
`);

      // Second load (should be cached)
      const result2 = await store.getSystem();
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.name).toBe('cached-system');
      }
    });

    it('should return file error if system.yaml missing', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getSystem();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
        expect(result.error.message).toContain('not found');
      }
    });
  });

  describe('getService', () => {
    it('should load service by name', async () => {
      await writeYaml('services/user-service.yaml', `
name: user-service
type: backend
deployment:
  pattern: ecs_fargate
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getService('user-service');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('user-service');
        expect(result.data.type).toBe('backend');
      }
    });

    it('should cache individual services', async () => {
      await writeYaml('services/api.yaml', `
name: api-service
type: api
deployment:
  pattern: lambda
`);

      const store = new ArchitectureStore({ baseDir: testDir });

      const result1 = await store.getService('api');
      expect(result1.success).toBe(true);

      // Modify file
      await writeYaml('services/api.yaml', `
name: modified-api
type: backend
deployment:
  pattern: ecs_ec2
`);

      // Should return cached version
      const result2 = await store.getService('api');
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.name).toBe('api-service');
      }
    });

    it('should return file error for missing service', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getService('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
      }
    });
  });

  describe('getServices', () => {
    it('should load all services from directory', async () => {
      await writeYaml('services/service-a.yaml', `
name: service-a
type: backend
deployment:
  pattern: lambda
`);
      await writeYaml('services/service-b.yaml', `
name: service-b
type: api
deployment:
  pattern: ecs_fargate
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getServices();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        const names = result.data.map((s) => s.name);
        expect(names).toContain('service-a');
        expect(names).toContain('service-b');
      }
    });

    it('should cache service list', async () => {
      await writeYaml('services/test.yaml', `
name: test-service
type: backend
deployment:
  pattern: lambda
`);

      const store = new ArchitectureStore({ baseDir: testDir });

      const result1 = await store.getServices();
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data).toHaveLength(1);
      }

      // Add new service file
      await writeYaml('services/new.yaml', `
name: new-service
type: api
deployment:
  pattern: ecs_fargate
`);

      // Should return cached version (still 1 service)
      const result2 = await store.getServices();
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data).toHaveLength(1);
      }
    });

    it('should return empty array for empty directory', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getServices();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should return first error encountered', async () => {
      await writeYaml('services/valid.yaml', `
name: valid-service
type: backend
deployment:
  pattern: lambda
`);
      await writeYaml('services/invalid.yaml', `
name: 123
type: not-a-valid-type
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getServices();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
      }
    });

    it('should handle .yml extension', async () => {
      await writeYaml('services/test.yml', `
name: yml-service
type: backend
deployment:
  pattern: lambda
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getServices();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe('yml-service');
      }
    });
  });

  describe('getEnvironment', () => {
    it('should load environment by name', async () => {
      await writeYaml('environments/prod.yaml', `
name: production
tier: production
availability:
  sla: "99.9%"
  multiAz: true
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getEnvironment('prod');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('production');
        expect(result.data.tier).toBe('production');
      }
    });
  });

  describe('getEnvironments', () => {
    it('should load all environments', async () => {
      await writeYaml('environments/dev.yaml', `
name: development
tier: development
`);
      await writeYaml('environments/prod.yaml', `
name: production
tier: production
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getEnvironments();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe('getADR', () => {
    it('should load ADR by id', async () => {
      await writeYaml('adrs/001.yaml', `
id: "001"
title: Use Microservices
status: accepted
date: "2024-01-01"
context: Need to scale independently
decision: We will use microservices architecture
consequences:
  positive:
    - Better scalability
  negative:
    - Increased complexity
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getADR('001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('001');
        expect(result.data.title).toBe('Use Microservices');
      }
    });
  });

  describe('getTenant', () => {
    it('should load tenant by name', async () => {
      await writeYaml('tenants/acme.yaml', `
id: acme-001
name: acme-corp
tier: enterprise
isolation: dedicated
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getTenant('acme');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('acme-corp');
        expect(result.data.tier).toBe('enterprise');
      }
    });
  });

  describe('getRules', () => {
    it('should load and flatten rule sets', async () => {
      await writeYaml('rules/security.yaml', `
name: security-rules
rules:
  - id: SEC001
    name: require-encryption
    severity: error
    scope:
      all: true
    condition:
      property: security.encryption.atRest
      operator: equals
      value: true
    requirement: All services must encrypt data at rest
  - id: SEC002
    name: require-auth
    severity: warning
    scope:
      all: true
    condition:
      property: security.authentication
      operator: exists
    requirement: All services must have authentication configured
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getRules();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe('SEC001');
        expect(result.data[1].id).toBe('SEC002');
      }
    });

    it('should flatten multiple rule sets', async () => {
      await writeYaml('rules/set1.yaml', `
name: set1
rules:
  - id: R1
    name: rule1
    severity: error
    scope:
      all: true
    condition:
      property: test
      operator: exists
    requirement: Test requirement 1
`);
      await writeYaml('rules/set2.yaml', `
name: set2
rules:
  - id: R2
    name: rule2
    severity: warning
    scope:
      all: true
    condition:
      property: test2
      operator: exists
    requirement: Test requirement 2
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getRules();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        const ids = result.data.map((r) => r.id);
        expect(ids).toContain('R1');
        expect(ids).toContain('R2');
      }
    });
  });

  describe('getCapabilities', () => {
    it('should load and flatten capability sets', async () => {
      await writeYaml('capabilities/operations.yaml', `
name: operations
capabilities:
  - id: create-service
    name: Create Service
    description: Create a new service
    artifacts:
      required:
        - type: dockerfile
          path: Dockerfile
        - type: terraform
          path: infrastructure/
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getCapabilities();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('create-service');
      }
    });
  });

  describe('single file entities', () => {
    it('should load observability.yaml', async () => {
      await writeYaml('observability.yaml', `
logging:
  format: json
  level: info
metrics:
  provider: prometheus
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getObservability();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.logging.format).toBe('json');
      }
    });

    it('should load cicd.yaml', async () => {
      await writeYaml('cicd.yaml', `
provider: github-actions
testing:
  unitTests:
    required: true
    coverageThreshold: 80
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getCICD();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('github-actions');
      }
    });

    it('should load security.yaml', async () => {
      await writeYaml('security.yaml', `
authentication:
  type: jwt
  provider: cognito
encryption:
  atRest:
    enabled: true
  inTransit:
    enabled: true
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getSecurity();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authentication.provider).toBe('cognito');
      }
    });
  });

  describe('cache management', () => {
    it('should invalidate entire cache', async () => {
      await writeYaml('system.yaml', `
name: original
architecture:
  style: modular-monolith
  cloud: aws
`);

      const store = new ArchitectureStore({ baseDir: testDir });

      const result1 = await store.getSystem();
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.name).toBe('original');
      }

      // Modify file
      await writeYaml('system.yaml', `
name: modified
architecture:
  style: microservices
  cloud: gcp
`);

      // Invalidate cache
      store.invalidateCache();

      // Should load new version
      const result2 = await store.getSystem();
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.name).toBe('modified');
      }
    });

    it('should invalidate specific cache key', async () => {
      await writeYaml('services/svc.yaml', `
name: original-svc
type: backend
deployment:
  pattern: lambda
`);

      const store = new ArchitectureStore({ baseDir: testDir });

      const result1 = await store.getService('svc');
      expect(result1.success).toBe(true);

      // Modify file
      await writeYaml('services/svc.yaml', `
name: modified-svc
type: api
deployment:
  pattern: ecs_fargate
`);

      // Invalidate specific key
      store.invalidateCacheKey('service:svc');

      // Should load new version
      const result2 = await store.getService('svc');
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.name).toBe('modified-svc');
      }
    });
  });

  describe('error handling', () => {
    it('should return error for missing directory', async () => {
      // Remove services directory
      await rm(join(archDir, 'services'), { recursive: true });

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getServices();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
        expect(result.error.code).toBe('ENOENT');
      }
    });

    it('should return validation error for invalid YAML content', async () => {
      await writeYaml('system.yaml', `
name: 12345
architecture: "not an object"
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getSystem();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
      }
    });

    it('should return parse error for malformed YAML', async () => {
      await writeYaml('system.yaml', `
name: test
  invalid: indentation
`);

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.getSystem();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('parse');
      }
    });
  });

  describe('cache options', () => {
    it('should accept custom cache options', async () => {
      await writeYaml('system.yaml', `
name: test
architecture:
  style: microservices
  cloud: aws
`);

      const store = new ArchitectureStore({
        baseDir: testDir,
        cache: { ttl: 1000, maxEntries: 10 },
      });

      const result = await store.getSystem();
      expect(result.success).toBe(true);
    });
  });
});
