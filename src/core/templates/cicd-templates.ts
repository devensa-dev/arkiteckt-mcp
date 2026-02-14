/**
 * CI/CD Templates
 *
 * Smart default templates keyed by CI/CD provider.
 * Used by scaffold tools to provide provider-specific pipeline defaults.
 *
 * Templates are partial CICD configs that get deep-merged with user input.
 */

import type { CICD, PipelineProvider } from '../schemas/cicd.schema.js';

/**
 * Template for GitHub Actions
 */
const githubActionsTemplate: Partial<CICD> = {
  provider: 'github-actions',
  steps: [
    {
      name: 'Checkout code',
      type: 'build',
      required: true,
      order: 1,
    },
    {
      name: 'Install dependencies',
      type: 'build',
      required: true,
      order: 2,
    },
    {
      name: 'Lint code',
      type: 'lint',
      required: true,
      order: 3,
    },
    {
      name: 'Run unit tests',
      type: 'test',
      required: true,
      order: 4,
    },
    {
      name: 'Build application',
      type: 'build',
      required: true,
      order: 5,
    },
    {
      name: 'Security scan',
      type: 'security',
      required: true,
      order: 6,
    },
    {
      name: 'Build and push container',
      type: 'build',
      required: false,
      order: 7,
      condition: 'deployment.pattern == "container" || deployment.pattern == "kubernetes"',
    },
    {
      name: 'Deploy to environment',
      type: 'deploy',
      required: true,
      order: 8,
    },
  ],
  qualityGates: [
    {
      name: 'Test coverage threshold',
      enabled: true,
      metric: 'code_coverage',
      operator: 'gte',
      threshold: 80,
      failOnViolation: true,
    },
    {
      name: 'No high severity vulnerabilities',
      enabled: true,
      metric: 'security_high_severity',
      operator: 'eq',
      threshold: 0,
      failOnViolation: true,
    },
  ],
  security: {
    enabled: true,
    tools: [
      {
        name: 'dependency-check',
        type: 'sca',
        required: true,
      },
      {
        name: 'semgrep',
        type: 'sast',
        required: true,
      },
      {
        name: 'trivy',
        type: 'container',
        required: false,
      },
    ],
    failOnCritical: true,
    failOnHigh: false,
  },
  testing: {
    unitTests: {
      required: true,
      coverageThreshold: 80,
    },
    integrationTests: {
      required: true,
      environments: ['dev', 'staging'],
    },
    e2eTests: {
      required: false,
      environments: ['staging'],
    },
  },
  branchStrategy: {
    type: 'github-flow',
    mainBranch: 'main',
    featurePrefix: 'feature/',
    protectedBranches: ['main', 'production'],
  },
};

/**
 * Template for GitLab CI
 */
const gitlabCiTemplate: Partial<CICD> = {
  provider: 'gitlab-ci',
  steps: [
    {
      name: 'Install dependencies',
      type: 'build',
      required: true,
      order: 1,
    },
    {
      name: 'Lint',
      type: 'lint',
      required: true,
      order: 2,
    },
    {
      name: 'Test',
      type: 'test',
      required: true,
      order: 3,
    },
    {
      name: 'Build',
      type: 'build',
      required: true,
      order: 4,
    },
    {
      name: 'Security scan',
      type: 'security',
      required: true,
      order: 5,
    },
    {
      name: 'Deploy',
      type: 'deploy',
      required: true,
      order: 6,
    },
  ],
  qualityGates: [
    {
      name: 'Test coverage',
      enabled: true,
      metric: 'code_coverage',
      operator: 'gte',
      threshold: 80,
      failOnViolation: true,
    },
  ],
  security: {
    enabled: true,
    tools: [
      {
        name: 'dependency-scanning',
        type: 'sca',
        required: true,
      },
      {
        name: 'sast',
        type: 'sast',
        required: true,
      },
      {
        name: 'container-scanning',
        type: 'container',
        required: false,
      },
    ],
    failOnCritical: true,
    failOnHigh: false,
  },
  testing: {
    unitTests: {
      required: true,
      coverageThreshold: 80,
    },
    integrationTests: {
      required: true,
    },
  },
  branchStrategy: {
    type: 'gitlab-flow',
    mainBranch: 'main',
    developBranch: 'develop',
    featurePrefix: 'feature/',
    protectedBranches: ['main', 'develop'],
  },
};

/**
 * Template for Jenkins
 */
const jenkinsTemplate: Partial<CICD> = {
  provider: 'jenkins',
  steps: [
    {
      name: 'Checkout',
      type: 'build',
      required: true,
      order: 1,
    },
    {
      name: 'Build',
      type: 'build',
      required: true,
      order: 2,
    },
    {
      name: 'Test',
      type: 'test',
      required: true,
      order: 3,
    },
    {
      name: 'Quality Gate',
      type: 'quality',
      required: true,
      order: 4,
    },
    {
      name: 'Deploy',
      type: 'deploy',
      required: true,
      order: 5,
    },
  ],
  sonarqube: {
    enabled: true,
    qualityGate: 'default',
    thresholds: {
      coverage: 80,
      duplications: 3,
      maintainabilityRating: 'A',
      reliabilityRating: 'A',
      securityRating: 'A',
    },
  },
  testing: {
    unitTests: {
      required: true,
      coverageThreshold: 80,
    },
    integrationTests: {
      required: true,
    },
  },
  branchStrategy: {
    type: 'gitflow',
    mainBranch: 'master',
    developBranch: 'develop',
    featurePrefix: 'feature/',
    releasePrefix: 'release/',
    hotfixPrefix: 'hotfix/',
    protectedBranches: ['master', 'develop'],
  },
};

/**
 * CI/CD template registry
 * Maps provider to template
 */
export const cicdTemplates: Record<PipelineProvider, Partial<CICD>> = {
  'github-actions': githubActionsTemplate,
  'gitlab-ci': gitlabCiTemplate,
  jenkins: jenkinsTemplate,
  circleci: githubActionsTemplate, // Similar to GitHub Actions
  'azure-devops': githubActionsTemplate, // Similar to GitHub Actions
  'aws-codepipeline': githubActionsTemplate, // Similar to GitHub Actions
  'bitbucket-pipelines': gitlabCiTemplate, // Similar to GitLab CI
  tekton: jenkinsTemplate, // Similar to Jenkins
  'argo-workflows': jenkinsTemplate, // Similar to Jenkins
};

/**
 * Get CI/CD template for a provider
 */
export function getCICDTemplate(provider: PipelineProvider): Partial<CICD> {
  return cicdTemplates[provider] || githubActionsTemplate;
}

/**
 * Get deployment stages for a provider
 */
export function getDeploymentStages(provider: PipelineProvider) {
  return [
    {
      name: 'dev',
      environment: 'dev',
      strategy: 'rolling' as const,
      manual: false,
      rollback: {
        automatic: true,
        onFailure: true,
      },
    },
    {
      name: 'staging',
      environment: 'staging',
      strategy: 'blue-green' as const,
      manual: false,
      gates: {
        preDeployment: ['run-integration-tests'],
        postDeployment: ['smoke-tests'],
      },
      rollback: {
        automatic: true,
        onFailure: true,
      },
    },
    {
      name: 'prod',
      environment: 'prod',
      strategy: 'canary' as const,
      manual: true,
      gates: {
        preDeployment: ['run-e2e-tests', 'security-check'],
        postDeployment: ['smoke-tests', 'monitoring-check'],
      },
      rollback: {
        automatic: true,
        onFailure: true,
      },
    },
  ];
}
