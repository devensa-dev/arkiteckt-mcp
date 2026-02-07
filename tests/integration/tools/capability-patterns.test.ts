/**
 * Integration Tests: Pattern-Specific Artifact Checklists (T052)
 *
 * User Story 9: AI Queries Deployment Pattern Requirements (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given pattern=lambda, When AI queries requirements,
 *    Then MCP returns SAM template, API Gateway config (NOT Dockerfile, NOT Helm chart).
 * 2. Given pattern=ecs_fargate, When AI queries requirements,
 *    Then MCP returns Dockerfile, task definition, ALB config (NOT SAM template, NOT Helm chart).
 * 3. Given pattern=kubernetes, When AI queries requirements,
 *    Then MCP returns Dockerfile, Helm chart, network policy (NOT SAM template, NOT task definition).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getCapabilityRequirements,
  expandCapability,
} from '../../../src/server/tools/read/get-capability-requirements.js';
import type { Capability, ArtifactRequirement } from '../../../src/shared/types/index.js';

// Shared CapabilitySet fixture with full pattern coverage
const CAPABILITY_SET_YAML = `
name: Service Capabilities
description: Core service operations
capabilities:
  - id: create_service
    name: Create Service
    description: Create a new microservice with all production-ready artifacts
    category: service
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
`;

// Common base artifact types that should appear in ALL patterns
const COMMON_ARTIFACT_TYPES = [
  'source-code',
  'unit-test',
  'pipeline',
  'iam-role',
  'cloudwatch-alarms',
  'readme',
];

describe('Pattern-Specific Artifact Checklists (User Story 9)', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `capability-patterns-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'capabilities'), { recursive: true });
    await writeFile(
      join(archDir, 'capabilities', 'service-ops.yaml'),
      CAPABILITY_SET_YAML,
      'utf-8'
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  function getArtifactTypes(artifacts: ArtifactRequirement[]): string[] {
    return artifacts.map((a) => a.type);
  }

  describe('Lambda pattern (Acceptance Scenario 1)', () => {
    it('should include SAM template for lambda pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('sam-template');
    });

    it('should include API Gateway config for lambda pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('api-gateway');
    });

    it('should include handler for lambda pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('handler');
    });

    it('should NOT include dockerfile for lambda pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).not.toContain('dockerfile');
    });

    it('should NOT include helm-chart for lambda pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).not.toContain('helm-chart');
    });

    it('should NOT include task-definition for lambda pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).not.toContain('task-definition');
    });

    it('should include common base artifacts for lambda pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      for (const commonType of COMMON_ARTIFACT_TYPES) {
        expect(types).toContain(commonType);
      }
    });

    it('should report excluded artifact types for lambda', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      expect(result.data?.excludedArtifactTypes).toBeDefined();
      expect(result.data?.excludedArtifactTypes).toContain('dockerfile');
      expect(result.data?.excludedArtifactTypes).toContain('helm-chart');
      expect(result.data?.excludedArtifactTypes).toContain('task-definition');
    });

    it('should include pattern notes for lambda', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );

      expect(result.data?.patternNotes).toBe('AWS Lambda with API Gateway');
    });
  });

  describe('ECS Fargate pattern (Acceptance Scenario 2)', () => {
    it('should include dockerfile for ecs_fargate pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('dockerfile');
    });

    it('should include task-definition for ecs_fargate pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('task-definition');
    });

    it('should include service-definition for ecs_fargate pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('service-definition');
    });

    it('should include ALB config for ecs_fargate pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('alb-config');
    });

    it('should NOT include SAM template for ecs_fargate pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).not.toContain('sam-template');
    });

    it('should NOT include helm-chart for ecs_fargate pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).not.toContain('helm-chart');
    });

    it('should include common base artifacts for ecs_fargate pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      for (const commonType of COMMON_ARTIFACT_TYPES) {
        expect(types).toContain(commonType);
      }
    });

    it('should include pattern notes for ecs_fargate', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );

      expect(result.data?.patternNotes).toBe('ECS Fargate with ALB');
    });
  });

  describe('Kubernetes pattern (Acceptance Scenario 3)', () => {
    it('should include dockerfile for kubernetes pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('dockerfile');
    });

    it('should include helm-chart for kubernetes pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('helm-chart');
    });

    it('should include k8s-manifest for kubernetes pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('k8s-manifest');
    });

    it('should include network-policy for kubernetes pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).toContain('network-policy');
    });

    it('should NOT include SAM template for kubernetes pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).not.toContain('sam-template');
    });

    it('should NOT include task-definition for kubernetes pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      expect(types).not.toContain('task-definition');
    });

    it('should include common base artifacts for kubernetes pattern', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      const types = getArtifactTypes(result.data!.artifacts);
      for (const commonType of COMMON_ARTIFACT_TYPES) {
        expect(types).toContain(commonType);
      }
    });

    it('should include pattern notes for kubernetes', async () => {
      const result = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      expect(result.data?.patternNotes).toBe('Kubernetes with Helm on EKS');
    });
  });

  describe('Cross-pattern comparison', () => {
    it('should produce different artifact lists for different patterns', async () => {
      const lambdaResult = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'lambda' },
        { baseDir: testDir }
      );
      const ecsResult = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'ecs_fargate' },
        { baseDir: testDir }
      );
      const k8sResult = await getCapabilityRequirements(
        { capability_id: 'create_service', pattern: 'kubernetes' },
        { baseDir: testDir }
      );

      const lambdaTypes = getArtifactTypes(lambdaResult.data!.artifacts).sort();
      const ecsTypes = getArtifactTypes(ecsResult.data!.artifacts).sort();
      const k8sTypes = getArtifactTypes(k8sResult.data!.artifacts).sort();

      // All three should be different
      expect(lambdaTypes).not.toEqual(ecsTypes);
      expect(lambdaTypes).not.toEqual(k8sTypes);
      expect(ecsTypes).not.toEqual(k8sTypes);
    });

    it('should always include common artifacts regardless of pattern', async () => {
      const patterns = ['lambda', 'ecs_fargate', 'kubernetes'];

      for (const pattern of patterns) {
        const result = await getCapabilityRequirements(
          { capability_id: 'create_service', pattern },
          { baseDir: testDir }
        );

        expect(result.success).toBe(true);
        const types = getArtifactTypes(result.data!.artifacts);
        for (const commonType of COMMON_ARTIFACT_TYPES) {
          expect(types).toContain(commonType);
        }
      }
    });
  });

  describe('expandCapability pure function', () => {
    const testCapability: Capability = {
      schemaVersion: '1.0.0',
      id: 'test_cap',
      name: 'Test Capability',
      baseArtifacts: [
        { type: 'source-code', name: 'src/index.ts', required: true },
        { type: 'unit-test', name: 'tests/index.test.ts', required: true },
        {
          type: 'dockerfile',
          name: 'Dockerfile',
          required: true,
          conditions: {
            deploymentPatterns: ['ecs_fargate', 'kubernetes'],
          },
        },
      ],
      patternArtifacts: [
        {
          pattern: 'lambda',
          artifacts: [{ type: 'sam-template', name: 'template.yaml', required: true }],
          excludes: ['dockerfile'],
          notes: 'Lambda deploy',
        },
        {
          pattern: 'ecs_fargate',
          artifacts: [{ type: 'task-definition', name: 'task-def.json', required: true }],
        },
      ],
    };

    it('should return all baseArtifacts when no pattern given', () => {
      const result = expandCapability(testCapability);

      expect(result.artifacts).toHaveLength(3);
      expect(result.pattern).toBeUndefined();
    });

    it('should filter baseArtifacts by conditions.deploymentPatterns', () => {
      const result = expandCapability(testCapability, 'lambda');

      // dockerfile has conditions.deploymentPatterns that doesn't include 'lambda'
      const types = result.artifacts.map((a) => a.type);
      expect(types).not.toContain('dockerfile');
    });

    it('should append patternArtifacts for matching pattern', () => {
      const result = expandCapability(testCapability, 'lambda');

      const types = result.artifacts.map((a) => a.type);
      expect(types).toContain('sam-template');
    });

    it('should apply excludes to remove artifacts by type', () => {
      const result = expandCapability(testCapability, 'lambda');

      expect(result.excludedArtifactTypes).toContain('dockerfile');
    });

    it('should handle capability with no patternArtifacts gracefully', () => {
      const simpleCapability: Capability = {
        schemaVersion: '1.0.0',
        id: 'simple',
        name: 'Simple Cap',
        baseArtifacts: [{ type: 'source-code', name: 'src/index.ts', required: true }],
      };

      const result = expandCapability(simpleCapability, 'lambda');

      expect(result.artifacts).toHaveLength(1);
      expect(result.pattern).toBe('lambda');
    });

    it('should handle unknown pattern gracefully', () => {
      const result = expandCapability(testCapability, 'unknown_pattern');

      // No matching patternArtifacts, but conditions still filter
      // dockerfile has conditions that don't include 'unknown_pattern'
      const types = result.artifacts.map((a) => a.type);
      expect(types).toContain('source-code');
      expect(types).toContain('unit-test');
      expect(types).not.toContain('dockerfile');
      expect(result.pattern).toBe('unknown_pattern');
    });

    it('should include pattern notes when available', () => {
      const result = expandCapability(testCapability, 'lambda');
      expect(result.patternNotes).toBe('Lambda deploy');
    });

    it('should not include pattern notes when pattern has none', () => {
      const result = expandCapability(testCapability, 'ecs_fargate');
      expect(result.patternNotes).toBeUndefined();
    });

    it('should handle capability with no baseArtifacts', () => {
      const noBaseCapability: Capability = {
        schemaVersion: '1.0.0',
        id: 'no_base',
        name: 'No Base',
        patternArtifacts: [
          {
            pattern: 'lambda',
            artifacts: [{ type: 'sam-template', name: 'template.yaml', required: true }],
          },
        ],
      };

      const result = expandCapability(noBaseCapability, 'lambda');

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].type).toBe('sam-template');
    });
  });
});
