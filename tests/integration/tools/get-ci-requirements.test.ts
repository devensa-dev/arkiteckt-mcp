/**
 * Integration Tests: get_ci_requirements MCP Tool (T060)
 *
 * User Story 5: AI Queries CI/CD Requirements (Priority: P2)
 *
 * Acceptance Scenarios:
 * 1. Given CI standards defined in cicd.yaml,
 *    When AI calls get_ci_requirements,
 *    Then MCP returns pipeline provider, required steps, and SonarQube thresholds.
 * 2. Given service-specific CI overrides,
 *    When AI queries for that service,
 *    Then service-specific steps are merged with global requirements.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getCIRequirements,
  formatMcpResult,
} from '../../../src/server/tools/read/get-ci-requirements.js';

describe('get_ci_requirements MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `get-ci-req-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(archDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    const dir = join(filePath, '..');
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }

  describe('Acceptance Scenario 1: Retrieve CI/CD configuration', () => {
    it('should return pipeline provider and required steps', async () => {
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
  - name: lint
    type: lint
    required: true
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.provider).toBe('github-actions');
      expect(result.data?.steps).toHaveLength(3);
      expect(result.data?.steps?.[0].name).toBe('build');
      expect(result.data?.steps?.[0].type).toBe('build');
      expect(result.data?.steps?.[0].required).toBe(true);
      expect(result.data?.steps?.[1].name).toBe('test');
      expect(result.data?.steps?.[2].name).toBe('lint');
    });

    it('should return SonarQube thresholds', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
sonarqube:
  enabled: true
  serverUrl: https://sonar.example.com
  projectKey: my-project
  thresholds:
    coverage: 80
    duplications: 5
    maintainabilityRating: A
    reliabilityRating: A
    securityRating: A
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.sonarqube?.enabled).toBe(true);
      expect(result.data?.sonarqube?.serverUrl).toBe('https://sonar.example.com');
      expect(result.data?.sonarqube?.thresholds?.coverage).toBe(80);
      expect(result.data?.sonarqube?.thresholds?.duplications).toBe(5);
      expect(result.data?.sonarqube?.thresholds?.maintainabilityRating).toBe('A');
    });

    it('should return quality gates', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: gitlab-ci
qualityGates:
  - name: coverage-check
    enabled: true
    metric: code_coverage
    operator: gte
    threshold: 80
    failOnViolation: true
  - name: duplication-check
    enabled: true
    metric: duplicated_lines_density
    operator: lte
    threshold: 5
    failOnViolation: true
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.qualityGates).toHaveLength(2);
      expect(result.data?.qualityGates?.[0].name).toBe('coverage-check');
      expect(result.data?.qualityGates?.[0].operator).toBe('gte');
      expect(result.data?.qualityGates?.[0].threshold).toBe(80);
      expect(result.data?.qualityGates?.[1].name).toBe('duplication-check');
    });

    it('should return security scanning configuration', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
security:
  enabled: true
  failOnCritical: true
  failOnHigh: true
  tools:
    - name: snyk
      type: sca
      required: true
    - name: trivy
      type: container
      required: true
    - name: semgrep
      type: sast
      required: false
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.security?.enabled).toBe(true);
      expect(result.data?.security?.failOnCritical).toBe(true);
      expect(result.data?.security?.tools).toHaveLength(3);
      expect(result.data?.security?.tools?.[0].name).toBe('snyk');
      expect(result.data?.security?.tools?.[0].type).toBe('sca');
    });

    it('should return deployment stages and strategies', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
deploymentStages:
  - name: deploy-dev
    environment: dev
    strategy: rolling
    manual: false
  - name: deploy-staging
    environment: staging
    strategy: blue-green
    manual: false
  - name: deploy-prod
    environment: prod
    strategy: canary
    manual: true
    gates:
      preDeployment:
        - security-review
        - load-test
      postDeployment:
        - smoke-test
        - health-check
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.deploymentStages).toHaveLength(3);
      expect(result.data?.deploymentStages?.[0].strategy).toBe('rolling');
      expect(result.data?.deploymentStages?.[2].strategy).toBe('canary');
      expect(result.data?.deploymentStages?.[2].manual).toBe(true);
      expect(result.data?.deploymentStages?.[2].gates?.preDeployment).toContain('security-review');
      expect(result.data?.deploymentStages?.[2].gates?.postDeployment).toContain('smoke-test');
    });

    it('should return branch strategy configuration', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
branchStrategy:
  type: github-flow
  mainBranch: main
  featurePrefix: feature/
  protectedBranches:
    - main
    - release
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.branchStrategy?.type).toBe('github-flow');
      expect(result.data?.branchStrategy?.mainBranch).toBe('main');
      expect(result.data?.branchStrategy?.protectedBranches).toContain('main');
      expect(result.data?.branchStrategy?.protectedBranches).toContain('release');
    });

    it('should return testing requirements', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
testing:
  unitTests:
    required: true
    coverageThreshold: 80
  integrationTests:
    required: true
    environments:
      - dev
      - staging
  e2eTests:
    required: false
    environments:
      - staging
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.testing?.unitTests?.required).toBe(true);
      expect(result.data?.testing?.unitTests?.coverageThreshold).toBe(80);
      expect(result.data?.testing?.integrationTests?.required).toBe(true);
      expect(result.data?.testing?.integrationTests?.environments).toContain('dev');
      expect(result.data?.testing?.e2eTests?.required).toBe(false);
    });

    it('should return artifact configuration', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
artifacts:
  registry: ghcr.io/my-org
  type: docker
  naming:
    pattern: "{service}-{version}"
    includeCommit: true
    includeBranch: false
  retention:
    days: 90
    keepLatest: 10
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.artifacts?.registry).toBe('ghcr.io/my-org');
      expect(result.data?.artifacts?.type).toBe('docker');
      expect(result.data?.artifacts?.naming?.includeCommit).toBe(true);
      expect(result.data?.artifacts?.retention?.days).toBe(90);
    });

    it('should include response metadata with sources', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.resolvedAt).toBeDefined();
      expect(result.metadata?.sources).toContain('architecture/cicd.yaml');
    });

    it('should support cloud-agnostic custom fields via looseObject', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
steps:
  - name: build
    type: build
    required: true
customField: my-custom-value
orgSpecific:
  approvalTeam: platform-team
  slackChannel: "#deploys"
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.customField).toBe('my-custom-value');
      expect((data.orgSpecific as Record<string, unknown>)?.approvalTeam).toBe('platform-team');
    });
  });

  describe('Acceptance Scenario 2: Service-specific CI overrides', () => {
    it('should merge service CI overrides with global requirements', async () => {
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
testing:
  unitTests:
    required: true
    coverageThreshold: 80
`
      );
      await writeYaml(
        'services/order-service.yaml',
        `
name: order-service
type: api
deployment:
  pattern: lambda
cicd:
  steps:
    - name: build
      type: build
      required: true
    - name: test
      type: test
      required: true
    - name: integration-test
      type: test
      required: true
  testing:
    unitTests:
      required: true
      coverageThreshold: 90
`
      );

      const result = await getCIRequirements(
        { service_name: 'order-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      // Service overrides: steps replaced (array replace strategy)
      expect(result.data?.steps).toHaveLength(3);
      expect(result.data?.steps?.[2].name).toBe('integration-test');
      // Service overrides: coverage threshold 80 -> 90
      expect(result.data?.testing?.unitTests?.coverageThreshold).toBe(90);
      // Global preserved: provider not overridden by service
      expect(result.data?.provider).toBe('github-actions');
    });

    it('should return global requirements when service has no CI overrides', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
steps:
  - name: build
    type: build
    required: true
`
      );
      await writeYaml(
        'services/simple-service.yaml',
        `
name: simple-service
type: api
deployment:
  pattern: ecs_fargate
`
      );

      const result = await getCIRequirements(
        { service_name: 'simple-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      // No service CI overrides, so global is returned as-is
      expect(result.data?.provider).toBe('github-actions');
      expect(result.data?.steps).toHaveLength(1);
    });

    it('should include service in metadata sources when queried', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
`
      );
      await writeYaml(
        'services/my-service.yaml',
        `
name: my-service
type: api
deployment:
  pattern: lambda
`
      );

      const result = await getCIRequirements(
        { service_name: 'my-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.sources).toContain('architecture/cicd.yaml');
      expect(result.metadata?.sources).toContain('architecture/services/my-service.yaml');
    });
  });

  describe('Error handling', () => {
    it('should return helpful error when cicd.yaml not found', async () => {
      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('not found');
      expect(result.error?.message).toContain('arch init --repair');
    });

    it('should return error when service not found', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
`
      );

      const result = await getCIRequirements(
        { service_name: 'nonexistent-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });

    it('should return validation error for invalid cicd.yaml', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: invalid-provider-that-does-not-exist
steps: "not an array"
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });
  });

  describe('MCP result formatting', () => {
    it('should format successful result for MCP', async () => {
      await writeYaml(
        'cicd.yaml',
        `
provider: github-actions
steps:
  - name: build
    type: build
    required: true
sonarqube:
  enabled: true
  thresholds:
    coverage: 80
`
      );

      const result = await getCIRequirements({}, { baseDir: testDir });
      const mcpResult = formatMcpResult(result);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('github-actions');
      expect(mcpResult.structuredContent).toBeDefined();
      expect(mcpResult.structuredContent.success).toBe(true);
      expect(mcpResult.isError).toBeUndefined();
    });

    it('should format error result for MCP', async () => {
      const result = await getCIRequirements({}, { baseDir: testDir });
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
  - name: lint
    type: lint
    required: true
qualityGates:
  - name: coverage
    metric: coverage
    operator: gte
    threshold: 80
sonarqube:
  enabled: true
  thresholds:
    coverage: 80
security:
  enabled: true
  tools:
    - name: snyk
      type: sca
      required: true
branchStrategy:
  type: github-flow
  mainBranch: main
testing:
  unitTests:
    required: true
    coverageThreshold: 80
  integrationTests:
    required: true
`
      );

      const start = performance.now();
      await getCIRequirements({}, { baseDir: testDir });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
