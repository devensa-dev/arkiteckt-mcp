/**
 * Integration Tests: get_service_context MCP Tool
 *
 * User Story 2: AI Queries Service Context (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given a service `order-service` defined in `services/order.yaml`,
 *    When AI calls `get_service_context("order-service", "prod")`,
 *    Then MCP returns the service config (with prod environment overrides when Phase 5 is complete).
 * 2. Given a service with environment-specific database config,
 *    When AI queries for `dev` vs `prod`,
 *    Then the returned database configuration differs (when Phase 5 is complete).
 * 3. Given a non-existent service name,
 *    When AI calls `get_service_context`,
 *    Then MCP returns a clear error message.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getServiceContext,
  formatMcpResult,
} from '../../../src/server/tools/read/get-service-context.js';

describe('get_service_context MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `get-service-context-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'environments'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    await writeFile(filePath, content, 'utf-8');
  }

  describe('Acceptance Scenario 1: Successful service retrieval', () => {
    it('should return service configuration when service exists', async () => {
      await writeYaml(
        'services/order-service.yaml',
        `
name: order-service
type: backend
description: Handles order processing
deployment:
  pattern: ecs_fargate
  replicas: 3
dependencies:
  - name: user-service
    type: sync
  - name: payment-service
    type: async
runtime:
  language: nodejs
  version: "20"
  framework: express
`
      );

      const result = await getServiceContext(
        { service_name: 'order-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('order-service');
      expect(result.data?.type).toBe('backend');
      expect(result.data?.deployment.pattern).toBe('ecs_fargate');
      expect(result.data?.dependencies).toHaveLength(2);
    });

    it('should include response metadata with sources', async () => {
      await writeYaml(
        'services/user-service.yaml',
        `
name: user-service
type: api
deployment:
  pattern: lambda
`
      );

      const result = await getServiceContext(
        { service_name: 'user-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.resolvedAt).toBeDefined();
      expect(result.metadata?.sources).toContain('architecture/services/user-service.yaml');
    });

    it('should accept environment parameter and include in sources', async () => {
      await writeYaml(
        'services/api-service.yaml',
        `
name: api-service
type: api
deployment:
  pattern: ecs_fargate
`
      );

      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
description: Production environment
availability:
  replicas: 3
`
      );

      const result = await getServiceContext(
        { service_name: 'api-service', environment: 'prod' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.sources).toContain('architecture/services/api-service.yaml');
      expect(result.metadata?.sources).toContain('architecture/environments/prod.yaml');
    });

    it('should support cloud-agnostic custom fields in service config', async () => {
      await writeYaml(
        'services/payment-service.yaml',
        `
name: payment-service
type: backend
deployment:
  pattern: kubernetes
  # Custom Kubernetes-specific fields
  namespace: payments
  helmChart: payment-service
  autoscaling:
    minReplicas: 2
    maxReplicas: 10
    targetCPU: 70
# Custom observability fields
customMetrics:
  - name: payment_success_rate
    threshold: 0.95
`
      );

      const result = await getServiceContext(
        { service_name: 'payment-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.deployment.pattern).toBe('kubernetes');
      // Extensible schema allows custom fields
      expect((result.data?.deployment as Record<string, unknown>).namespace).toBe('payments');
    });
  });

  describe('Acceptance Scenario 2: Environment-aware queries', () => {
    it('should track environment in metadata when provided', async () => {
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
        'environments/dev.yaml',
        `
name: dev
description: Development environment
availability:
  replicas: 1
`
      );

      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
description: Production environment
availability:
  replicas: 3
`
      );

      const resultDev = await getServiceContext(
        { service_name: 'db-service', environment: 'dev' },
        { baseDir: testDir }
      );

      // Debug: log the result if it fails
      if (!resultDev.success) {
        console.error('resultDev failed:', resultDev.error);
      }

      expect(resultDev.success).toBe(true);
      expect(resultDev.metadata?.sources).toContain('architecture/services/db-service.yaml');
      expect(resultDev.metadata?.sources).toContain('architecture/environments/dev.yaml');

      const resultProd = await getServiceContext(
        { service_name: 'db-service', environment: 'prod' },
        { baseDir: testDir }
      );

      expect(resultProd.success).toBe(true);
      expect(resultProd.metadata?.sources).toContain('architecture/services/db-service.yaml');
      expect(resultProd.metadata?.sources).toContain('architecture/environments/prod.yaml');
    });

    // NOTE: Full environment resolution tests will be added in Phase 5
    // when Resolution Engine is implemented. Currently the tool returns
    // raw service config regardless of environment parameter.
  });

  describe('Acceptance Scenario 3: Error handling for missing service', () => {
    it('should return error with available services list when service not found', async () => {
      await writeYaml(
        'services/existing-service.yaml',
        `
name: existing-service
type: backend
deployment:
  pattern: lambda
`
      );

      const result = await getServiceContext(
        { service_name: 'nonexistent-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('file');
      expect(result.error?.message).toContain('nonexistent-service');
      expect(result.error?.message).toContain('Available services');
      expect(result.error?.message).toContain('existing-service');
    });

    it('should return clear error when no services exist', async () => {
      const result = await getServiceContext(
        { service_name: 'any-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Available services: none');
    });

    it('should return validation error for invalid service config', async () => {
      await writeYaml(
        'services/invalid-service.yaml',
        `
name: 12345
type: not-a-valid-type
deployment: "not an object"
`
      );

      const result = await getServiceContext(
        { service_name: 'invalid-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });

    it('should return validation error for missing required fields', async () => {
      await writeYaml(
        'services/incomplete-service.yaml',
        `
description: Missing name and deployment
`
      );

      const result = await getServiceContext(
        { service_name: 'incomplete-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });
  });

  describe('MCP result formatting', () => {
    it('should format successful result for MCP', async () => {
      await writeYaml(
        'services/format-test.yaml',
        `
name: format-test
type: api
deployment:
  pattern: lambda
`
      );

      const result = await getServiceContext(
        { service_name: 'format-test' },
        { baseDir: testDir }
      );
      const mcpResult = formatMcpResult(result);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('format-test');
      expect(mcpResult.structuredContent).toBeDefined();
      expect(mcpResult.structuredContent.success).toBe(true);
      expect(mcpResult.isError).toBeUndefined();
    });

    it('should format error result for MCP', async () => {
      const result = await getServiceContext(
        { service_name: 'nonexistent' },
        { baseDir: testDir }
      );
      const mcpResult = formatMcpResult(result);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('Error');
      expect(mcpResult.structuredContent.success).toBe(false);
      expect(mcpResult.isError).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should respond in less than 100ms', async () => {
      await writeYaml(
        'services/perf-test.yaml',
        `
name: perf-test
type: backend
deployment:
  pattern: ecs_fargate
`
      );

      const start = performance.now();
      await getServiceContext({ service_name: 'perf-test' }, { baseDir: testDir });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Multiple services', () => {
    it('should handle multiple services correctly', async () => {
      await writeYaml(
        'services/service-a.yaml',
        `
name: service-a
type: backend
deployment:
  pattern: lambda
`
      );
      await writeYaml(
        'services/service-b.yaml',
        `
name: service-b
type: api
deployment:
  pattern: ecs_fargate
`
      );
      await writeYaml(
        'services/service-c.yaml',
        `
name: service-c
type: worker
deployment:
  pattern: kubernetes
`
      );

      const resultA = await getServiceContext({ service_name: 'service-a' }, { baseDir: testDir });
      const resultB = await getServiceContext({ service_name: 'service-b' }, { baseDir: testDir });
      const resultC = await getServiceContext({ service_name: 'service-c' }, { baseDir: testDir });

      expect(resultA.success).toBe(true);
      expect(resultA.data?.name).toBe('service-a');
      expect(resultB.success).toBe(true);
      expect(resultB.data?.name).toBe('service-b');
      expect(resultC.success).toBe(true);
      expect(resultC.data?.name).toBe('service-c');
    });
  });
});
