/**
 * Integration Tests: scan_codebase MCP Tool
 *
 * User Story 8: Auto-Populate Architecture from Existing Codebase (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given a project with known services,
 *    When AI calls scan_codebase in preview mode (write=false),
 *    Then detected architecture matches reality and no files are written.
 * 2. Given a project with multiple services,
 *    When AI calls scan_codebase with write=true,
 *    Then YAML files are created for detected services.
 * 3. Given an empty project,
 *    When AI calls scan_codebase,
 *    Then empty results are returned with appropriate warnings.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse } from 'yaml';
import {
  scanCodebase,
  formatScanCodebaseResult,
} from '../../../../src/server/tools/scan/scan-codebase.js';

describe('scan_codebase MCP Tool', () => {
  let testDir: string;
  let projectDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `scan-codebase-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    projectDir = join(testDir, 'project');
    archDir = join(testDir, 'architecture');

    await mkdir(projectDir, { recursive: true });
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'environments'), { recursive: true });

    // Create minimal system.yaml
    await writeFile(
      join(archDir, 'system.yaml'),
      `name: test-system
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

  describe('Preview Mode (write=false)', () => {
    it('should scan and return results without writing files', async () => {
      // Create a simple Node.js service
      const servicePath = join(projectDir, 'api-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'package.json'),
        JSON.stringify({
          name: 'api-service',
          dependencies: { express: '^4.18.0' },
        }),
        'utf-8'
      );
      await writeFile(join(servicePath, 'Dockerfile'), 'FROM node:20', 'utf-8');

      const result = await scanCodebase(
        { root_path: projectDir, write: false },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.services).toHaveLength(1);
      expect(result.data?.services[0].name).toBe('api-service');
      expect(result.data?.services[0].runtime?.framework).toBe('express');
      expect(result.data?.written).toBeUndefined(); // No files written in preview mode
    });

    it('should detect multiple services with different tech stacks', async () => {
      // Create Node.js service
      const nodeServicePath = join(projectDir, 'services', 'user-service');
      await mkdir(nodeServicePath, { recursive: true });
      await writeFile(
        join(nodeServicePath, 'package.json'),
        JSON.stringify({
          name: 'user-service',
          dependencies: { '@nestjs/core': '^10.0.0', typescript: '^5.0.0' },
        }),
        'utf-8'
      );
      await writeFile(join(nodeServicePath, 'serverless.yml'), 'service: user-service', 'utf-8');

      // Create Java service
      const javaServicePath = join(projectDir, 'services', 'payment-service');
      await mkdir(javaServicePath, { recursive: true });
      await writeFile(
        join(javaServicePath, 'pom.xml'),
        `<?xml version="1.0"?>
<project>
  <artifactId>payment-service</artifactId>
  <properties>
    <java.version>17</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter</artifactId>
    </dependency>
  </dependencies>
</project>`,
        'utf-8'
      );

      const result = await scanCodebase(
        { root_path: projectDir, write: false },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.services).toHaveLength(2);

      const userService = result.data?.services.find((s) => s.name === 'user-service');
      expect(userService).toBeDefined();
      expect(userService?.runtime?.language).toBe('typescript');
      expect(userService?.deploymentPattern).toBe('lambda');

      const paymentService = result.data?.services.find((s) => s.name === 'payment-service');
      expect(paymentService).toBeDefined();
      expect(paymentService?.runtime?.language).toBe('java');
      expect(paymentService?.runtime?.framework).toBe('spring-boot');
    });

    it('should detect CI/CD configuration', async () => {
      // Create GitHub Actions workflow
      const workflowsPath = join(projectDir, '.github', 'workflows');
      await mkdir(workflowsPath, { recursive: true });
      await writeFile(
        join(workflowsPath, 'ci.yml'),
        `name: CI
on: push
jobs:
  build:
    name: Build
  test:
    name: Test
  deploy:
    name: Deploy`,
        'utf-8'
      );

      const result = await scanCodebase(
        { root_path: projectDir, write: false },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.cicd).toBeDefined();
      expect(result.data?.cicd?.provider).toBe('github-actions');
      expect(result.data?.cicd?.configFile).toBe('.github/workflows/ci.yml');
      expect(result.data?.cicd?.steps).toContain('Build');
    });

    it('should detect observability tools', async () => {
      // Create Datadog config
      await writeFile(join(projectDir, 'datadog.yaml'), 'api_key: test', 'utf-8');

      // Create service with observability import
      const servicePath = join(projectDir, 'monitored-service');
      const srcPath = join(servicePath, 'src');
      await mkdir(srcPath, { recursive: true });
      await writeFile(
        join(servicePath, 'package.json'),
        JSON.stringify({ name: 'monitored-service' }),
        'utf-8'
      );
      await writeFile(
        join(srcPath, 'index.ts'),
        "import tracer from 'dd-trace';\ntracer.init();",
        'utf-8'
      );

      const result = await scanCodebase(
        { root_path: projectDir, write: false },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.observability).toBeDefined();
      expect(result.data?.observability?.tools).toContain('datadog');
    });

    it('should detect system metadata', async () => {
      // Create root package.json
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'ecommerce-platform',
          private: true,
          workspaces: ['services/*'],
        }),
        'utf-8'
      );

      // Create Terraform config
      const terraformPath = join(projectDir, 'terraform');
      await mkdir(terraformPath, { recursive: true });
      await writeFile(
        join(terraformPath, 'main.tf'),
        `provider "aws" {
  region = "us-west-2"
}`,
        'utf-8'
      );

      const result = await scanCodebase(
        { root_path: projectDir, write: false },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.system).toBeDefined();
      expect(result.data?.system?.name).toBe('ecommerce-platform');
      expect(result.data?.system?.cloud).toBe('aws');
      expect(result.data?.system?.region).toBe('us-west-2');
    });
  });

  describe('Write Mode (write=true)', () => {
    it('should write detected services to YAML files', async () => {
      // Create two services
      const service1Path = join(projectDir, 'api-service');
      await mkdir(service1Path, { recursive: true });
      await writeFile(
        join(service1Path, 'package.json'),
        JSON.stringify({ name: 'api-service', dependencies: { express: '^4.0.0' } }),
        'utf-8'
      );

      const service2Path = join(projectDir, 'worker-service');
      await mkdir(service2Path, { recursive: true });
      await writeFile(
        join(service2Path, 'package.json'),
        JSON.stringify({ name: 'worker-service' }),
        'utf-8'
      );

      const result = await scanCodebase(
        { root_path: projectDir, write: true },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.services.length).toBeGreaterThanOrEqual(2); // Should detect 2 services first
      expect(result.data?.written).toBeDefined();

      // Debug: log what's actually in written
      if (result.data?.written) {
        console.log('Written files:', result.data.written.files);
        console.log('Skipped files:', result.data.written.skipped);
        console.log('Errors:', result.data.written.errors);
      }

      // At least one service should be written or skipped
      const totalProcessed = (result.data?.written?.files.length || 0) + (result.data?.written?.skipped.length || 0) + (result.data?.written?.errors.length || 0);
      expect(totalProcessed).toBeGreaterThan(0);

      // Verify service files were written
      const apiServicePath = join(archDir, 'services', 'api-service.yaml');
      const workerServicePath = join(archDir, 'services', 'worker-service.yaml');

      await expect(access(apiServicePath, constants.F_OK)).resolves.toBeUndefined();
      await expect(access(workerServicePath, constants.F_OK)).resolves.toBeUndefined();

      // Verify content of written file
      const apiServiceContent = await readFile(apiServicePath, 'utf-8');
      const apiService = parse(apiServiceContent);
      expect(apiService.name).toBe('api-service');
      expect(apiService.runtime?.framework).toBe('express');
    });

    it('should write CI/CD configuration', async () => {
      const workflowsPath = join(projectDir, '.github', 'workflows');
      await mkdir(workflowsPath, { recursive: true });
      await writeFile(join(workflowsPath, 'ci.yml'), 'name: CI', 'utf-8');

      const result = await scanCodebase(
        { root_path: projectDir, write: true },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.written?.files).toContain(`${testDir}/architecture/cicd.yaml`);

      const cicdPath = join(archDir, 'cicd.yaml');
      await expect(access(cicdPath, constants.F_OK)).resolves.toBeUndefined();
    });

    it('should write observability configuration', async () => {
      await writeFile(join(projectDir, 'datadog.yaml'), 'api_key: test', 'utf-8');

      const result = await scanCodebase(
        { root_path: projectDir, write: true },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.written?.files).toContain(`${testDir}/architecture/observability.yaml`);

      const observabilityPath = join(archDir, 'observability.yaml');
      await expect(access(observabilityPath, constants.F_OK)).resolves.toBeUndefined();
    });

    it('should skip existing services', async () => {
      // Pre-create a service
      await writeFile(
        join(archDir, 'services', 'existing-service.yaml'),
        `name: existing-service
type: api
`,
        'utf-8'
      );

      // Create the same service in project
      const servicePath = join(projectDir, 'existing-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'package.json'),
        JSON.stringify({ name: 'existing-service' }),
        'utf-8'
      );

      const result = await scanCodebase(
        { root_path: projectDir, write: true },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.written?.skipped).toContain(
        expect.stringContaining('existing-service.yaml')
      );
    });

    it('should update system configuration if detected', async () => {
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({ name: 'my-system' }),
        'utf-8'
      );

      const result = await scanCodebase(
        { root_path: projectDir, write: true },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);

      // Verify system.yaml was updated
      const systemContent = await readFile(join(archDir, 'system.yaml'), 'utf-8');
      const system = parse(systemContent);
      expect(system.name).toBe('my-system');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project', async () => {
      const result = await scanCodebase(
        { root_path: projectDir, write: false },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.services).toHaveLength(0);
      expect(result.data?.scanDuration).toBeGreaterThanOrEqual(0);
    });

    it('should default to current working directory when root_path not provided', async () => {
      const result = await scanCodebase(
        { write: false },
        { baseDir: testDir, cwd: projectDir }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle inaccessible directories gracefully', async () => {
      const result = await scanCodebase(
        { root_path: '/nonexistent/path/that/does/not/exist', write: false },
        { baseDir: testDir }
      );

      // Scanner is resilient - returns empty results instead of failing
      expect(result.success).toBe(true);
      expect(result.data?.services).toHaveLength(0);
    });
  });

  describe('MCP Result Formatting', () => {
    it('should format successful scan result', async () => {
      const servicePath = join(projectDir, 'test-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'package.json'),
        JSON.stringify({ name: 'test-service' }),
        'utf-8'
      );

      const result = await scanCodebase(
        { root_path: projectDir, write: false },
        { baseDir: testDir }
      );

      const formatted = formatScanCodebaseResult(result);

      expect(formatted.content).toBeDefined();
      expect(formatted.content[0].type).toBe('text');
      expect(formatted.content[0].text).toContain('Codebase scan completed');
      expect(formatted.content[0].text).toContain('test-service');
      expect(formatted.structuredContent?.success).toBe(true);
    });

    it('should format empty scan result', async () => {
      const result = await scanCodebase(
        { root_path: '/invalid/path', write: false },
        { baseDir: testDir }
      );

      const formatted = formatScanCodebaseResult(result);

      expect(formatted.content[0].type).toBe('text');
      expect(formatted.content[0].text).toContain('scan completed');
      expect(formatted.content[0].text).toContain('0 services');
    });
  });
});
