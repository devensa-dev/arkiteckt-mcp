/**
 * Service Templates
 *
 * Smart default templates keyed by deployment pattern.
 * Used by scaffold_service tool to provide pattern-specific defaults.
 *
 * Templates are partial Service configs that get deep-merged with user input.
 */

import type { Service, DeploymentPattern } from '../schemas/service.schema.js';

/**
 * Template for Lambda (serverless function) services
 */
const lambdaTemplate: Partial<Service> = {
  deployment: {
    pattern: 'lambda',
    replicas: 1,
    strategy: 'rolling',
    autoScaling: {
      enabled: true,
      minReplicas: 1,
      maxReplicas: 10,
      targetCPU: 70,
    },
  },
  runtime: {
    language: 'nodejs',
    version: '20',
    entrypoint: 'index.handler',
  },
  resilience: {
    timeout: 30000,
    retry: {
      enabled: true,
      maxAttempts: 3,
      backoff: 'exponential',
    },
  },
  observability: {
    slo: {
      availability: 99.9,
      latencyP50: 100,
      latencyP99: 500,
      errorRate: 1,
    },
  },
};

/**
 * Template for ECS Fargate services
 */
const ecsFargateTemplate: Partial<Service> = {
  deployment: {
    pattern: 'ecs_fargate',
    replicas: 2,
    strategy: 'rolling',
    autoScaling: {
      enabled: true,
      minReplicas: 2,
      maxReplicas: 10,
      targetCPU: 70,
      targetMemory: 80,
    },
  },
  container: {
    port: 8080,
    healthCheck: {
      path: '/health',
      interval: 30,
      timeout: 5,
      retries: 3,
    },
    resources: {
      cpu: '256',
      memory: '512Mi',
    },
  },
  resilience: {
    timeout: 5000,
    circuitBreaker: {
      enabled: true,
      threshold: 5,
      timeout: 60000,
    },
    retry: {
      enabled: true,
      maxAttempts: 3,
      backoff: 'exponential',
    },
  },
  observability: {
    slo: {
      availability: 99.95,
      latencyP50: 50,
      latencyP99: 200,
      errorRate: 0.5,
    },
  },
};

/**
 * Template for Kubernetes services
 */
const kubernetesTemplate: Partial<Service> = {
  deployment: {
    pattern: 'kubernetes',
    replicas: 3,
    strategy: 'rolling',
    autoScaling: {
      enabled: true,
      minReplicas: 3,
      maxReplicas: 20,
      targetCPU: 70,
      targetMemory: 80,
    },
  },
  container: {
    port: 8080,
    healthCheck: {
      path: '/health',
      interval: 30,
      timeout: 5,
      retries: 3,
    },
    resources: {
      cpu: '500m',
      memory: '512Mi',
    },
  },
  resilience: {
    timeout: 5000,
    circuitBreaker: {
      enabled: true,
      threshold: 5,
      timeout: 60000,
    },
    retry: {
      enabled: true,
      maxAttempts: 3,
      backoff: 'exponential',
    },
    bulkhead: {
      enabled: true,
      maxConcurrent: 100,
      maxQueue: 50,
    },
  },
  observability: {
    slo: {
      availability: 99.99,
      latencyP50: 50,
      latencyP99: 200,
      errorRate: 0.1,
    },
  },
};

/**
 * Template for generic container services
 */
const containerTemplate: Partial<Service> = {
  deployment: {
    pattern: 'container',
    replicas: 2,
    strategy: 'rolling',
    autoScaling: {
      enabled: false,
    },
  },
  container: {
    port: 8080,
    healthCheck: {
      path: '/health',
      interval: 30,
      timeout: 5,
      retries: 3,
    },
    resources: {
      cpu: '256',
      memory: '512Mi',
    },
  },
  resilience: {
    timeout: 5000,
    retry: {
      enabled: true,
      maxAttempts: 3,
      backoff: 'fixed',
    },
  },
  observability: {
    slo: {
      availability: 99.9,
      latencyP50: 100,
      latencyP99: 500,
      errorRate: 1,
    },
  },
};

/**
 * Service template registry
 * Maps deployment pattern to template
 */
export const serviceTemplates: Record<DeploymentPattern, Partial<Service>> = {
  lambda: lambdaTemplate,
  ecs_fargate: ecsFargateTemplate,
  ecs_ec2: ecsFargateTemplate, // Similar to Fargate
  ec2: containerTemplate, // Similar to generic container
  kubernetes: kubernetesTemplate,
  container: containerTemplate,
  static: {
    // Static sites have minimal config
    deployment: {
      pattern: 'static',
      replicas: 1,
    },
    observability: {
      slo: {
        availability: 99.99,
        latencyP50: 20,
        latencyP99: 100,
        errorRate: 0.1,
      },
    },
  },
};

/**
 * Get service template for a deployment pattern
 */
export function getServiceTemplate(pattern: DeploymentPattern): Partial<Service> {
  return serviceTemplates[pattern] || containerTemplate;
}
