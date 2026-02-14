/**
 * Integration Tests: update_service MCP Tool
 *
 * User Story 2: Update Existing Architecture Entities (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given existing service,
 *    When AI calls update_service with partial updates,
 *    Then service YAML is deep-merged preserving existing fields.
 * 2. Given service with array fields,
 *    When AI calls update_service with array updates,
 *    Then arrays replace entirely (not append).
 * 3. Given service deployment pattern change,
 *    When AI calls update_service with new pattern,
 *    Then artifact delta is returned showing added/removed artifacts.
 * 4. Given circular dependency in updates,
 *    When AI calls update_service,
 *    Then MCP returns 400 error (cycle detected).
 * 5. Given non-existent service,
 *    When AI calls update_service,
 *    Then MCP returns 404 error.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFile } from 'fs/promises';
import { parse } from 'yaml';
import {
  updateService,
  formatMcpResult as formatUpdateServiceResult,
} from '../../../../src/server/tools/write/update-service.js';

describe('update_service MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `update-service-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'capabilities'), { recursive: true });

    // Create minimal system.yaml for defaults
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

    // Create a service to update
    await writeFile(
      join(archDir, 'services', 'api-service.yaml'),
      `
name: api-service
type: api
deployment:
  pattern: container
description: Original description
dependencies:
  - name: user-service
    type: sync
owner: team-a
`,
      'utf-8'
    );

    // Create capability for pattern change testing
    await writeFile(
      join(archDir, 'capabilities', 'services.yaml'),
      `
name: Service Capabilities
capabilities:
  - id: create_service
    name: Create Service
    category: development
    patternArtifacts:
      - pattern: container
        artifacts:
          - type: infrastructure
            name: Dockerfile
            required: true
      - pattern: kubernetes
        artifacts:
          - type: infrastructure
            name: K8s manifests
            required: true
          - type: infrastructure
            name: Helm chart
            required: false
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should deep-merge updates preserving existing fields', async () => {
    const result = await updateService(
      {
        name: 'api-service',
        updates: {
          description: 'Updated description',
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity.description).toBe('Updated description');
      expect(result.data.entity.owner).toBe('team-a'); // Preserved
      expect(result.data.entity.type).toBe('api'); // Preserved
      expect(result.data.operation).toBe('update');
    }
  });

  it('should replace arrays entirely (not append)', async () => {
    const result = await updateService(
      {
        name: 'api-service',
        updates: {
          dependencies: [
            { name: 'auth-service', type: 'sync' },
            { name: 'data-service', type: 'async' },
          ],
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity.dependencies).toHaveLength(2);
      expect(result.data.entity.dependencies?.[0].name).toBe('auth-service');
      expect(result.data.entity.dependencies?.[1].name).toBe('data-service');
      // Original user-service should be replaced, not appended
      expect(result.data.entity.dependencies?.find((d) => d.name === 'user-service')).toBeUndefined();
    }
  });

  it('should return artifact delta when deployment pattern changes', async () => {
    const result = await updateService(
      {
        name: 'api-service',
        updates: {
          deployment: {
            pattern: 'kubernetes',
          },
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity.deployment?.pattern).toBe('kubernetes');
      expect(result.data.impact).toBeDefined();
      expect(result.data.impact?.artifactsDelta).toBeDefined();
      expect(result.data.impact?.artifactsDelta?.added).toBeDefined();
      expect(result.data.impact?.artifactsDelta?.removed).toBeDefined();

      // Should have K8s artifacts added
      const added = result.data.impact?.artifactsDelta?.added || [];
      expect(added.length).toBeGreaterThan(0);
      expect(added.some((a) => a.name.includes('K8s') || a.name.includes('Helm'))).toBe(true);
    }
  });

  it('should reject circular dependencies', async () => {
    // Create user-service that depends on api-service (circular)
    await writeFile(
      join(archDir, 'services', 'user-service.yaml'),
      `
name: user-service
type: api
deployment:
  pattern: container
dependencies:
  - name: api-service
    type: sync
`,
      'utf-8'
    );

    // Try to update api-service to depend on user-service (creates cycle)
    const result = await updateService(
      {
        name: 'api-service',
        updates: {
          dependencies: [
            { name: 'user-service', type: 'sync' },
          ],
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.message).toContain('cycle');
    }
  });

  it('should return 404 for non-existent service', async () => {
    const result = await updateService(
      {
        name: 'non-existent-service',
        updates: {
          description: 'Updated',
        },
      },
      { baseDir: testDir }
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.type).toBe('file');
      expect(result.error?.message).toContain('non-existent-service');
    }
  });

  it('should format MCP result correctly for successful update', async () => {
    const response = await updateService(
      {
        name: 'api-service',
        updates: {
          description: 'Updated via MCP',
        },
      },
      { baseDir: testDir }
    );

    const formatted = formatUpdateServiceResult(response);

    expect(formatted.content).toBeDefined();
    expect(formatted.content[0].type).toBe('text');
    expect(formatted.content[0].text).toContain('api-service');
    expect(formatted.content[0].text).toContain('updated successfully');
    expect(formatted.structuredContent.success).toBe(true);
  });

  it('should format MCP result correctly for errors', async () => {
    const response = await updateService(
      {
        name: 'non-existent',
        updates: {},
      },
      { baseDir: testDir }
    );

    const formatted = formatUpdateServiceResult(response);

    expect(formatted.content).toBeDefined();
    expect(formatted.content[0].type).toBe('text');
    expect(formatted.content[0].text).toContain('Error');
    expect(formatted.structuredContent.success).toBe(false);
    expect(formatted.isError).toBe(true);
  });
});
