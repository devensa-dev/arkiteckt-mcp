/**
 * Integration Tests: get_capability_requirements MCP Tool (T051)
 *
 * User Story 8: AI Gets Complete Artifact Checklist (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given a request to create a service, When AI calls get_capability_requirements("create_service", {pattern: "lambda"}),
 *    Then MCP returns checklist including: handler code, unit tests, SAM template, CI/CD pipeline, alarms, IAM role config.
 * 2. Given a request to add an endpoint, When AI calls get_capability_requirements("add_endpoint", {service: "order-service"}),
 *    Then MCP returns checklist for ONLY the endpoint-specific changes needed.
 * 3. Given a non-existent capability, When AI calls get_capability_requirements, Then MCP returns clear error.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getCapabilityRequirements,
  formatMcpResult,
} from '../../../src/server/tools/read/get-capability-requirements.js';

// Shared CapabilitySet fixture matching the CapabilitySetSchema format
const CAPABILITY_SET_YAML = `
name: Service Capabilities
description: Core service operations
capabilities:
  - id: create_service
    name: Create Service
    description: Create a new microservice with all production-ready artifacts
    category: service
    inputs:
      - name: service_name
        type: string
        description: Name of the new service
        required: true
      - name: pattern
        type: string
        description: Deployment pattern
        required: false
    baseArtifacts:
      - type: source-code
        name: src/index.ts
        required: true
      - type: unit-test
        name: tests/index.test.ts
        required: true
      - type: pipeline
        name: .github/workflows/ci.yaml
        required: true
      - type: iam-role
        name: iam/role.yaml
        required: true
      - type: cloudwatch-alarms
        name: alarms.yaml
        required: true
      - type: readme
        name: README.md
        required: true
      - type: dockerfile
        name: Dockerfile
        required: true
        conditions:
          deploymentPatterns:
            - ecs_fargate
            - ecs_ec2
            - kubernetes
            - container
    patternArtifacts:
      - pattern: lambda
        artifacts:
          - type: sam-template
            name: template.yaml
            required: true
          - type: api-gateway
            name: api-gateway.yaml
            required: true
          - type: handler
            name: src/handlers/index.ts
            required: true
        excludes:
          - dockerfile
          - helm-chart
          - task-definition
        notes: AWS Lambda with API Gateway
      - pattern: ecs_fargate
        artifacts:
          - type: task-definition
            name: ecs/task-definition.json
            required: true
          - type: service-definition
            name: ecs/service.json
            required: true
          - type: alb-config
            name: alb/target-group.json
            required: true
        excludes:
          - sam-template
          - helm-chart
        notes: ECS Fargate with ALB
      - pattern: kubernetes
        artifacts:
          - type: helm-chart
            name: helm/
            required: true
          - type: k8s-manifest
            name: k8s/deployment.yaml
            required: true
          - type: network-policy
            name: k8s/network-policy.yaml
            required: true
        excludes:
          - sam-template
          - task-definition
        notes: Kubernetes with Helm on EKS
    validations:
      - name: lint
        type: lint
        command: npm run lint
        required: true
      - name: test
        type: test
        command: npm test
        required: true
    workflow:
      - step: 1
        action: scaffold_project
        description: Create project structure
        artifacts:
          - source-code
      - step: 2
        action: add_tests
        artifacts:
          - unit-test
      - step: 3
        action: add_infrastructure
        artifacts:
          - sam-template
          - dockerfile
          - helm-chart
      - step: 4
        action: add_ci_cd
        artifacts:
          - pipeline
  - id: add_endpoint
    name: Add Endpoint
    description: Add a new API endpoint to an existing service
    category: endpoint
    baseArtifacts:
      - type: handler
        name: src/handlers/new-endpoint.ts
        required: true
      - type: unit-test
        name: tests/new-endpoint.test.ts
        required: true
      - type: integration-test
        name: tests/integration/new-endpoint.test.ts
        required: false
`;

describe('get_capability_requirements MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `get-capability-req-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'capabilities'), { recursive: true });
    await mkdir(join(archDir, 'services'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    await writeFile(filePath, content, 'utf-8');
  }

  describe('Acceptance Scenario: Successful capability retrieval', () => {
    it('should return capability with all base artifacts when no pattern specified', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'create_service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('create_service');
      expect(result.data?.name).toBe('Create Service');
      expect(result.data?.description).toBe(
        'Create a new microservice with all production-ready artifacts'
      );
      // Without pattern, all baseArtifacts are returned (including conditional ones)
      const artifactTypes = result.data?.artifacts.map((a) => a.type);
      expect(artifactTypes).toContain('source-code');
      expect(artifactTypes).toContain('unit-test');
      expect(artifactTypes).toContain('pipeline');
      expect(artifactTypes).toContain('iam-role');
      expect(artifactTypes).toContain('cloudwatch-alarms');
      expect(artifactTypes).toContain('readme');
      expect(artifactTypes).toContain('dockerfile');
      // No pattern-specific artifacts
      expect(artifactTypes).not.toContain('sam-template');
      expect(artifactTypes).not.toContain('task-definition');
      expect(artifactTypes).not.toContain('helm-chart');
    });

    it('should include response metadata with sources', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'create_service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.resolvedAt).toBeDefined();
      expect(result.metadata?.sources).toContain('architecture/capabilities/');
    });

    it('should return simple capability without patternArtifacts', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'add_endpoint' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('add_endpoint');
      expect(result.data?.artifacts).toHaveLength(3);
      const artifactTypes = result.data?.artifacts.map((a) => a.type);
      expect(artifactTypes).toContain('handler');
      expect(artifactTypes).toContain('unit-test');
      expect(artifactTypes).toContain('integration-test');
    });

    it('should include workflow and validations in response', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'create_service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.workflow).toBeDefined();
      expect(result.data?.workflow).toHaveLength(4);
      expect(result.data?.validations).toBeDefined();
      expect(result.data?.validations).toHaveLength(2);
    });

    it('should include inputs in response', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'create_service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.inputs).toBeDefined();
      expect(result.data?.inputs).toHaveLength(2);
    });
  });

  describe('Acceptance Scenario: Error handling', () => {
    it('should return error with available capability IDs when capability not found', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'nonexistent_capability' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('validation');
      expect(result.error?.message).toContain('nonexistent_capability');
      expect(result.error?.message).toContain('not found');
      expect(result.error?.message).toContain('create_service');
      expect(result.error?.message).toContain('add_endpoint');
    });

    it('should return error when capabilities directory does not exist', async () => {
      // Use a baseDir with no architecture/capabilities/ directory
      const emptyDir = join(
        tmpdir(),
        `empty-cap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await mkdir(join(emptyDir, 'architecture'), { recursive: true });

      try {
        const result = await getCapabilityRequirements(
          { capability_id: 'create_service' },
          { baseDir: emptyDir }
        );

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('capabilities');
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    it('should report available capabilities as none when directory is empty', async () => {
      // capabilities/ directory exists but is empty
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
      expect(result.error?.message).toContain('none');
    });
  });

  describe('Service name pattern inference', () => {
    it('should infer pattern from service config when service_name provided', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);
      await writeYaml(
        'services/order-service.yaml',
        `
name: order-service
type: backend
deployment:
  pattern: lambda
`
      );

      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', service_name: 'order-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.pattern).toBe('lambda');
      // Lambda-specific artifacts should be included
      const artifactTypes = result.data?.artifacts.map((a) => a.type);
      expect(artifactTypes).toContain('sam-template');
      expect(artifactTypes).toContain('api-gateway');
      expect(artifactTypes).toContain('handler');
      // Dockerfile should NOT be included (lambda excludes + conditions filter)
      expect(artifactTypes).not.toContain('dockerfile');
    });

    it('should prefer explicit pattern over service_name inferred pattern', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);
      await writeYaml(
        'services/order-service.yaml',
        `
name: order-service
type: backend
deployment:
  pattern: lambda
`
      );

      const result = await getCapabilityRequirements(
        {
          capability_id: 'create_service',
          pattern: 'ecs_fargate',
          service_name: 'order-service',
        },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.pattern).toBe('ecs_fargate');
      // ECS artifacts, not lambda
      const artifactTypes = result.data?.artifacts.map((a) => a.type);
      expect(artifactTypes).toContain('task-definition');
      expect(artifactTypes).not.toContain('sam-template');
    });

    it('should gracefully degrade when service_name not found', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', service_name: 'nonexistent-service' },
        { baseDir: testDir }
      );

      // Should still succeed - returns base artifacts without pattern filtering
      expect(result.success).toBe(true);
      expect(result.data?.pattern).toBeUndefined();
      expect(result.data?.artifacts.length).toBeGreaterThan(0);
    });

    it('should include service source in metadata when pattern was inferred', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);
      await writeYaml(
        'services/my-service.yaml',
        `
name: my-service
type: api
deployment:
  pattern: ecs_fargate
`
      );

      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', service_name: 'my-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.sources).toContain('architecture/services/my-service.yaml');
      expect(result.metadata?.sources).toContain('architecture/capabilities/');
    });
  });

  describe('MCP result formatting', () => {
    it('should format successful result for MCP', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'create_service' },
        { baseDir: testDir }
      );
      const mcpResult = formatMcpResult(result);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('create_service');
      expect(mcpResult.structuredContent).toBeDefined();
      expect(mcpResult.structuredContent.success).toBe(true);
      expect(mcpResult.isError).toBeUndefined();
    });

    it('should format error result for MCP', async () => {
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const result = await getCapabilityRequirements(
        { capability_id: 'nonexistent' },
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
      await writeYaml('capabilities/service-ops.yaml', CAPABILITY_SET_YAML);

      const start = performance.now();
      await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
