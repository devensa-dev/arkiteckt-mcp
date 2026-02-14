/**
 * Integration tests for scaffold_service tool
 *
 * Tests scaffolding of complete service workflows with pattern-specific steps
 * and environment-specific notes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scaffoldService } from '../../../../src/server/tools/scaffold/scaffold-service.js';
import type { ScaffoldServiceInput } from '../../../../src/server/tools/scaffold/scaffold-service.js';
import { ArchitectureStore } from '../../../../src/core/store/architecture-store.js';

describe('scaffold_service integration tests', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'arch-test-'));
  });

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should scaffold a container service with Dockerfile steps', async () => {
    const input: ScaffoldServiceInput = {
      name: 'my-container-service',
      type: 'api',
      deployment_pattern: 'container',
      description: 'Test container service',
    };

    const result = await scaffoldService(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { service, workflow, checklist } = result.data;

      // Service was created with template defaults
      expect(service.name).toBe('my-container-service');
      expect(service.deployment?.pattern).toBe('container');
      expect(service.container).toBeDefined();
      expect(service.container?.port).toBe(8080);
      expect(service.container?.healthCheck).toBeDefined();

      // Workflow contains ordered steps
      expect(workflow.length).toBeGreaterThan(0);
      expect(workflow[0].stepNumber).toBe(1);
      expect(workflow[0].category).toBe('code');

      // Infrastructure step includes container-specific artifacts
      const infraStep = workflow.find((s) => s.category === 'infrastructure');
      expect(infraStep).toBeDefined();
      expect(infraStep?.patternSpecific).toBe(true);

      // Checklist is flat and human-readable
      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist[0]).toContain('[code]');
    }
  });

  it('should scaffold a Lambda service with serverless-specific steps', async () => {
    const input: ScaffoldServiceInput = {
      name: 'my-lambda-service',
      type: 'worker',
      deployment_pattern: 'lambda',
    };

    const result = await scaffoldService(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { service, workflow } = result.data;

      // Lambda-specific defaults applied
      expect(service.deployment?.pattern).toBe('lambda');
      expect(service.runtime?.language).toBe('nodejs');
      expect(service.runtime?.entrypoint).toBe('index.handler');
      expect(service.resilience?.timeout).toBe(30000);

      // Infrastructure step should NOT include Docker artifacts
      const infraStep = workflow.find((s) => s.category === 'infrastructure');
      if (infraStep) {
        const dockerArtifacts = infraStep.artifacts.filter((a) => a.type === 'dockerfile');
        expect(dockerArtifacts.length).toBe(0);
      }
    }
  });

  it('should scaffold a Kubernetes service with k8s manifests', async () => {
    const input: ScaffoldServiceInput = {
      name: 'my-k8s-service',
      type: 'backend',
      deployment_pattern: 'kubernetes',
      dependencies: [
        {
          name: 'database',
          type: 'sync',
          protocol: 'postgres',
        },
      ],
    };

    const result = await scaffoldService(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { service, workflow } = result.data;

      // Kubernetes-specific defaults applied
      expect(service.deployment?.pattern).toBe('kubernetes');
      expect(service.deployment?.replicas).toBe(3);
      expect(service.deployment?.autoScaling?.enabled).toBe(true);
      expect(service.dependencies).toBeDefined();
      expect(service.dependencies?.length).toBe(1);

      // SLO targets should be strict for k8s
      expect(service.observability?.slo?.availability).toBe(99.99);

      // Workflow should be ordered by category
      const categories = workflow.map((s) => s.category);
      const codeIndex = categories.indexOf('code');
      const infraIndex = categories.indexOf('infrastructure');
      expect(codeIndex).toBeGreaterThanOrEqual(0);
      expect(infraIndex).toBeGreaterThan(codeIndex);
    }
  });

  it('should include environment-specific notes when environments exist', async () => {
    // Create environments first
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.createEnvironment('dev', {
      name: 'dev',
      stage: 'dev',
      availability: { replicas: 1, multiAZ: false },
    });
    await store.createEnvironment('prod', {
      name: 'prod',
      stage: 'prod',
      availability: { replicas: 3, multiAZ: true },
    });

    const input: ScaffoldServiceInput = {
      name: 'my-service',
      type: 'api',
      deployment_pattern: 'container',
    };

    const result = await scaffoldService(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { workflow } = result.data;

      // Steps should have environment-specific notes
      const codeStep = workflow.find((s) => s.category === 'code');
      expect(codeStep?.environmentNotes).toBeDefined();
      expect(Object.keys(codeStep?.environmentNotes || {}).length).toBeGreaterThan(0);
    }
  });

  it('should reject invalid service names', async () => {
    const input: ScaffoldServiceInput = {
      name: '',
      type: 'api',
      deployment_pattern: 'container',
    };

    const result = await scaffoldService(input, { baseDir: testDir });

    expect(result.success).toBe(false);
  });

  it('should reject duplicate service names', async () => {
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.createService('existing-service', {
      name: 'existing-service',
      deployment: { pattern: 'container' },
    });

    const input: ScaffoldServiceInput = {
      name: 'existing-service',
      type: 'api',
      deployment_pattern: 'container',
    };

    const result = await scaffoldService(input, { baseDir: testDir });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.type).toBe('validation');
    }
  });

  it('should include CI/CD step when CICD config exists', async () => {
    // Create CICD config
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.setCICD({
      provider: 'github-actions',
      steps: [{ name: 'build', type: 'build', required: true }],
    });

    const input: ScaffoldServiceInput = {
      name: 'my-service',
      type: 'api',
      deployment_pattern: 'container',
    };

    const result = await scaffoldService(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { workflow } = result.data;

      // Should include CI/CD configuration step
      const cicdSteps = workflow.filter((s) => s.title.toLowerCase().includes('ci/cd'));
      expect(cicdSteps.length).toBeGreaterThan(0);
    }
  });

  it('should include observability step when observability config exists', async () => {
    // Create observability config
    const store = new ArchitectureStore({ baseDir: testDir });
    await store.setObservability({
      logging: {
        enabled: true,
        level: 'info',
        format: 'json',
        destinations: [],
      },
    });

    const input: ScaffoldServiceInput = {
      name: 'my-service',
      type: 'api',
      deployment_pattern: 'container',
    };

    const result = await scaffoldService(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { workflow } = result.data;

      // Should include observability setup step
      const obsSteps = workflow.filter((s) => s.category === 'observability');
      expect(obsSteps.length).toBeGreaterThan(0);
    }
  });
});
