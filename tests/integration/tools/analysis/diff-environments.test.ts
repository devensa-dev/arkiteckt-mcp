/**
 * Integration tests for diff_environments tool
 *
 * Tests field-level environment comparison with and without service-specific
 * resolved config differences.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diffEnvironments } from '../../../../src/server/tools/analysis/diff-environments.js';
import type { DiffEnvironmentsInput } from '../../../../src/server/tools/analysis/diff-environments.js';
import { ArchitectureStore } from '../../../../src/core/store/architecture-store.js';

describe('diff_environments integration tests', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `diff-environments-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'environments'), { recursive: true });
    await mkdir(join(archDir, 'services'), { recursive: true });

    // Create minimal system.yaml
    await writeFile(
      join(archDir, 'system.yaml'),
      `
name: test-system
architecture:
  style: microservices
  cloud: aws
  region: us-east-1
`,
      'utf-8'
    );

    // Create staging environment
    await writeFile(
      join(archDir, 'environments', 'staging.yaml'),
      `
name: staging
stage: staging
isProduction: false
availability:
  replicas: 2
  multiAZ: true
  zones:
    - us-east-1a
    - us-east-1b
security:
  level: standard
  encryption:
    atRest: true
    inTransit: true
scaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
`,
      'utf-8'
    );

    // Create prod environment with differences
    await writeFile(
      join(archDir, 'environments', 'prod.yaml'),
      `
name: prod
stage: prod
isProduction: true
availability:
  replicas: 5
  multiAZ: true
  zones:
    - us-east-1a
    - us-east-1b
    - us-east-1c
security:
  level: strict
  encryption:
    atRest: true
    inTransit: true
scaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
disasterRecovery:
  enabled: true
  strategy: active-passive
  rto: 4
  rpo: 1
`,
      'utf-8'
    );

    // Create a test service for service-specific comparison
    await writeFile(
      join(archDir, 'services', 'user-service.yaml'),
      `
name: user-service
type: api
deployment:
  pattern: ecs_fargate
environments:
  staging:
    runtime:
      cpu: "256"
      memory: "512"
  prod:
    runtime:
      cpu: "1024"
      memory: "2048"
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should detect field-level differences between environments', async () => {
    const input: DiffEnvironmentsInput = {
      env_a: 'staging',
      env_b: 'prod',
    };

    const result = await diffEnvironments(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { envA, envB, differences, summary } = result.data;

      expect(envA).toBe('staging');
      expect(envB).toBe('prod');

      // Should detect differences
      expect(differences.length).toBeGreaterThan(0);

      // Check specific differences
      const replicasDiff = differences.find((d) => d.path === 'availability.replicas');
      expect(replicasDiff).toBeDefined();
      expect(replicasDiff?.valueA).toBe(2);
      expect(replicasDiff?.valueB).toBe(5);

      const securityDiff = differences.find((d) => d.path === 'security.level');
      expect(securityDiff).toBeDefined();
      expect(securityDiff?.valueA).toBe('standard');
      expect(securityDiff?.valueB).toBe('strict');

      // Check field only in prod (disaster recovery)
      const drDiff = differences.find((d) => d.path === 'disasterRecovery');
      expect(drDiff).toBeDefined();
      expect(drDiff?.onlyIn).toBe('B');
      expect(drDiff?.valueB).toEqual({
        enabled: true,
        strategy: 'active-passive',
        rto: 4,
        rpo: 1,
      });

      // Summary should be meaningful
      expect(summary).toContain('staging');
      expect(summary).toContain('prod');
      expect(summary.length).toBeGreaterThan(0);
    }
  });

  it('should show identical environments when no differences exist', async () => {
    // Create two identical environments (except for name)
    await writeFile(
      join(archDir, 'environments', 'env1.yaml'),
      `
name: env1
stage: test
isProduction: false
availability:
  replicas: 1
  multiAZ: false
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'environments', 'env2.yaml'),
      `
name: env2
stage: test
isProduction: false
availability:
  replicas: 1
  multiAZ: false
`,
      'utf-8'
    );

    const input: DiffEnvironmentsInput = {
      env_a: 'env1',
      env_b: 'env2',
    };

    const result = await diffEnvironments(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { differences, summary } = result.data;

      // Should only differ in the 'name' field
      expect(differences.length).toBe(1);
      expect(differences[0].path).toBe('name');

      expect(summary).toContain('env1');
      expect(summary).toContain('env2');
    }
  });

  it('should resolve service-specific config differences when service_name provided', async () => {
    const input: DiffEnvironmentsInput = {
      env_a: 'staging',
      env_b: 'prod',
      service_name: 'user-service',
    };

    const result = await diffEnvironments(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { differences } = result.data;

      // Should include differences from resolved service config
      expect(differences.length).toBeGreaterThan(0);

      // Check that service-specific overrides are reflected
      const cpuDiff = differences.find((d) => d.path.includes('runtime.cpu'));
      const memoryDiff = differences.find((d) => d.path.includes('runtime.memory'));

      // At least one of these should be different due to environment-specific overrides
      expect(cpuDiff || memoryDiff).toBeDefined();
    }
  });

  it('should return error when first environment does not exist', async () => {
    const input: DiffEnvironmentsInput = {
      env_a: 'nonexistent',
      env_b: 'prod',
    };

    const result = await diffEnvironments(input, { baseDir: testDir });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('ENOENT');
  });

  it('should return error when second environment does not exist', async () => {
    const input: DiffEnvironmentsInput = {
      env_a: 'staging',
      env_b: 'nonexistent',
    };

    const result = await diffEnvironments(input, { baseDir: testDir });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('ENOENT');
  });

  it('should return error when service does not exist for service-specific diff', async () => {
    const input: DiffEnvironmentsInput = {
      env_a: 'staging',
      env_b: 'prod',
      service_name: 'nonexistent-service',
    };

    const result = await diffEnvironments(input, { baseDir: testDir });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('ENOENT');
  });

  it('should identify onlyIn fields correctly', async () => {
    const input: DiffEnvironmentsInput = {
      env_a: 'staging',
      env_b: 'prod',
    };

    const result = await diffEnvironments(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { differences } = result.data;

      // Disaster recovery should only be in prod
      const drFields = differences.filter((d) => d.path.startsWith('disasterRecovery'));
      expect(drFields.length).toBeGreaterThan(0);

      const drDiff = differences.find((d) => d.path === 'disasterRecovery');
      expect(drDiff?.onlyIn).toBe('B');
      expect(drDiff?.valueA).toBeUndefined();
      expect(drDiff?.valueB).toBeDefined();
    }
  });

  it('should generate meaningful summary for differences', async () => {
    const input: DiffEnvironmentsInput = {
      env_a: 'staging',
      env_b: 'prod',
    };

    const result = await diffEnvironments(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { summary, differences } = result.data;

      // Summary should mention both environments
      expect(summary.toLowerCase()).toContain('staging');
      expect(summary.toLowerCase()).toContain('prod');

      // Summary should be descriptive
      expect(summary.length).toBeGreaterThan(10);

      // Summary should reflect the actual number of differences
      if (differences.length > 0) {
        expect(summary).not.toContain('identical');
      }
    }
  });
});
