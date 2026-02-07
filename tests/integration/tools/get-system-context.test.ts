/**
 * Integration Tests: get_system_context MCP Tool
 *
 * User Story 1: AI Queries System Context (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given a configured architecture repository with system.yaml,
 *    When AI calls get_system_context,
 *    Then MCP returns system name, cloud provider, architecture style, and default runtime.
 * 2. Given no system.yaml exists,
 *    When AI calls get_system_context,
 *    Then MCP returns an error with guidance on how to initialize the architecture.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getSystemContext,
  formatMcpResult,
} from '../../../src/server/tools/read/get-system-context.js';

describe('get_system_context MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `get-system-context-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(archDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    await writeFile(filePath, content, 'utf-8');
  }

  describe('Acceptance Scenario 1: Successful system context retrieval', () => {
    it('should return system configuration when system.yaml exists', async () => {
      await writeYaml(
        'system.yaml',
        `
name: my-platform
description: Enterprise microservices platform
architecture:
  style: microservices
  cloud: aws
  region: us-east-1
defaults:
  runtime:
    language: typescript
    version: "20"
    framework: express
team:
  name: platform-team
  email: platform@example.com
`
      );

      const result = await getSystemContext({ baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('my-platform');
      expect(result.data?.description).toBe('Enterprise microservices platform');
      expect(result.data?.architecture.style).toBe('microservices');
      expect(result.data?.architecture.cloud).toBe('aws');
      expect(result.data?.architecture.region).toBe('us-east-1');
      expect(result.data?.defaults?.runtime?.language).toBe('typescript');
      expect(result.data?.team?.name).toBe('platform-team');
    });

    it('should include response metadata', async () => {
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: modular-monolith
`
      );

      const result = await getSystemContext({ baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.resolvedAt).toBeDefined();
      expect(result.metadata?.sources).toContain('architecture/system.yaml');
    });

    it('should support cloud-agnostic custom fields', async () => {
      await writeYaml(
        'system.yaml',
        `
name: cloud-agnostic-platform
architecture:
  style: event-driven
  cloud: gcp
  region: us-central1
  # Custom GCP-specific fields
  projectId: my-gcp-project
  serviceAccount: sa@project.iam.gserviceaccount.com
defaults:
  # Custom organization fields
  costCenter: CC-1234
  businessUnit: Engineering
`
      );

      const result = await getSystemContext({ baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.architecture.cloud).toBe('gcp');
      // Extensible schema allows custom fields
      expect((result.data?.architecture as Record<string, unknown>).projectId).toBe(
        'my-gcp-project'
      );
    });
  });

  describe('Acceptance Scenario 2: Error handling for missing system.yaml', () => {
    it('should return error with initialization guidance when system.yaml missing', async () => {
      const result = await getSystemContext({ baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('file');
      expect(result.error?.message).toContain('not found');
      expect(result.error?.message).toContain('arch init');
    });

    it('should include metadata even on error', async () => {
      const result = await getSystemContext({ baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.resolvedAt).toBeDefined();
    });
  });

  describe('Validation error handling', () => {
    it('should return validation error for invalid system.yaml', async () => {
      await writeYaml(
        'system.yaml',
        `
name: 12345
architecture: "not an object"
`
      );

      const result = await getSystemContext({ baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });

    it('should return validation error for missing required fields', async () => {
      await writeYaml(
        'system.yaml',
        `
description: Missing name and architecture
`
      );

      const result = await getSystemContext({ baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });

    it('should return validation error for invalid architecture style', async () => {
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: invalid-style
`
      );

      const result = await getSystemContext({ baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });
  });

  describe('MCP result formatting', () => {
    it('should format successful result for MCP', async () => {
      await writeYaml(
        'system.yaml',
        `
name: test-system
architecture:
  style: microservices
`
      );

      const result = await getSystemContext({ baseDir: testDir });
      const mcpResult = formatMcpResult(result);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('test-system');
      expect(mcpResult.structuredContent).toBeDefined();
      expect(mcpResult.structuredContent.success).toBe(true);
      expect(mcpResult.isError).toBeUndefined();
    });

    it('should format error result for MCP', async () => {
      const result = await getSystemContext({ baseDir: testDir });
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
        'system.yaml',
        `
name: performance-test
architecture:
  style: serverless
  cloud: aws
`
      );

      const start = performance.now();
      await getSystemContext({ baseDir: testDir });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
