/**
 * Integration tests for scaffold_environment tool
 *
 * Tests scaffolding of environments with tier-specific defaults,
 * service impacts, infrastructure steps, and security checklists.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scaffoldEnvironment } from '../../../../src/server/tools/scaffold/scaffold-environment.js';
import type { ScaffoldEnvironmentInput } from '../../../../src/server/tools/scaffold/scaffold-environment.js';
import { ArchitectureStore } from '../../../../src/core/store/architecture-store.js';

describe('scaffold_environment integration tests', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'arch-test-'));
  });

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should scaffold a dev environment with dev defaults', async () => {
    const input: ScaffoldEnvironmentInput = {
      name: 'development',
      base_template: 'dev',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { environment, infrastructureSteps, securityChecklist } = result.data;

      // Dev-specific defaults applied
      expect(environment.name).toBe('development');
      expect(environment.stage).toBe('dev');
      expect(environment.isProduction).toBe(false);
      expect(environment.availability?.replicas).toBe(1);
      expect(environment.availability?.multiAZ).toBe(false);
      expect(environment.security?.level).toBe('relaxed');
      expect(environment.scaling?.enabled).toBe(false);
      expect(environment.disasterRecovery?.enabled).toBe(false);

      // Infrastructure steps appropriate for dev
      expect(infrastructureSteps.length).toBeGreaterThan(0);
      expect(infrastructureSteps.some((s) => s.includes('VPC'))).toBe(true);

      // Security checklist is minimal for dev
      expect(securityChecklist.length).toBeGreaterThan(0);
      expect(securityChecklist.length).toBeLessThan(8); // Dev has fewer checks than prod
    }
  });

  it('should scaffold a staging environment with staging defaults', async () => {
    const input: ScaffoldEnvironmentInput = {
      name: 'staging',
      base_template: 'staging',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { environment, securityChecklist } = result.data;

      // Staging-specific defaults applied
      expect(environment.stage).toBe('staging');
      expect(environment.isProduction).toBe(false);
      expect(environment.availability?.replicas).toBe(2);
      expect(environment.availability?.multiAZ).toBe(true);
      expect(environment.security?.level).toBe('standard');
      expect(environment.scaling?.enabled).toBe(true);
      expect(environment.scaling?.minReplicas).toBe(2);
      expect(environment.scaling?.maxReplicas).toBe(5);

      // DR enabled for staging
      expect(environment.disasterRecovery?.enabled).toBe(true);
      expect(environment.disasterRecovery?.strategy).toBe('pilot-light');

      // More security checks than dev, but less than prod
      expect(securityChecklist.length).toBeGreaterThan(4);
    }
  });

  it('should scaffold a prod environment with strict security', async () => {
    const input: ScaffoldEnvironmentInput = {
      name: 'production',
      base_template: 'prod',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { environment, infrastructureSteps, securityChecklist } = result.data;

      // Prod-specific defaults applied
      expect(environment.stage).toBe('prod');
      expect(environment.isProduction).toBe(true);
      expect(environment.availability?.replicas).toBe(3);
      expect(environment.availability?.multiAZ).toBe(true);
      expect(environment.security?.level).toBe('strict');
      expect(environment.security?.encryption?.atRest).toBe(true);
      expect(environment.security?.encryption?.inTransit).toBe(true);
      expect(environment.security?.network?.privateOnly).toBe(true);
      expect(environment.security?.authentication?.mfaRequired).toBe(true);

      // Auto-scaling enabled with higher limits
      expect(environment.scaling?.enabled).toBe(true);
      expect(environment.scaling?.minReplicas).toBe(3);
      expect(environment.scaling?.maxReplicas).toBe(20);

      // Full DR for production
      expect(environment.disasterRecovery?.enabled).toBe(true);
      expect(environment.disasterRecovery?.rto).toBe(60);
      expect(environment.disasterRecovery?.rpo).toBe(15);
      expect(environment.disasterRecovery?.strategy).toBe('warm-standby');

      // More infrastructure steps for prod
      expect(infrastructureSteps.length).toBeGreaterThan(8);
      expect(infrastructureSteps.some((s) => s.toLowerCase().includes('disaster recovery'))).toBe(
        true
      );

      // Comprehensive security checklist for prod
      expect(securityChecklist.length).toBeGreaterThan(10);
      expect(securityChecklist.some((s) => s.includes('MFA'))).toBe(true);
      expect(securityChecklist.some((s) => s.includes('encryption'))).toBe(true);
    }
  });

  it('should infer tier from environment name when base_template not provided', async () => {
    const prodInput: ScaffoldEnvironmentInput = {
      name: 'prod-us-east',
    };

    const prodResult = await scaffoldEnvironment(prodInput, { baseDir: testDir });

    expect(prodResult.success).toBe(true);
    if (prodResult.success) {
      expect(prodResult.data.environment.security?.level).toBe('strict');
    }

    // Cleanup for next test
    rmSync(testDir, { recursive: true, force: true });
    testDir = mkdtempSync(join(tmpdir(), 'arch-test-'));

    const devInput: ScaffoldEnvironmentInput = {
      name: 'local-dev',
    };

    const devResult = await scaffoldEnvironment(devInput, { baseDir: testDir });

    expect(devResult.success).toBe(true);
    if (devResult.success) {
      expect(devResult.data.environment.security?.level).toBe('relaxed');
    }
  });

  it('should analyze service impacts when services exist', async () => {
    // Create some services first
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.createService('api-service', {
      name: 'api-service',
      deployment: { pattern: 'container' },
    });
    await store.createService('worker-service', {
      name: 'worker-service',
      deployment: { pattern: 'lambda' },
    });

    const input: ScaffoldEnvironmentInput = {
      name: 'staging',
      base_template: 'staging',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { serviceImpacts } = result.data;

      // Should identify both services as impacted
      expect(serviceImpacts.length).toBe(2);

      // Each service impact should have changes
      serviceImpacts.forEach((impact) => {
        expect(impact.serviceName).toBeDefined();
        expect(impact.changes.length).toBeGreaterThan(0);
        expect(impact.changes[0]).toContain('environment override');
      });
    }
  });

  it('should not show service impacts when services already have environment overrides', async () => {
    const store = new ArchitectureStore({ baseDir: testDir });

    // Create a service with existing environment override
    await store.createService('configured-service', {
      name: 'configured-service',
      deployment: { pattern: 'container' },
      environments: {
        staging: {
          deployment: { replicas: 3 },
        },
      },
    });

    const input: ScaffoldEnvironmentInput = {
      name: 'staging',
      base_template: 'staging',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { serviceImpacts } = result.data;

      // Service with existing override should not be in impacts
      const configuredImpact = serviceImpacts.find((i) => i.serviceName === 'configured-service');
      expect(configuredImpact).toBeUndefined();
    }
  });

  it('should include resource recommendations in service impacts', async () => {
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.createService('my-service', {
      name: 'my-service',
      deployment: { pattern: 'kubernetes' },
    });

    const input: ScaffoldEnvironmentInput = {
      name: 'production',
      base_template: 'prod',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { serviceImpacts } = result.data;

      expect(serviceImpacts.length).toBe(1);
      const impact = serviceImpacts[0];

      // Should recommend resource settings
      const hasResourceRecommendation = impact.changes.some((c) => c.includes('CPU') || c.includes('memory'));
      expect(hasResourceRecommendation).toBe(true);

      // Should recommend replica count
      const hasReplicaRecommendation = impact.changes.some((c) => c.includes('replica'));
      expect(hasReplicaRecommendation).toBe(true);
    }
  });

  it('should include DR recommendations for prod environment', async () => {
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.createService('critical-service', {
      name: 'critical-service',
      deployment: { pattern: 'kubernetes' },
    });

    const input: ScaffoldEnvironmentInput = {
      name: 'production',
      base_template: 'prod',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { serviceImpacts } = result.data;

      const impact = serviceImpacts[0];
      const hasDRRecommendation = impact.changes.some((c) => c.includes('disaster recovery'));
      expect(hasDRRecommendation).toBe(true);
    }
  });

  it('should reject duplicate environment names', async () => {
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.createEnvironment('existing-env', {
      name: 'existing-env',
      stage: 'dev',
    });

    const input: ScaffoldEnvironmentInput = {
      name: 'existing-env',
      base_template: 'dev',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.type).toBe('validation');
    }
  });

  it('should include scaling recommendations for staging and prod', async () => {
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.createService('scalable-service', {
      name: 'scalable-service',
      deployment: { pattern: 'ecs_fargate' },
    });

    const input: ScaffoldEnvironmentInput = {
      name: 'production',
      base_template: 'prod',
    };

    const result = await scaffoldEnvironment(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { serviceImpacts } = result.data;

      const impact = serviceImpacts[0];
      const hasScalingRecommendation = impact.changes.some((c) => c.includes('auto-scaling'));
      expect(hasScalingRecommendation).toBe(true);
    }
  });
});
