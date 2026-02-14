/**
 * Integration Tests: create_environment and update_environment MCP Tools
 *
 * User Story 2: Update Existing Architecture Entities (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given architecture directory,
 *    When AI calls create_environment,
 *    Then environment YAML is created.
 * 2. Given base_template specified,
 *    When AI calls create_environment,
 *    Then smart defaults are applied.
 * 3. Given duplicate environment name,
 *    When AI calls create_environment,
 *    Then MCP returns 409 error.
 * 4. Given existing environment,
 *    When AI calls update_environment,
 *    Then environment YAML is updated with deep-merge.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFile } from 'fs/promises';
import { parse } from 'yaml';
import {
  createEnvironment,
  formatMcpResult as formatCreateEnvironmentResult,
} from '../../../../src/server/tools/write/create-environment.js';
import {
  updateEnvironment,
  formatMcpResult as formatUpdateEnvironmentResult,
} from '../../../../src/server/tools/write/update-environment.js';

describe('Environment MCP Tools', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `environment-tools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'environments'), { recursive: true });

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
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('create_environment', () => {
    it('should create environment with minimal config', async () => {
      const result = await createEnvironment(
        {
          name: 'dev',
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.name).toBe('dev');
        expect(result.data.operation).toBe('create');
        expect(result.data.filePath).toContain('dev.yaml');
        expect(result.data.nextSteps).toBeDefined();
      }

      // Verify file was created
      const fileContent = await readFile(join(archDir, 'environments', 'dev.yaml'), 'utf-8');
      const parsed = parse(fileContent);
      expect(parsed.name).toBe('dev');
    });

    it('should create environment with full config', async () => {
      const result = await createEnvironment(
        {
          name: 'production',
          availability: {
            multi_az: true,
            multi_region: true,
            failover: true,
          },
          scaling: {
            min_replicas: 3,
            max_replicas: 10,
            auto_scaling: true,
          },
          security_level: 'strict',
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.name).toBe('production');
        expect(result.data.entity.availability?.multi_az).toBe(true);
        expect(result.data.entity.scaling?.min_replicas).toBe(3);
      }
    });

    it('should reject duplicate environment name', async () => {
      // Create first environment
      await createEnvironment({ name: 'staging' }, { baseDir: testDir });

      // Try to create duplicate
      const result = await createEnvironment({ name: 'staging' }, { baseDir: testDir });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.message).toContain('already exists');
      }
    });

    it('should format MCP result correctly', async () => {
      const response = await createEnvironment(
        {
          name: 'qa',
          availability: {
            multi_az: true,
          },
          scaling: {
            min_replicas: 2,
            max_replicas: 5,
          },
        },
        { baseDir: testDir }
      );

      const formatted = formatCreateEnvironmentResult(response);

      expect(formatted.content).toBeDefined();
      expect(formatted.content[0].type).toBe('text');
      expect(formatted.content[0].text).toContain('qa');
      expect(formatted.content[0].text).toContain('created successfully');
      expect(formatted.content[0].text).toContain('multi-AZ');
      expect(formatted.structuredContent.success).toBe(true);
    });
  });

  describe('update_environment', () => {
    beforeEach(async () => {
      // Create an environment to update
      await writeFile(
        join(archDir, 'environments', 'dev.yaml'),
        `
name: dev
availability:
  multi_az: false
  multi_region: false
scaling:
  min_replicas: 1
  max_replicas: 2
`,
        'utf-8'
      );
    });

    it('should update environment with deep-merge', async () => {
      const result = await updateEnvironment(
        {
          name: 'dev',
          updates: {
            availability: {
              multi_az: true,
            },
          },
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.availability?.multi_az).toBe(true);
        expect(result.data.operation).toBe('update');
        // Scaling should be preserved
        expect(result.data.entity.scaling?.min_replicas).toBe(1);
      }
    });

    it('should replace arrays entirely', async () => {
      // Add an environment with array fields
      await writeFile(
        join(archDir, 'environments', 'prod.yaml'),
        `
name: prod
availability:
  zones: ['us-east-1a', 'us-east-1b']
`,
        'utf-8'
      );

      const result = await updateEnvironment(
        {
          name: 'prod',
          updates: {
            availability: {
              zones: ['us-west-2a', 'us-west-2b', 'us-west-2c'],
            },
          },
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const zones = (result.data.entity.availability as any)?.zones;
        expect(zones).toHaveLength(3);
        expect(zones[0]).toBe('us-west-2a');
      }
    });

    it('should return 404 for non-existent environment', async () => {
      const result = await updateEnvironment(
        {
          name: 'non-existent',
          updates: {
            availability: {
              multi_az: true,
            },
          },
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.type).toBe('file');
        expect(result.error?.message).toContain('non-existent');
      }
    });

    it('should format MCP result correctly', async () => {
      const response = await updateEnvironment(
        {
          name: 'dev',
          updates: {
            scaling: {
              max_replicas: 5,
            },
          },
        },
        { baseDir: testDir }
      );

      const formatted = formatUpdateEnvironmentResult(response);

      expect(formatted.content).toBeDefined();
      expect(formatted.content[0].type).toBe('text');
      expect(formatted.content[0].text).toContain('dev');
      expect(formatted.content[0].text).toContain('updated successfully');
      expect(formatted.structuredContent.success).toBe(true);
    });
  });

  describe('environment workflow', () => {
    it('should support create → update workflow', async () => {
      // Create
      const createResult = await createEnvironment(
        {
          name: 'staging',
          scaling: {
            min_replicas: 1,
            max_replicas: 3,
          },
        },
        { baseDir: testDir }
      );

      expect(createResult.success).toBe(true);

      // Update
      const updateResult = await updateEnvironment(
        {
          name: 'staging',
          updates: {
            scaling: {
              min_replicas: 2,
              max_replicas: 5,
            },
            availability: {
              multi_az: true,
            },
          },
        },
        { baseDir: testDir }
      );

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.entity.scaling?.min_replicas).toBe(2);
        expect(updateResult.data.entity.scaling?.max_replicas).toBe(5);
        expect(updateResult.data.entity.availability?.multi_az).toBe(true);
      }
    });
  });
});
