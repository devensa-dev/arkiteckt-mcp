/**
 * Integration Tests: update_system MCP Tool
 *
 * User Story 2: Update Existing Architecture Entities (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given existing system config,
 *    When AI calls update_system with defaults changes,
 *    Then system.yaml is updated and affected services are identified.
 * 2. Given services inheriting runtime defaults,
 *    When AI calls update_system changing runtime defaults,
 *    Then impact analysis shows which services are affected.
 * 3. Given invalid system configuration,
 *    When AI calls update_system,
 *    Then MCP returns 400 validation error.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFile } from 'fs/promises';
import { parse } from 'yaml';
import {
  updateSystem,
  formatMcpResult as formatUpdateSystemResult,
} from '../../../../src/server/tools/write/update-system.js';

describe('update_system MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `update-system-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'services'), { recursive: true });

    // Create system.yaml
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
    version: "18"
    framework: express
`,
      'utf-8'
    );

    // Create services that inherit defaults
    await writeFile(
      join(archDir, 'services', 'api-service.yaml'),
      `
name: api-service
type: api
deployment:
  pattern: container
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'services', 'worker-service.yaml'),
      `
name: worker-service
type: worker
deployment:
  pattern: container
`,
      'utf-8'
    );

    // Create a service with explicit runtime (won't be affected)
    await writeFile(
      join(archDir, 'services', 'legacy-service.yaml'),
      `
name: legacy-service
type: api
deployment:
  pattern: container
runtime:
  language: python
  version: "3.11"
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should update system defaults and identify affected services', async () => {
    const result = await updateSystem(
      {
        updates: {
          defaults: {
            runtime: {
              language: 'typescript',
              version: '20',
            },
          },
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity.defaults?.runtime?.version).toBe('20');
      expect(result.data.operation).toBe('update');

      // Should have impact analysis
      expect(result.data.impact).toBeDefined();
      expect(result.data.impact?.affectedServices).toBeDefined();

      // Services without explicit runtime should be affected
      const affectedServices = result.data.impact?.affectedServices || [];
      expect(affectedServices.length).toBeGreaterThan(0);

      // Check that api-service and worker-service are affected
      const affectedNames = affectedServices.map((s) => s.name);
      expect(affectedNames).toContain('api-service');
      expect(affectedNames).toContain('worker-service');

      // legacy-service should NOT be affected (has explicit runtime)
      expect(affectedNames).not.toContain('legacy-service');

      // Check field changes
      const apiService = affectedServices.find((s) => s.name === 'api-service');
      expect(apiService?.fields).toBeDefined();
      expect(apiService?.fields.some((f) => f.path === 'runtime.version')).toBe(true);
    }
  });

  it('should update system architecture configuration', async () => {
    const result = await updateSystem(
      {
        updates: {
          architecture: {
            cloud: 'gcp',
            region: 'us-central1',
          },
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity.architecture?.cloud).toBe('gcp');
      expect(result.data.entity.architecture?.region).toBe('us-central1');
      // Style should be preserved
      expect(result.data.entity.architecture?.style).toBe('microservices');
    }
  });

  it('should handle updates with no affected services', async () => {
    const result = await updateSystem(
      {
        updates: {
          description: 'Updated system description',
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity.description).toBe('Updated system description');
      // No services should be affected by description change
      const affectedServices = result.data.impact?.affectedServices || [];
      expect(affectedServices.length).toBe(0);
    }
  });

  it('should format MCP result correctly for successful update', async () => {
    const response = await updateSystem(
      {
        updates: {
          defaults: {
            runtime: {
              version: '20',
            },
          },
        },
      },
      { baseDir: testDir }
    );

    const formatted = formatUpdateSystemResult(response);

    expect(formatted.content).toBeDefined();
    expect(formatted.content[0].type).toBe('text');
    expect(formatted.content[0].text).toContain('System configuration updated successfully');
    expect(formatted.content[0].text).toContain('test-system');
    expect(formatted.structuredContent.success).toBe(true);
  });

  it('should format impact analysis in MCP result', async () => {
    const response = await updateSystem(
      {
        updates: {
          defaults: {
            runtime: {
              language: 'typescript',
              version: '20',
            },
          },
        },
      },
      { baseDir: testDir }
    );

    const formatted = formatUpdateSystemResult(response);

    expect(formatted.content[0].text).toContain('affected by defaults changes');
    expect(formatted.content[0].text).toContain('api-service');
    expect(formatted.content[0].text).toContain('runtime.version');
  });

  it('should preserve system name when updating', async () => {
    const result = await updateSystem(
      {
        updates: {
          description: 'New description',
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity.name).toBe('test-system');
    }
  });
});
