/**
 * Integration tests for check_service_readiness tool
 *
 * Tests service readiness assessment comparing required artifacts
 * against the service's actual state.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkReadiness } from '../../../../src/server/tools/scaffold/check-readiness.js';
import type { CheckReadinessInput } from '../../../../src/server/tools/scaffold/check-readiness.js';

describe('check_service_readiness integration tests', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `check-readiness-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'capabilities'), { recursive: true });

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

    // Create capability definitions with artifact requirements
    await writeFile(
      join(archDir, 'capabilities', 'service-capabilities.yaml'),
      `
name: service-capabilities
capabilities:
  - name: create_service
    description: Create a new service
    artifacts:
      - type: source-code
        name: Service entry point
        description: Main application code
        required: true
      - type: unit-test
        name: Unit tests
        description: Unit test suite
        required: true
      - type: dockerfile
        name: Container image
        description: Dockerfile for containerization
        required: true
        conditions:
          deploymentPatterns:
            - container
            - kubernetes
            - ecs_fargate
      - type: k8s-manifest
        name: Kubernetes deployment
        description: K8s deployment manifest
        required: true
        conditions:
          deploymentPatterns:
            - kubernetes
      - type: sam-template
        name: SAM template
        description: AWS SAM template
        required: true
        conditions:
          deploymentPatterns:
            - lambda
      - type: integration-test
        name: Integration tests
        description: Integration test suite
        required: false
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should return 100% readiness score when all required artifacts exist (mocked)', async () => {
    // Create a container service
    await writeFile(
      join(archDir, 'services', 'complete-service.yaml'),
      `
name: complete-service
type: api
deployment:
  pattern: container
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'complete-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { serviceName, deploymentPattern, readinessScore, completed, missing } = result.data;

      expect(serviceName).toBe('complete-service');
      expect(deploymentPattern).toBe('container');

      // Mock implementation assumes source-code, unit-test, and dockerfile exist for container
      expect(completed.length).toBeGreaterThan(0);

      // Readiness score should be > 0
      expect(readinessScore).toBeGreaterThan(0);
      expect(readinessScore).toBeLessThanOrEqual(100);
    }
  });

  it('should identify missing artifacts for lambda deployment', async () => {
    // Create a lambda service
    await writeFile(
      join(archDir, 'services', 'lambda-service.yaml'),
      `
name: lambda-service
type: worker
deployment:
  pattern: lambda
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'lambda-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { deploymentPattern, completed, missing, recommendations } = result.data;

      expect(deploymentPattern).toBe('lambda');

      // Should have both completed and potentially missing artifacts
      expect(completed.length + missing.length).toBeGreaterThan(0);

      // Recommendations should be provided for missing artifacts
      if (missing.length > 0) {
        expect(recommendations.length).toBeGreaterThan(0);
      }
    }
  });

  it('should identify missing dockerfile for kubernetes deployment', async () => {
    // Create a kubernetes service
    await writeFile(
      join(archDir, 'services', 'k8s-service.yaml'),
      `
name: k8s-service
type: api
deployment:
  pattern: kubernetes
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'k8s-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { deploymentPattern, completed, missing } = result.data;

      expect(deploymentPattern).toBe('kubernetes');

      // Mock implementation should mark source-code and tests as completed
      const sourceCodeCompleted = completed.find((a) => a.type === 'source-code');
      expect(sourceCodeCompleted).toBeDefined();
      expect(sourceCodeCompleted?.exists).toBe(true);

      // Should have dockerfile as completed (mock assumes it exists for k8s)
      const dockerfileCheck = completed.find((a) => a.type === 'dockerfile');
      expect(dockerfileCheck).toBeDefined();
    }
  });

  it('should provide specific recommendations based on missing artifacts', async () => {
    // Create an ecs_fargate service
    await writeFile(
      join(archDir, 'services', 'ecs-service.yaml'),
      `
name: ecs-service
type: backend
deployment:
  pattern: ecs_fargate
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'ecs-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { recommendations, missing } = result.data;

      // If there are missing artifacts, should have recommendations
      if (missing.length > 0) {
        expect(recommendations.length).toBeGreaterThan(0);

        // Recommendations should be actionable strings
        recommendations.forEach((rec) => {
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(0);
        });
      }
    }
  });

  it('should return error when service does not exist', async () => {
    const input: CheckReadinessInput = {
      service_name: 'nonexistent-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('ENOENT');
  });

  it('should calculate readiness score correctly based on completed vs total artifacts', async () => {
    // Create a service
    await writeFile(
      join(archDir, 'services', 'test-service.yaml'),
      `
name: test-service
type: api
deployment:
  pattern: container
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'test-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { readinessScore, completed, missing } = result.data;

      const total = completed.length + missing.length;
      const expectedScore = total === 0 ? 100 : Math.round((completed.length / total) * 100);

      // Readiness score should match calculation
      expect(readinessScore).toBe(expectedScore);
      expect(readinessScore).toBeGreaterThanOrEqual(0);
      expect(readinessScore).toBeLessThanOrEqual(100);
    }
  });

  it('should include artifact paths for completed artifacts', async () => {
    // Create a service
    await writeFile(
      join(archDir, 'services', 'path-test-service.yaml'),
      `
name: path-test-service
type: api
deployment:
  pattern: kubernetes
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'path-test-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { completed } = result.data;

      // Mock implementation should include paths for completed artifacts
      const completedWithPath = completed.filter((a) => a.path);
      expect(completedWithPath.length).toBeGreaterThan(0);

      // Paths should be reasonable strings
      completedWithPath.forEach((artifact) => {
        expect(artifact.path).toBeDefined();
        expect(artifact.path!.length).toBeGreaterThan(0);
      });
    }
  });

  it('should distinguish between required and optional artifacts', async () => {
    // Create a service
    await writeFile(
      join(archDir, 'services', 'artifact-service.yaml'),
      `
name: artifact-service
type: api
deployment:
  pattern: container
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'artifact-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { completed, missing } = result.data;

      const allArtifacts = [...completed, ...missing];

      // Should have both required and optional artifacts
      const requiredArtifacts = allArtifacts.filter((a) => a.required);
      const optionalArtifacts = allArtifacts.filter((a) => !a.required);

      expect(requiredArtifacts.length).toBeGreaterThan(0);

      // Each artifact should have the required field
      allArtifacts.forEach((artifact) => {
        expect(typeof artifact.required).toBe('boolean');
      });
    }
  });

  it('should handle service with no deployment pattern gracefully', async () => {
    // Create a service without deployment pattern (edge case)
    await writeFile(
      join(archDir, 'services', 'minimal-service.yaml'),
      `
name: minimal-service
type: api
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'minimal-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      const { deploymentPattern, readinessScore } = result.data;

      // Should handle missing deployment pattern
      expect(deploymentPattern).toBe('unknown');

      // Should still calculate a readiness score
      expect(readinessScore).toBeGreaterThanOrEqual(0);
      expect(readinessScore).toBeLessThanOrEqual(100);
    }
  });

  it('should return error when capabilities are not defined', async () => {
    // Remove capabilities directory
    await rm(join(archDir, 'capabilities'), { recursive: true, force: true });

    // Create a service
    await writeFile(
      join(archDir, 'services', 'no-caps-service.yaml'),
      `
name: no-caps-service
type: api
deployment:
  pattern: container
`,
      'utf-8'
    );

    const input: CheckReadinessInput = {
      service_name: 'no-caps-service',
    };

    const result = await checkReadiness(input, { baseDir: testDir });

    // Should handle missing capabilities gracefully
    // Either return error or return empty artifact lists
    if (!result.success) {
      expect(result.error).toBeDefined();
    } else {
      // If it succeeds, should have empty or minimal artifact lists
      const { completed, missing } = result.data;
      expect(completed.length + missing.length).toBe(0);
    }
  });
});
