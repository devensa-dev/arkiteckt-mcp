import { describe, it, expect } from 'vitest';
import {
  CICDSchema,
  PipelineProviderSchema,
  PipelineStepSchema,
  QualityGateSchema,
  DeploymentStageSchema,
  BranchStrategySchema,
} from '../../../src/core/schemas/cicd.schema.js';

describe('CICDSchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal CI/CD config', () => {
      const input = {};

      const result = CICDSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schemaVersion).toBe('1.0.0');
      }
    });

    it('should validate a full CI/CD config', () => {
      const input = {
        provider: 'github-actions',
        steps: [
          { name: 'build', type: 'build', required: true },
          { name: 'test', type: 'test', required: true },
          { name: 'lint', type: 'lint', required: true },
          { name: 'deploy', type: 'deploy', required: true },
        ],
        qualityGates: [
          {
            name: 'coverage',
            enabled: true,
            metric: 'coverage',
            operator: 'gte',
            threshold: 80,
          },
        ],
        sonarqube: {
          enabled: true,
          serverUrl: 'https://sonar.example.com',
          thresholds: {
            coverage: 80,
            maintainabilityRating: 'A',
          },
        },
        security: {
          enabled: true,
          tools: [
            { name: 'snyk', type: 'sca', required: true },
            { name: 'trivy', type: 'container', required: true },
          ],
          failOnCritical: true,
        },
        deploymentStages: [
          { name: 'dev', environment: 'dev', strategy: 'rolling' },
          { name: 'staging', environment: 'staging', strategy: 'blue-green' },
          { name: 'prod', environment: 'prod', strategy: 'canary', manual: true },
        ],
        branchStrategy: {
          type: 'github-flow',
          mainBranch: 'main',
          protectedBranches: ['main', 'develop'],
        },
        testing: {
          unitTests: { required: true, coverageThreshold: 80 },
          integrationTests: { required: true },
          e2eTests: { required: false },
        },
      };

      const result = CICDSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('github-actions');
        expect(result.data.steps?.length).toBe(4);
        expect(result.data.deploymentStages?.length).toBe(3);
      }
    });
  });
});

describe('PipelineProviderSchema', () => {
  it('should validate all providers', () => {
    const providers = [
      'github-actions',
      'gitlab-ci',
      'jenkins',
      'circleci',
      'azure-devops',
      'aws-codepipeline',
      'bitbucket-pipelines',
      'tekton',
      'argo-workflows',
    ];
    providers.forEach((provider) => {
      const result = PipelineProviderSchema.safeParse(provider);
      expect(result.success).toBe(true);
    });
  });
});

describe('PipelineStepSchema', () => {
  it('should validate a pipeline step', () => {
    const input = {
      name: 'build',
      type: 'build',
      required: true,
      command: 'npm run build',
      timeout: 10,
    };

    const result = PipelineStepSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate all step types', () => {
    const types = ['build', 'test', 'lint', 'security', 'quality', 'deploy', 'custom'];
    types.forEach((type) => {
      const result = PipelineStepSchema.safeParse({ name: 'step', type });
      expect(result.success).toBe(true);
    });
  });
});

describe('QualityGateSchema', () => {
  it('should validate a quality gate', () => {
    const input = {
      name: 'coverage',
      metric: 'coverage',
      operator: 'gte',
      threshold: 80,
    };

    const result = QualityGateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate all operators', () => {
    const operators = ['lt', 'lte', 'gt', 'gte', 'eq'];
    operators.forEach((operator) => {
      const result = QualityGateSchema.safeParse({
        name: 'test',
        metric: 'test',
        operator,
        threshold: 1,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('DeploymentStageSchema', () => {
  it('should validate deployment strategies', () => {
    const strategies = ['rolling', 'blue-green', 'canary', 'recreate'];
    strategies.forEach((strategy) => {
      const result = DeploymentStageSchema.safeParse({
        name: 'stage',
        environment: 'env',
        strategy,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('BranchStrategySchema', () => {
  it('should apply defaults', () => {
    const result = BranchStrategySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('github-flow');
      expect(result.data.mainBranch).toBe('main');
      expect(result.data.featurePrefix).toBe('feature/');
    }
  });

  it('should validate all branch strategy types', () => {
    const types = ['gitflow', 'github-flow', 'trunk-based', 'custom'];
    types.forEach((type) => {
      const result = BranchStrategySchema.safeParse({ type });
      expect(result.success).toBe(true);
    });
  });
});
