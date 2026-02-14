/**
 * Integration Tests: set_cicd and set_observability MCP Tools
 *
 * User Story 2: Update Existing Architecture Entities (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given no existing cicd.yaml,
 *    When AI calls set_cicd,
 *    Then cicd.yaml is created.
 * 2. Given existing cicd.yaml,
 *    When AI calls set_cicd,
 *    Then cicd.yaml is deep-merged.
 * 3. Given no existing observability.yaml,
 *    When AI calls set_observability,
 *    Then observability.yaml is created.
 * 4. Given existing observability.yaml,
 *    When AI calls set_observability,
 *    Then observability.yaml is deep-merged.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFile, access } from 'fs/promises';
import { parse } from 'yaml';
import {
  setCICD,
  formatMcpResult as formatSetCICDResult,
} from '../../../../src/server/tools/write/set-cicd.js';
import {
  setObservability,
  formatMcpResult as formatSetObservabilityResult,
} from '../../../../src/server/tools/write/set-observability.js';

describe('Upsert MCP Tools', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `upsert-tools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(archDir, { recursive: true });

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

  describe('set_cicd', () => {
    it('should create cicd.yaml when it does not exist', async () => {
      const result = await setCICD(
        {
          provider: 'github-actions',
          steps: [
            { type: 'build', name: 'Build application' },
            { type: 'test', name: 'Run tests' },
          ],
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.provider).toBe('github-actions');
        expect(result.data.entity.steps).toHaveLength(2);
        expect(result.data.operation).toBe('create');
      }

      // Verify file was created
      const fileContent = await readFile(join(archDir, 'cicd.yaml'), 'utf-8');
      const parsed = parse(fileContent);
      expect(parsed.provider).toBe('github-actions');
    });

    it('should merge with existing cicd.yaml (upsert behavior)', async () => {
      // Create existing cicd.yaml
      await writeFile(
        join(archDir, 'cicd.yaml'),
        `
provider: gitlab-ci
steps:
  - type: build
    name: Build
config:
  timeout: 3600
`,
        'utf-8'
      );

      const result = await setCICD(
        {
          quality_gates: [
            {
              name: 'Code coverage',
              metric: 'coverage',
              operator: 'gte',
              threshold: 80,
            },
          ],
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.provider).toBe('gitlab-ci'); // Preserved
        expect(result.data.entity.qualityGates).toHaveLength(1);
        expect(result.data.operation).toBe('update');
      }
    });

    it('should handle quality gates configuration', async () => {
      const result = await setCICD(
        {
          provider: 'github-actions',
          quality_gates: [
            {
              name: 'Code coverage',
              enabled: true,
              metric: 'coverage',
              operator: 'gte',
              threshold: 80,
            },
            {
              name: 'Code quality',
              enabled: true,
              metric: 'quality_score',
              operator: 'gte',
              threshold: 7.0,
            },
          ],
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.qualityGates).toHaveLength(2);
        expect(result.data.entity.qualityGates?.[0].name).toBe('Code coverage');
        expect(result.data.entity.qualityGates?.[0].threshold).toBe(80);
      }
    });

    it('should format MCP result correctly', async () => {
      const response = await setCICD(
        {
          provider: 'github-actions',
          steps: [
            { type: 'build', name: 'Build' },
            { type: 'test', name: 'Test' },
            { type: 'deploy', name: 'Deploy' },
          ],
          quality_gates: [
            {
              name: 'Coverage gate',
              metric: 'coverage',
              operator: 'gte',
              threshold: 80,
            },
          ],
        },
        { baseDir: testDir }
      );

      const formatted = formatSetCICDResult(response);

      expect(formatted.content).toBeDefined();
      expect(formatted.content[0].type).toBe('text');
      expect(formatted.content[0].text).toContain('CI/CD configuration');
      expect(formatted.content[0].text).toContain('github-actions');
      expect(formatted.content[0].text).toContain('Pipeline steps: 3');
      expect(formatted.content[0].text).toContain('Quality gates: 1');
      expect(formatted.structuredContent.success).toBe(true);
    });
  });

  describe('set_observability', () => {
    it('should create observability.yaml when it does not exist', async () => {
      const result = await setObservability(
        {
          logging: {
            level: 'info',
            format: 'json',
            retention_days: 30,
          },
          metrics: {
            provider: 'prometheus',
            scrape_interval: '15s',
          },
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.logging?.level).toBe('info');
        expect(result.data.entity.metrics?.provider).toBe('prometheus');
        expect(result.data.operation).toBe('create');
      }

      // Verify file was created
      const fileContent = await readFile(join(archDir, 'observability.yaml'), 'utf-8');
      const parsed = parse(fileContent);
      expect(parsed.logging.level).toBe('info');
    });

    it('should merge with existing observability.yaml (upsert behavior)', async () => {
      // Create existing observability.yaml
      await writeFile(
        join(archDir, 'observability.yaml'),
        `
logging:
  level: debug
  format: text
metrics:
  provider: datadog
`,
        'utf-8'
      );

      const result = await setObservability(
        {
          tracing: {
            enabled: true,
            provider: 'jaeger',
            sample_rate: 0.1,
          },
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.logging?.level).toBe('debug'); // Preserved
        expect(result.data.entity.tracing?.enabled).toBe(true);
        expect(result.data.operation).toBe('update');
      }
    });

    it('should handle full observability configuration', async () => {
      const result = await setObservability(
        {
          logging: {
            level: 'info',
            format: 'json',
            retention_days: 90,
          },
          metrics: {
            provider: 'prometheus',
            scrape_interval: '30s',
            retention: '15d',
          },
          tracing: {
            enabled: true,
            provider: 'opentelemetry',
            sample_rate: 0.05,
          },
          alerting: {
            enabled: true,
            channels: ['slack', 'pagerduty'],
          },
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity.logging).toBeDefined();
        expect(result.data.entity.metrics).toBeDefined();
        expect(result.data.entity.tracing).toBeDefined();
        expect(result.data.entity.alerting).toBeDefined();
        expect(result.data.entity.alerting?.channels).toHaveLength(2);
      }
    });

    it('should format MCP result correctly', async () => {
      const response = await setObservability(
        {
          logging: {
            level: 'warn',
            format: 'json',
          },
          metrics: {
            provider: 'datadog',
          },
          tracing: {
            enabled: true,
          },
          alerting: {
            enabled: true,
          },
        },
        { baseDir: testDir }
      );

      const formatted = formatSetObservabilityResult(response);

      expect(formatted.content).toBeDefined();
      expect(formatted.content[0].type).toBe('text');
      expect(formatted.content[0].text).toContain('Observability configuration');
      expect(formatted.content[0].text).toContain('Logging: level=warn');
      expect(formatted.content[0].text).toContain('Metrics: provider=datadog');
      expect(formatted.content[0].text).toContain('Tracing: enabled');
      expect(formatted.content[0].text).toContain('Alerting: enabled');
      expect(formatted.structuredContent.success).toBe(true);
    });
  });

  describe('upsert workflow', () => {
    it('should support create → update → update workflow for CI/CD', async () => {
      // Create
      const create = await setCICD(
        {
          provider: 'github-actions',
          steps: [{ type: 'build', name: 'Build' }],
        },
        { baseDir: testDir }
      );
      expect(create.success).toBe(true);

      // First update
      const update1 = await setCICD(
        {
          quality_gates: [
            {
              name: 'Coverage',
              metric: 'coverage',
              operator: 'gte',
              threshold: 80,
            },
          ],
        },
        { baseDir: testDir }
      );
      expect(update1.success).toBe(true);
      if (update1.success) {
        expect(update1.data.entity.provider).toBe('github-actions'); // Preserved
        expect(update1.data.entity.qualityGates).toHaveLength(1);
      }

      // Second update
      const update2 = await setCICD(
        {
          steps: [
            { type: 'build', name: 'Build' },
            { type: 'test', name: 'Test' },
          ],
        },
        { baseDir: testDir }
      );
      expect(update2.success).toBe(true);
      if (update2.success) {
        expect(update2.data.entity.steps).toHaveLength(2);
        expect(update2.data.entity.qualityGates).toHaveLength(1); // Still preserved
      }
    });

    it('should support create → update → update workflow for Observability', async () => {
      // Create
      const create = await setObservability(
        {
          logging: {
            level: 'info',
          },
        },
        { baseDir: testDir }
      );
      expect(create.success).toBe(true);

      // Update with metrics
      const update1 = await setObservability(
        {
          metrics: {
            provider: 'prometheus',
          },
        },
        { baseDir: testDir }
      );
      expect(update1.success).toBe(true);
      if (update1.success) {
        expect(update1.data.entity.logging?.level).toBe('info'); // Preserved
        expect(update1.data.entity.metrics?.provider).toBe('prometheus');
      }

      // Update with tracing
      const update2 = await setObservability(
        {
          tracing: {
            enabled: true,
            provider: 'jaeger',
          },
        },
        { baseDir: testDir }
      );
      expect(update2.success).toBe(true);
      if (update2.success) {
        expect(update2.data.entity.logging?.level).toBe('info'); // Still preserved
        expect(update2.data.entity.metrics?.provider).toBe('prometheus'); // Still preserved
        expect(update2.data.entity.tracing?.enabled).toBe(true);
      }
    });
  });
});
