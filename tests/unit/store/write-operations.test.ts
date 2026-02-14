/**
 * Unit tests for ArchitectureStore write operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ArchitectureStore } from '../../../src/core/store/architecture-store.js';
import type { Service, Environment, System, CICD, Observability } from '../../../src/shared/types/index.js';

describe('ArchitectureStore Write Operations', () => {
  let testDir: string;
  let archDir: string;
  let store: ArchitectureStore;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(tmpdir(), `write-ops-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    archDir = join(testDir, 'architecture');

    // Create directory structure
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'environments'), { recursive: true });

    // Create minimal system.yaml for dependency graph operations
    await writeFile(
      join(archDir, 'system.yaml'),
      `
name: test-system
architecture:
  style: microservices
`,
      'utf-8'
    );

    store = new ArchitectureStore({ baseDir: testDir });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('createService', () => {
    it('should create a new service with minimal config', async () => {
      const config: Partial<Service> = {
        type: 'api',
        deployment: {
          pattern: 'lambda',
        },
      };

      const result = await store.createService('api-service', config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('api-service');
        expect(result.data.type).toBe('api');
        expect(result.data.deployment.pattern).toBe('lambda');
      }
    });

    it('should reject duplicate service names', async () => {
      const config: Partial<Service> = {
        type: 'backend',
        deployment: { pattern: 'ecs_fargate' },
      };

      // Create first service
      const result1 = await store.createService('user-service', config);
      expect(result1.success).toBe(true);

      // Attempt to create duplicate
      const result2 = await store.createService('user-service', config);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.type).toBe('validation');
        expect(result2.error.message).toContain('already exists');
      }
    });

    it('should reject invalid service config (schema validation)', async () => {
      const config = {
        type: 'invalid-type',
        deployment: { pattern: 'lambda' },
      } as unknown as Partial<Service>;

      const result = await store.createService('test-service', config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
      }
    });

    it('should reject circular dependencies', async () => {
      // Create service A
      await store.createService('service-a', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'service-b' }],
      });

      // Create service B with dependency on A (creates cycle)
      const result = await store.createService('service-b', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'service-a' }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
        expect(result.error.message).toContain('Circular dependency');
      }
    });

    it('should invalidate cache after creation', async () => {
      const config: Partial<Service> = {
        type: 'api',
        deployment: { pattern: 'lambda' },
      };

      // Create service
      await store.createService('new-service', config);

      // Read service (should not be cached)
      const result = await store.getService('new-service');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('new-service');
      }
    });

    it('should fail if architecture directory not initialized', async () => {
      const uninitializedDir = join(tmpdir(), `uninit-${Date.now()}`);
      const uninitializedStore = new ArchitectureStore({ baseDir: uninitializedDir });

      const result = await uninitializedStore.createService('test', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
        expect(result.error.message).toContain('not initialized');
      }

      // Cleanup
      await rm(uninitializedDir, { recursive: true, force: true }).catch(() => {});
    });
  });

  describe('updateService', () => {
    beforeEach(async () => {
      // Create initial service
      await store.createService('api-service', {
        type: 'api',
        deployment: {
          pattern: 'lambda',
          replicas: 1,
        },
        runtime: {
          language: 'typescript',
          version: '18',
        },
      });
    });

    it('should update existing service with deep merge', async () => {
      const updates: Partial<Service> = {
        deployment: {
          replicas: 3,
        },
      };

      const result = await store.updateService('api-service', updates);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deployment.replicas).toBe(3);
        expect(result.data.deployment.pattern).toBe('lambda'); // Preserved
        expect(result.data.runtime?.language).toBe('typescript'); // Preserved
      }
    });

    it('should replace arrays when updating', async () => {
      // Create service with dependencies
      await store.createService('service-with-deps', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'dep-a' }, { name: 'dep-b' }],
      });

      // Update with new dependencies (should replace, not append)
      const result = await store.updateService('service-with-deps', {
        dependencies: [{ name: 'dep-c' }],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dependencies).toHaveLength(1);
        expect(result.data.dependencies![0]!.name).toBe('dep-c');
      }
    });

    it('should reject update if service not found', async () => {
      const result = await store.updateService('nonexistent', {
        type: 'backend',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
      }
    });

    it('should reject update that creates circular dependency', async () => {
      await store.createService('service-a', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'service-b' }],
      });

      await store.createService('service-b', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      // Try to add dependency that creates cycle
      const result = await store.updateService('service-b', {
        dependencies: [{ name: 'service-a' }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
        expect(result.error.message).toContain('Circular dependency');
      }
    });

    it('should invalidate cache after update', async () => {
      await store.updateService('api-service', {
        type: 'backend',
      });

      // Clear internal reference and read again
      const result = await store.getService('api-service');
      expect(result.success).toBe(true);
    });
  });

  describe('deleteService', () => {
    beforeEach(async () => {
      await store.createService('service-to-delete', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });
    });

    it('should delete service when no dependents', async () => {
      const result = await store.deleteService('service-to-delete');

      expect(result.success).toBe(true);

      // Verify service is deleted
      const getResult = await store.getService('service-to-delete');
      expect(getResult.success).toBe(false);
    });

    it('should block deletion when service has dependents', async () => {
      await store.createService('dependent-service', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'service-to-delete' }],
      });

      const result = await store.deleteService('service-to-delete');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
        expect(result.error.message).toContain('depend on it');
        expect(result.error.message).toContain('dependent-service');
      }
    });

    it('should force delete when force=true even with dependents', async () => {
      await store.createService('dependent-service', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'service-to-delete' }],
      });

      const result = await store.deleteService('service-to-delete', true);

      expect(result.success).toBe(true);

      // Verify service is deleted
      const getResult = await store.getService('service-to-delete');
      expect(getResult.success).toBe(false);
    });

    it('should fail if service does not exist', async () => {
      const result = await store.deleteService('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
      }
    });
  });

  describe('createEnvironment', () => {
    it('should create a new environment', async () => {
      const config: Partial<Environment> = {
        availability: {
          multiAZ: true,
          multiRegion: false,
        },
      };

      const result = await store.createEnvironment('production', config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('production');
        expect(result.data.availability?.multiAZ).toBe(true);
      }
    });

    it('should reject duplicate environment names', async () => {
      await store.createEnvironment('dev', {});

      const result = await store.createEnvironment('dev', {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
        expect(result.error.message).toContain('already exists');
      }
    });

    it('should invalidate cache after creation', async () => {
      await store.createEnvironment('staging', {});

      const result = await store.getEnvironment('staging');
      expect(result.success).toBe(true);
    });
  });

  describe('updateEnvironment', () => {
    beforeEach(async () => {
      await store.createEnvironment('dev', {
        availability: { multiAZ: false, multiRegion: false },
        scaling: { minReplicas: 1, maxReplicas: 2 },
      });
    });

    it('should update existing environment with deep merge', async () => {
      const result = await store.updateEnvironment('dev', {
        availability: { multiAZ: true },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.availability?.multiAZ).toBe(true);
        expect(result.data.availability?.multiRegion).toBe(false); // Preserved
      }
    });

    it('should reject update if environment not found', async () => {
      const result = await store.updateEnvironment('nonexistent', {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
      }
    });
  });

  describe('deleteEnvironment', () => {
    beforeEach(async () => {
      await store.createEnvironment('test-env', {});
    });

    it('should delete environment', async () => {
      const result = await store.deleteEnvironment('test-env');

      expect(result.success).toBe(true);

      // Verify deletion
      const getResult = await store.getEnvironment('test-env');
      expect(getResult.success).toBe(false);
    });

    it('should fail if environment does not exist', async () => {
      const result = await store.deleteEnvironment('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
      }
    });

    it('should succeed even if services have orphaned overrides', async () => {
      // Create service with environment-specific override
      await store.createService('svc-with-override', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        environments: {
          'test-env': {
            deployment: { replicas: 5 },
          },
        },
      });

      // Delete environment (should succeed but note orphaned config)
      const result = await store.deleteEnvironment('test-env');

      expect(result.success).toBe(true);
    });
  });

  describe('updateSystem', () => {
    it('should update system configuration', async () => {
      const updates: Partial<System> = {
        defaults: {
          runtime: {
            language: 'python',
            version: '3.11',
          },
        },
      };

      const result = await store.updateSystem(updates);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaults?.runtime?.language).toBe('python');
        expect(result.data.defaults?.runtime?.version).toBe('3.11');
      }
    });

    it('should invalidate all caches after update', async () => {
      await store.updateSystem({
        defaults: { runtime: { language: 'go', version: '1.21' } },
      });

      // Read system again
      const result = await store.getSystem();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaults?.runtime?.language).toBe('go');
      }
    });
  });

  describe('setCICD', () => {
    it('should create new CI/CD config if not exists', async () => {
      const config: Partial<CICD> = {
        provider: 'github-actions',
        steps: [
          {
            type: 'build',
            name: 'Build',
            commands: ['npm install', 'npm run build'],
          },
        ],
      };

      const result = await store.setCICD(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('github-actions');
        expect(result.data.steps).toHaveLength(1);
      }
    });

    it('should merge with existing CI/CD config (upsert)', async () => {
      // Create initial config
      await store.setCICD({
        provider: 'github-actions',
        steps: [{ type: 'build', name: 'Build', commands: ['npm build'] }],
      });

      // Update with additional config
      const result = await store.setCICD({
        qualityGates: [
          {
            name: 'Code Coverage',
            metric: 'coverage',
            operator: 'gte',
            threshold: 80,
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('github-actions'); // Preserved
        expect(result.data.qualityGates).toBeDefined();
      }
    });
  });

  describe('setObservability', () => {
    it('should create new observability config if not exists', async () => {
      const config: Partial<Observability> = {
        logging: {
          level: 'info',
          structured: true,
        },
      };

      const result = await store.setObservability(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.logging?.level).toBe('info');
        expect(result.data.logging?.structured).toBe(true);
      }
    });

    it('should merge with existing observability config (upsert)', async () => {
      // Create initial config
      await store.setObservability({
        logging: { level: 'debug', structured: true },
      });

      // Update with additional config
      const result = await store.setObservability({
        metrics: {
          enabled: true,
          provider: 'prometheus',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.logging?.level).toBe('debug'); // Preserved
        expect(result.data.metrics?.enabled).toBe(true);
      }
    });
  });
});
