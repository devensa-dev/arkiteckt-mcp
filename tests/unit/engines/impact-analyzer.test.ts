/**
 * Unit tests for ImpactAnalyzer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ArchitectureStore } from '../../../src/core/store/architecture-store.js';
import { ImpactAnalyzer } from '../../../src/core/engines/impact-analyzer.js';
import type { Service, DeploymentPattern } from '../../../src/shared/types/index.js';

describe('ImpactAnalyzer', () => {
  let testDir: string;
  let archDir: string;
  let store: ArchitectureStore;
  let analyzer: ImpactAnalyzer;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(tmpdir(), `impact-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    archDir = join(testDir, 'architecture');

    // Create directory structure
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'environments'), { recursive: true });
    await mkdir(join(archDir, 'capabilities'), { recursive: true });

    // Create minimal system.yaml
    await writeFile(
      join(archDir, 'system.yaml'),
      `
name: test-system
architecture:
  style: microservices
defaults:
  runtime:
    language: typescript
    version: "18"
`,
      'utf-8'
    );

    store = new ArchitectureStore({ baseDir: testDir });
    analyzer = new ImpactAnalyzer(store);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('analyzeServiceDeletion', () => {
    it('should return empty dependents when no services depend on target', async () => {
      await store.createService('service-a', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      const result = await analyzer.analyzeServiceDeletion('service-a');

      expect(result.dependents).toHaveLength(0);
      expect(result.canDelete).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should identify services that depend on target', async () => {
      await store.createService('database', {
        type: 'backend',
        deployment: { pattern: 'ecs_fargate' },
      });

      await store.createService('api-service', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'database' }],
      });

      await store.createService('worker-service', {
        type: 'worker',
        deployment: { pattern: 'ecs_fargate' },
        dependencies: [{ name: 'database' }],
      });

      const result = await analyzer.analyzeServiceDeletion('database');

      expect(result.dependents).toHaveLength(2);
      expect(result.dependents).toContain('api-service');
      expect(result.dependents).toContain('worker-service');
      expect(result.canDelete).toBe(false);
      expect(result.message).toContain('Cannot delete');
      expect(result.message).toContain('database');
    });

    it('should not include the service itself as a dependent', async () => {
      await store.createService('self-service', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      const result = await analyzer.analyzeServiceDeletion('self-service');

      expect(result.dependents).not.toContain('self-service');
    });

    it('should handle transitive dependencies', async () => {
      await store.createService('service-a', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      await store.createService('service-b', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'service-a' }],
      });

      await store.createService('service-c', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        dependencies: [{ name: 'service-b' }],
      });

      const result = await analyzer.analyzeServiceDeletion('service-a');

      // Only direct dependents should be listed
      expect(result.dependents).toHaveLength(1);
      expect(result.dependents).toContain('service-b');
    });
  });

  describe('analyzeSystemDefaultsChange', () => {
    it('should identify services affected by runtime defaults change', async () => {
      // Create service that inherits system defaults (no runtime specified)
      await store.createService('inheriting-service', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      // Create service with explicit runtime (should not be affected)
      await store.createService('explicit-service', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        runtime: {
          language: 'python',
          version: '3.11',
        },
      });

      const oldDefaults = {
        runtime: {
          language: 'typescript',
          version: '18',
        },
      };

      const newDefaults = {
        runtime: {
          language: 'typescript',
          version: '20',
        },
      };

      const result = await analyzer.analyzeSystemDefaultsChange(oldDefaults, newDefaults);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('inheriting-service');
      expect(result[0]!.reason).toContain('system defaults');
      expect(result[0]!.fields).toHaveLength(1);
      expect(result[0]!.fields[0]!.path).toBe('runtime.version');
      expect(result[0]!.fields[0]!.before).toBe('18');
      expect(result[0]!.fields[0]!.after).toBe('20');
    });

    it('should return empty array when no services are affected', async () => {
      // All services have explicit runtime
      await store.createService('service-1', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        runtime: { language: 'python', version: '3.11' },
      });

      const oldDefaults = {
        runtime: { language: 'typescript', version: '18' },
      };

      const newDefaults = {
        runtime: { language: 'typescript', version: '20' },
      };

      const result = await analyzer.analyzeSystemDefaultsChange(oldDefaults, newDefaults);

      expect(result).toHaveLength(0);
    });

    it('should handle language changes', async () => {
      await store.createService('service-inheriting', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      const oldDefaults = {
        runtime: { language: 'typescript', version: '18' },
      };

      const newDefaults = {
        runtime: { language: 'python', version: '3.11' },
      };

      const result = await analyzer.analyzeSystemDefaultsChange(oldDefaults, newDefaults);

      expect(result).toHaveLength(1);
      expect(result[0]!.fields).toHaveLength(2); // Both language and version changed
      expect(result[0]!.fields.some((f) => f.path === 'runtime.language')).toBe(true);
      expect(result[0]!.fields.some((f) => f.path === 'runtime.version')).toBe(true);
    });
  });

  describe('analyzeDeploymentPatternChange', () => {
    beforeEach(async () => {
      // Create a capability set for lambda pattern
      await writeFile(
        join(archDir, 'capabilities', 'lambda-api.yaml'),
        `
name: lambda-api
capabilities:
  - id: lambda-api-cap
    name: Lambda API
    deploymentPattern: lambda
    serviceType: api
    artifacts:
      - type: source-code
        name: Lambda function code
        required: true
      - type: unit-test
        name: Unit tests
        required: true
`,
        'utf-8'
      );

      // Create a capability set for kubernetes pattern
      await writeFile(
        join(archDir, 'capabilities', 'k8s-api.yaml'),
        `
name: k8s-api
capabilities:
  - id: k8s-api-cap
    name: Kubernetes API
    deploymentPattern: kubernetes
    serviceType: api
    artifacts:
      - type: source-code
        name: Application code
        required: true
      - type: unit-test
        name: Unit tests
        required: true
      - type: kubernetes-manifest
        name: K8s deployment manifest
        required: true
`,
        'utf-8'
      );
    });

    it('should identify added artifacts when changing deployment pattern', async () => {
      const service: Service = {
        schemaVersion: '1.0.0',
        name: 'api-service',
        type: 'api',
        deployment: { pattern: 'lambda' },
      };

      const result = await analyzer.analyzeDeploymentPatternChange(service, 'lambda', 'kubernetes');

      expect(result.added.length).toBeGreaterThan(0);
      expect(result.added.some((art) => art.type === 'kubernetes-manifest')).toBe(true);
    });

    it('should identify removed artifacts when changing deployment pattern', async () => {
      const service: Service = {
        schemaVersion: '1.0.0',
        name: 'api-service',
        type: 'api',
        deployment: { pattern: 'kubernetes' },
      };

      const result = await analyzer.analyzeDeploymentPatternChange(service, 'kubernetes', 'lambda');

      expect(result.removed.length).toBeGreaterThan(0);
      expect(result.removed.some((art) => art.type === 'kubernetes-manifest')).toBe(true);
    });

    it('should return empty delta when no capabilities defined', async () => {
      const service: Service = {
        schemaVersion: '1.0.0',
        name: 'worker-service',
        type: 'worker',
        deployment: { pattern: 'ecs_fargate' },
      };

      const result = await analyzer.analyzeDeploymentPatternChange(
        service,
        'ecs_fargate',
        'ecs_ec2'
      );

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });
  });

  describe('analyzeEnvironmentDeletion', () => {
    it('should identify services with orphaned environment overrides', async () => {
      await store.createEnvironment('staging', {});

      await store.createService('service-with-override', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        environments: {
          staging: {
            deployment: { replicas: 3 },
          },
        },
      });

      await store.createService('service-without-override', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      const result = await analyzer.analyzeEnvironmentDeletion('staging');

      expect(result.orphanedOverrides).toHaveLength(1);
      expect(result.orphanedOverrides[0]!.service).toBe('service-with-override');
      expect(result.orphanedOverrides[0]!.envKey).toBe('staging');
      expect(result.message).toContain('orphaned overrides');
      expect(result.message).toContain('service-with-override');
    });

    it('should return empty array when no orphaned overrides exist', async () => {
      await store.createEnvironment('test-env', {});

      await store.createService('service-no-override', {
        type: 'api',
        deployment: { pattern: 'lambda' },
      });

      const result = await analyzer.analyzeEnvironmentDeletion('test-env');

      expect(result.orphanedOverrides).toHaveLength(0);
      expect(result.message).toBeUndefined();
    });

    it('should identify multiple services with orphaned overrides', async () => {
      await store.createEnvironment('production', {});

      await store.createService('service-a', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        environments: {
          production: { deployment: { replicas: 5 } },
        },
      });

      await store.createService('service-b', {
        type: 'backend',
        deployment: { pattern: 'ecs_fargate' },
        environments: {
          production: { deployment: { replicas: 10 } },
        },
      });

      const result = await analyzer.analyzeEnvironmentDeletion('production');

      expect(result.orphanedOverrides).toHaveLength(2);
      expect(result.orphanedOverrides.some((o) => o.service === 'service-a')).toBe(true);
      expect(result.orphanedOverrides.some((o) => o.service === 'service-b')).toBe(true);
    });

    it('should not flag services with overrides for different environments', async () => {
      await store.createEnvironment('dev', {});

      await store.createService('service', {
        type: 'api',
        deployment: { pattern: 'lambda' },
        environments: {
          production: { deployment: { replicas: 5 } },
        },
      });

      const result = await analyzer.analyzeEnvironmentDeletion('dev');

      expect(result.orphanedOverrides).toHaveLength(0);
    });
  });
});
