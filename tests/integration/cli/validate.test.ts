/**
 * Integration Tests: CLI Validate Command
 *
 * Phase 12 - T077: Tests validate command via MCP protocol.
 * Uses the exported validateArchitecture function for testability.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateArchitecture } from '../../../src/cli/commands/validate.js';

describe('CLI Validate Command', () => {
  describe('valid architecture', () => {
    let testDir: string;
    let archDir: string;

    async function writeYaml(relativePath: string, content: string): Promise<void> {
      const filePath = join(archDir, relativePath);
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      await writeFile(filePath, content, 'utf-8');
    }

    beforeAll(async () => {
      testDir = join(
        tmpdir(),
        `cli-validate-valid-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      archDir = join(testDir, 'architecture');
      await mkdir(archDir, { recursive: true });

      await writeYaml(
        'system.yaml',
        `
name: test-platform
description: Validation test
architecture:
  style: microservices
  cloud: aws
  region: us-east-1
defaults:
  runtime:
    language: typescript
    version: "20"
    framework: express
`
      );

      await writeYaml(
        'services/api-service.yaml',
        `
name: api-service
type: backend
deployment:
  pattern: ecs_fargate
  runtime:
    language: typescript
    version: "20"
`
      );

      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
availability:
  replicas: 3
  multiAz: true
scaling:
  minInstances: 2
  maxInstances: 10
security:
  level: strict
`
      );

      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
steps:
  - name: build
    type: build
    required: true
  - name: test
    type: test
    required: true
`
      );

      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
  level: info
metrics:
  backend: prometheus
  enabled: true
tracing:
  standard: open-telemetry
  enabled: true
`
      );
    });

    afterAll(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('should pass validation for valid architecture', async () => {
      const result = await validateArchitecture(testDir);
      expect(result.issues).toHaveLength(0);
      expect(result.checkedCount).toBeGreaterThanOrEqual(3); // system + service + env + cicd + obs
    });
  });

  describe('missing optional files', () => {
    let testDir: string;
    let archDir: string;

    beforeAll(async () => {
      testDir = join(
        tmpdir(),
        `cli-validate-optional-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      archDir = join(testDir, 'architecture');
      await mkdir(archDir, { recursive: true });

      await writeFile(
        join(archDir, 'system.yaml'),
        `
name: minimal-platform
architecture:
  style: modular-monolith
  cloud: aws
defaults:
  runtime:
    language: typescript
    version: "20"
    framework: express
`,
        'utf-8'
      );
    });

    afterAll(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('should pass when optional files are missing', async () => {
      const result = await validateArchitecture(testDir);
      expect(result.issues).toHaveLength(0);
      expect(result.checkedCount).toBeGreaterThanOrEqual(1); // At least system.yaml
    });
  });

  describe('missing system.yaml', () => {
    let testDir: string;

    beforeAll(async () => {
      testDir = join(
        tmpdir(),
        `cli-validate-missing-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await mkdir(join(testDir, 'architecture'), { recursive: true });
    });

    afterAll(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('should report error when system.yaml is missing', async () => {
      const result = await validateArchitecture(testDir);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.entity === 'system.yaml')).toBe(true);
    });
  });

  describe('multiple files with issues', () => {
    let testDir: string;
    let archDir: string;

    beforeAll(async () => {
      testDir = join(
        tmpdir(),
        `cli-validate-multi-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      archDir = join(testDir, 'architecture');
      await mkdir(join(archDir, 'services'), { recursive: true });

      // Valid system.yaml
      await writeFile(
        join(archDir, 'system.yaml'),
        `
name: test-platform
architecture:
  style: microservices
  cloud: aws
defaults:
  runtime:
    language: typescript
    version: "20"
    framework: express
`,
        'utf-8'
      );

      // Invalid service (bad YAML structure)
      await writeFile(
        join(archDir, 'services', 'bad-service.yaml'),
        `
not_a_valid_service: true
`,
        'utf-8'
      );
    });

    afterAll(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('should report issues for invalid service files', async () => {
      const result = await validateArchitecture(testDir);
      expect(result.issues.some((i) => i.entity.includes('bad-service'))).toBe(true);
    });
  });
});
