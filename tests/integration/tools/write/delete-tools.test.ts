/**
 * Integration Tests: delete_service and delete_environment MCP Tools
 *
 * User Story 3: Delete Architecture Entities with Safety Checks (Priority: P2)
 *
 * Acceptance Scenarios:
 * 1. Given a service with no dependents,
 *    When AI calls delete_service,
 *    Then service YAML is deleted and success returned.
 * 2. Given a service with dependents and force=false,
 *    When AI calls delete_service,
 *    Then MCP returns 409 error with dependent list.
 * 3. Given a service with dependents and force=true,
 *    When AI calls delete_service,
 *    Then service is deleted with warnings about broken dependencies.
 * 4. Given a service does not exist,
 *    When AI calls delete_service,
 *    Then MCP returns 404 error.
 * 5. Given an environment with no service overrides,
 *    When AI calls delete_environment,
 *    Then environment YAML is deleted.
 * 6. Given an environment with service overrides,
 *    When AI calls delete_environment,
 *    Then environment is deleted with warnings about orphaned configs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { constants } from 'fs';
import {
  deleteService,
  formatMcpResult as formatDeleteServiceResult,
} from '../../../../src/server/tools/write/delete-service.js';
import {
  deleteEnvironment,
  formatMcpResult as formatDeleteEnvironmentResult,
} from '../../../../src/server/tools/write/delete-environment.js';

describe('delete_service MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `delete-service-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
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
defaults:
  runtime:
    language: typescript
    version: "20"
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Acceptance Scenario 1: Delete service with no dependents', () => {
    it('should delete service successfully', async () => {
      // Create a service with no dependents
      await writeFile(
        join(archDir, 'services', 'standalone-service.yaml'),
        `
name: standalone-service
type: api
deployment:
  pattern: kubernetes
`,
        'utf-8'
      );

      const result = await deleteService(
        { name: 'standalone-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.deleted).toBe('standalone-service');
      expect(result.data?.entityType).toBe('service');
      expect(result.data?.filePath).toContain('standalone-service.yaml');
      expect(result.data?.warnings).toHaveLength(0);
      expect(result.data?.forced).toBe(false);

      // Verify file was deleted
      await expect(
        access(join(archDir, 'services', 'standalone-service.yaml'), constants.F_OK)
      ).rejects.toThrow();
    });
  });

  describe('Acceptance Scenario 2: Deletion blocked when has dependents', () => {
    it('should return 409 error when service has dependents and force=false', async () => {
      // Create service A
      await writeFile(
        join(archDir, 'services', 'service-a.yaml'),
        `
name: service-a
type: api
deployment:
  pattern: kubernetes
`,
        'utf-8'
      );

      // Create service B that depends on A
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

      const result = await deleteService({ name: 'service-a' }, { baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.message).toContain('depend on it');
      expect(result.error?.message).toContain('service-b');
      expect(result.error?.message).toContain('force=true');

      // Verify file was NOT deleted
      await expect(
        access(join(archDir, 'services', 'service-a.yaml'), constants.F_OK)
      ).resolves.toBeUndefined();
    });

    it('should list all dependents in error message', async () => {
      // Create service A
      await writeFile(
        join(archDir, 'services', 'service-a.yaml'),
        `
name: service-a
type: api
deployment:
  pattern: kubernetes
`,
        'utf-8'
      );

      // Create multiple services that depend on A
      await writeFile(
        join(archDir, 'services', 'service-b.yaml'),
        `
name: service-b
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: service-a
`,
        'utf-8'
      );

      await writeFile(
        join(archDir, 'services', 'service-c.yaml'),
        `
name: service-c
type: worker
deployment:
  pattern: lambda
dependencies:
  - name: service-a
    type: async
`,
        'utf-8'
      );

      const result = await deleteService({ name: 'service-a' }, { baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('service-b');
      expect(result.error?.message).toContain('service-c');
    });
  });

  describe('Acceptance Scenario 3: Force delete with warnings', () => {
    it('should delete service with force=true and return warnings', async () => {
      // Create service A
      await writeFile(
        join(archDir, 'services', 'service-a.yaml'),
        `
name: service-a
type: api
deployment:
  pattern: kubernetes
`,
        'utf-8'
      );

      // Create service B that depends on A
      await writeFile(
        join(archDir, 'services', 'service-b.yaml'),
        `
name: service-b
type: api
deployment:
  pattern: kubernetes
dependencies:
  - name: service-a
`,
        'utf-8'
      );

      const result = await deleteService(
        { name: 'service-a', force: true },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.deleted).toBe('service-a');
      expect(result.data?.forced).toBe(true);
      expect(result.data?.warnings.length).toBeGreaterThan(0);
      expect(result.data?.warnings.some((w) => w.includes('service-b'))).toBe(true);
      expect(result.data?.warnings.some((w) => w.includes('broken dependencies'))).toBe(true);

      // Verify file was deleted
      await expect(
        access(join(archDir, 'services', 'service-a.yaml'), constants.F_OK)
      ).rejects.toThrow();
    });
  });

  describe('Acceptance Scenario 4: Not found error', () => {
    it('should return 404 error when service does not exist', async () => {
      const result = await deleteService(
        { name: 'nonexistent-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('MCP result formatting', () => {
    it('should format successful deletion for MCP', async () => {
      await writeFile(
        join(archDir, 'services', 'format-test.yaml'),
        `
name: format-test
type: api
deployment:
  pattern: kubernetes
`,
        'utf-8'
      );

      const toolResult = await deleteService({ name: 'format-test' }, { baseDir: testDir });
      const mcpResult = formatDeleteServiceResult(toolResult);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('deleted successfully');
      expect(mcpResult.content[0].text).toContain('format-test');
      expect(mcpResult.structuredContent.success).toBe(true);
      expect(mcpResult.isError).toBeUndefined();
    });

    it('should format forced deletion with warnings for MCP', async () => {
      await writeFile(
        join(archDir, 'services', 'service-x.yaml'),
        `
name: service-x
type: api
deployment:
  pattern: kubernetes
`,
        'utf-8'
      );

      await writeFile(
        join(archDir, 'services', 'service-y.yaml'),
        `
name: service-y
type: api
dependencies:
  - name: service-x
deployment:
  pattern: kubernetes
`,
        'utf-8'
      );

      const toolResult = await deleteService(
        { name: 'service-x', force: true },
        { baseDir: testDir }
      );
      const mcpResult = formatDeleteServiceResult(toolResult);

      expect(mcpResult.content[0].text).toContain('Forced deletion');
      expect(mcpResult.content[0].text).toContain('Warnings');
      expect(mcpResult.content[0].text).toContain('service-y');
    });

    it('should format error result for MCP', async () => {
      const toolResult = await deleteService(
        { name: 'missing-service' },
        { baseDir: testDir }
      );
      const mcpResult = formatDeleteServiceResult(toolResult);

      expect(mcpResult.content[0].text).toContain('Error');
      expect(mcpResult.structuredContent.success).toBe(false);
      expect(mcpResult.isError).toBe(true);
    });
  });
});

describe('delete_environment MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `delete-env-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Acceptance Scenario 5: Delete environment with no overrides', () => {
    it('should delete environment successfully', async () => {
      // Create an environment
      await writeFile(
        join(archDir, 'environments', 'dev.yaml'),
        `
name: dev
availability:
  sla: 99.0
scaling:
  minInstances: 1
  maxInstances: 3
`,
        'utf-8'
      );

      const result = await deleteEnvironment({ name: 'dev' }, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.deleted).toBe('dev');
      expect(result.data?.entityType).toBe('environment');
      expect(result.data?.filePath).toContain('dev.yaml');
      expect(result.data?.warnings).toHaveLength(0);
      expect(result.data?.forced).toBe(false);

      // Verify file was deleted
      await expect(
        access(join(archDir, 'environments', 'dev.yaml'), constants.F_OK)
      ).rejects.toThrow();
    });
  });

  describe('Acceptance Scenario 6: Delete environment with orphaned overrides', () => {
    it('should delete environment and return orphaned config warnings', async () => {
      // Create an environment
      await writeFile(
        join(archDir, 'environments', 'staging.yaml'),
        `
name: staging
availability:
  sla: 99.9
`,
        'utf-8'
      );

      // Create a service with environment-specific overrides
      await writeFile(
        join(archDir, 'services', 'api-service.yaml'),
        `
name: api-service
type: api
deployment:
  pattern: kubernetes
environments:
  staging:
    scaling:
      minInstances: 2
      maxInstances: 10
`,
        'utf-8'
      );

      const result = await deleteEnvironment({ name: 'staging' }, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.deleted).toBe('staging');
      expect(result.data?.warnings.length).toBeGreaterThan(0);
      expect(result.data?.warnings.some((w) => w.includes('api-service'))).toBe(true);
      expect(result.data?.warnings.some((w) => w.includes('orphaned'))).toBe(true);

      // Verify file was deleted
      await expect(
        access(join(archDir, 'environments', 'staging.yaml'), constants.F_OK)
      ).rejects.toThrow();
    });

    it('should list all services with orphaned configs', async () => {
      await writeFile(
        join(archDir, 'environments', 'prod.yaml'),
        `
name: prod
availability:
  sla: 99.99
`,
        'utf-8'
      );

      // Create multiple services with prod overrides
      await writeFile(
        join(archDir, 'services', 'service-1.yaml'),
        `
name: service-1
type: api
deployment:
  pattern: kubernetes
environments:
  prod:
    scaling:
      minInstances: 5
`,
        'utf-8'
      );

      await writeFile(
        join(archDir, 'services', 'service-2.yaml'),
        `
name: service-2
type: worker
deployment:
  pattern: lambda
environments:
  prod:
    runtime:
      memory: 2048
`,
        'utf-8'
      );

      const result = await deleteEnvironment({ name: 'prod' }, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.warnings.some((w) => w.includes('service-1'))).toBe(true);
      expect(result.data?.warnings.some((w) => w.includes('service-2'))).toBe(true);
    });
  });

  describe('Not found error', () => {
    it('should return 404 error when environment does not exist', async () => {
      const result = await deleteEnvironment(
        { name: 'nonexistent-env' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('MCP result formatting', () => {
    it('should format successful deletion for MCP', async () => {
      await writeFile(
        join(archDir, 'environments', 'test-env.yaml'),
        `
name: test-env
availability:
  sla: 99.0
`,
        'utf-8'
      );

      const toolResult = await deleteEnvironment({ name: 'test-env' }, { baseDir: testDir });
      const mcpResult = formatDeleteEnvironmentResult(toolResult);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('deleted successfully');
      expect(mcpResult.content[0].text).toContain('test-env');
      expect(mcpResult.structuredContent.success).toBe(true);
    });

    it('should format deletion with warnings for MCP', async () => {
      await writeFile(
        join(archDir, 'environments', 'qa.yaml'),
        `
name: qa
availability:
  sla: 99.0
`,
        'utf-8'
      );

      await writeFile(
        join(archDir, 'services', 'test-service.yaml'),
        `
name: test-service
type: api
deployment:
  pattern: kubernetes
environments:
  qa:
    scaling:
      minInstances: 1
`,
        'utf-8'
      );

      const toolResult = await deleteEnvironment({ name: 'qa' }, { baseDir: testDir });
      const mcpResult = formatDeleteEnvironmentResult(toolResult);

      expect(mcpResult.content[0].text).toContain('Warnings');
      expect(mcpResult.content[0].text).toContain('test-service');
      expect(mcpResult.content[0].text).toContain('orphaned');
    });
  });
});
