/**
 * Integration tests for validate_architecture tool
 *
 * Tests cross-entity validation including dependency references, cycles,
 * schema validation, environment refs, SLO definitions, resilience config,
 * security consistency, and orphaned configs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateArchitecture } from '../../../../src/server/tools/analysis/validate-architecture.js';
import type { ValidateArchitectureInput } from '../../../../src/server/tools/analysis/validate-architecture.js';

describe('validate_architecture integration tests', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `validate-architecture-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should validate valid architecture with no issues', async () => {
    // Create valid services
    await writeFile(
      join(archDir, 'services', 'user-service.yaml'),
      `
name: user-service
type: api
deployment:
  pattern: ecs_fargate
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'services', 'order-service.yaml'),
      `
name: order-service
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: user-service
    type: sync
`,
      'utf-8'
    );

    // Create valid environment
    await writeFile(
      join(archDir, 'environments', 'prod.yaml'),
      `
name: prod
stage: prod
isProduction: true
availability:
  replicas: 3
  multiAZ: true
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'all',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { valid, issues } = result.data;

      expect(valid).toBe(true);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBe(0);
    }
  });

  it('should detect missing dependency reference', async () => {
    // Create service with invalid dependency
    await writeFile(
      join(archDir, 'services', 'order-service.yaml'),
      `
name: order-service
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: analytics-service
    type: sync
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'all',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { valid, issues, dependencyAnalysis } = result.data;

      expect(valid).toBe(false);

      // Should have error for missing dependency
      const depError = issues.find(
        (i) => i.severity === 'error' && i.message.includes('analytics-service')
      );
      expect(depError).toBeDefined();
      expect(depError?.entity).toBe('order-service');
      expect(depError?.suggestion).toBeDefined();

      // Should appear in missing refs
      expect(dependencyAnalysis.missingRefs).toContain('analytics-service');
    }
  });

  it('should detect circular dependencies', async () => {
    // Create services with circular dependency
    await writeFile(
      join(archDir, 'services', 'service-a.yaml'),
      `
name: service-a
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: service-b
    type: sync
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'services', 'service-b.yaml'),
      `
name: service-b
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: service-a
    type: sync
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'dependencies',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { valid, issues } = result.data;

      expect(valid).toBe(false);

      // Should detect circular dependency
      const cycleError = issues.find(
        (i) => i.severity === 'error' && i.message.includes('Circular dependency')
      );
      expect(cycleError).toBeDefined();
    }
  });

  it('should detect invalid environment references in service configs', async () => {
    // Create service with override for non-existent environment
    await writeFile(
      join(archDir, 'services', 'user-service.yaml'),
      `
name: user-service
type: api
deployment:
  pattern: ecs_fargate
environments:
  nonexistent-env:
    runtime:
      cpu: "1024"
      memory: "2048"
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'all',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { valid, issues } = result.data;

      expect(valid).toBe(false);

      // Should have error for invalid environment reference
      const envError = issues.find(
        (i) =>
          i.severity === 'error' &&
          i.message.includes('Environment') &&
          i.message.includes('does not exist')
      );
      expect(envError).toBeDefined();
      expect(envError?.entity).toBe('user-service');
      expect(envError?.path).toContain('environments.nonexistent-env');
    }
  });

  it('should warn about missing SLO for production services', async () => {
    // Create production environment
    await writeFile(
      join(archDir, 'environments', 'prod.yaml'),
      `
name: prod
stage: prod
isProduction: true
`,
      'utf-8'
    );

    // Create service without SLO but with prod override
    await writeFile(
      join(archDir, 'services', 'api-service.yaml'),
      `
name: api-service
type: api
deployment:
  pattern: ecs_fargate
environments:
  prod:
    availability:
      replicas: 5
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'all',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { issues } = result.data;

      // Should have warning for missing SLO
      const sloWarning = issues.find(
        (i) => i.severity === 'warning' && i.message.includes('SLO')
      );
      expect(sloWarning).toBeDefined();
      expect(sloWarning?.entity).toBe('api-service');
      expect(sloWarning?.suggestion).toContain('SLO');
    }
  });

  it('should provide info about missing resilience config for services with many dependencies', async () => {
    // Create services
    await writeFile(
      join(archDir, 'services', 'dep1.yaml'),
      `
name: dep1
type: api
deployment:
  pattern: kubernetes
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'services', 'dep2.yaml'),
      `
name: dep2
type: api
deployment:
  pattern: kubernetes
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'services', 'dep3.yaml'),
      `
name: dep3
type: api
deployment:
  pattern: kubernetes
`,
      'utf-8'
    );

    // Create service with 3+ dependencies but no resilience config
    await writeFile(
      join(archDir, 'services', 'complex-service.yaml'),
      `
name: complex-service
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: dep1
    type: sync
  - name: dep2
    type: sync
  - name: dep3
    type: sync
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'services',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { issues } = result.data;

      // Should have info about missing resilience config
      const resilienceInfo = issues.find(
        (i) => i.severity === 'info' && i.message.includes('resilience')
      );
      expect(resilienceInfo).toBeDefined();
      expect(resilienceInfo?.entity).toBe('complex-service');
    }
  });

  it('should detect prod environment with relaxed security level', async () => {
    // Create prod environment with relaxed security
    await writeFile(
      join(archDir, 'environments', 'prod.yaml'),
      `
name: prod
stage: prod
isProduction: true
security:
  level: relaxed
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'security',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { valid, issues } = result.data;

      expect(valid).toBe(false);

      // Should have error for relaxed security in prod
      const securityError = issues.find(
        (i) => i.severity === 'error' && i.message.includes('relaxed')
      );
      expect(securityError).toBeDefined();
      expect(securityError?.entity).toBe('prod');
      expect(securityError?.suggestion).toContain('strict');
    }
  });

  it('should detect orphaned environments with no service overrides', async () => {
    // Create environment
    await writeFile(
      join(archDir, 'environments', 'staging.yaml'),
      `
name: staging
stage: staging
isProduction: false
`,
      'utf-8'
    );

    // Create service with NO environment overrides
    await writeFile(
      join(archDir, 'services', 'simple-service.yaml'),
      `
name: simple-service
type: api
deployment:
  pattern: lambda
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'all',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { warnings } = result.data;

      // Should warn about orphaned environment
      const orphanWarning = warnings.find((w) =>
        w.includes('no services with environment-specific overrides')
      );
      expect(orphanWarning).toBeDefined();
      expect(orphanWarning).toContain('staging');
    }
  });

  it('should identify orphaned services in dependency analysis', async () => {
    // Create orphaned service (no deps, no dependents)
    await writeFile(
      join(archDir, 'services', 'orphan-service.yaml'),
      `
name: orphan-service
type: worker
deployment:
  pattern: kubernetes
`,
      'utf-8'
    );

    // Create connected services
    await writeFile(
      join(archDir, 'services', 'service-a.yaml'),
      `
name: service-a
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: service-b
    type: sync
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'services', 'service-b.yaml'),
      `
name: service-b
type: api
deployment:
  pattern: kubernetes
`,
      'utf-8'
    );

    const input: ValidateArchitectureInput = {
      scope: 'all',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { dependencyAnalysis } = result.data;

      // Should identify orphaned service
      expect(dependencyAnalysis.orphans).toContain('orphan-service');
      expect(dependencyAnalysis.orphans.length).toBeGreaterThan(0);
    }
  });

  it('should scope validation to specific areas when scope parameter provided', async () => {
    // Create service with missing dependency
    await writeFile(
      join(archDir, 'services', 'order-service.yaml'),
      `
name: order-service
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: missing-service
    type: sync
`,
      'utf-8'
    );

    // Test services scope
    const servicesInput: ValidateArchitectureInput = {
      scope: 'services',
    };

    const servicesResult = await validateArchitecture(servicesInput, { baseDir: testDir });

    expect(servicesResult.success).toBe(true);
    if (servicesResult.success) {
      // Should run service validations but not dependency validations
      // So we should NOT see missing dependency errors (those are in 'dependencies' scope)
      const { issues } = servicesResult.data;
      const depErrors = issues.filter((i) => i.message.includes('missing-service'));
      expect(depErrors.length).toBe(0);
    }

    // Test dependencies scope
    const depsInput: ValidateArchitectureInput = {
      scope: 'dependencies',
    };

    const depsResult = await validateArchitecture(depsInput, { baseDir: testDir });

    expect(depsResult.success).toBe(true);
    if (depsResult.success) {
      // Should run dependency validations
      const { issues } = depsResult.data;
      const depErrors = issues.filter((i) => i.message.includes('missing-service'));
      expect(depErrors.length).toBeGreaterThan(0);
    }
  });

  it('should handle empty architecture gracefully', async () => {
    const input: ValidateArchitectureInput = {
      scope: 'all',
    };

    const result = await validateArchitecture(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { valid, issues } = result.data;

      // Should be valid with no services/environments
      expect(valid).toBe(true);
      expect(issues.length).toBe(0);
    }
  });
});
