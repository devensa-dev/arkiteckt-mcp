/**
 * Service Schema
 *
 * Individual service definition including runtime, container configuration,
 * dependencies, deployment pattern, and observability profile.
 *
 * The deployment.pattern field is CRITICAL for determining what artifacts
 * need to be generated (FR-011 from spec).
 */

import { z } from 'zod';

/**
 * Deployment patterns supported by the system
 * Each pattern requires different infrastructure artifacts
 */
export const DeploymentPatternSchema = z.enum([
  'lambda',
  'ecs_fargate',
  'ecs_ec2',
  'ec2',
  'kubernetes',
  'container',
  'static',
]);

/**
 * Service type classification
 */
export const ServiceTypeSchema = z.enum([
  'api',
  'worker',
  'scheduled',
  'event-processor',
  'frontend',
  'backend',
  'library',
  'infrastructure',
]);

/**
 * Dependency configuration for a service
 */
export const DependencySchema = z.looseObject({
  name: z.string().describe('Dependency service name'),
  type: z.enum(['sync', 'async', 'optional']).default('sync'),
  protocol: z.string().optional().describe('Communication protocol (http, grpc, amqp, etc.)'),
  version: z.string().optional().describe('Required version constraint'),
});

/**
 * Container configuration for containerized services
 */
export const ContainerConfigSchema = z.looseObject({
  image: z.string().optional().describe('Base image or registry path'),
  port: z.number().int().positive().optional().describe('Primary container port'),
  healthCheck: z
    .looseObject({
      path: z.string().default('/health'),
      port: z.number().int().positive().optional(),
      interval: z.number().int().positive().default(30),
      timeout: z.number().int().positive().default(5),
      retries: z.number().int().positive().default(3),
    })
    .optional(),
  resources: z
    .looseObject({
      cpu: z.string().optional().describe('CPU allocation (e.g., "256", "0.5")'),
      memory: z.string().optional().describe('Memory allocation (e.g., "512Mi", "1Gi")'),
    })
    .optional(),
});

/**
 * Runtime configuration for the service
 */
export const ServiceRuntimeSchema = z.looseObject({
  language: z.string().describe('Programming language'),
  version: z.string().optional().describe('Language version'),
  framework: z.string().optional().describe('Framework (express, fastify, spring, etc.)'),
  entrypoint: z.string().optional().describe('Entry point file/module'),
});

/**
 * Deployment configuration
 */
export const DeploymentConfigSchema = z.looseObject({
  pattern: DeploymentPatternSchema.describe('Deployment pattern determining infrastructure artifacts'),
  replicas: z.number().int().positive().optional().describe('Number of replicas'),
  strategy: z.enum(['rolling', 'blue-green', 'canary']).optional(),
  autoScaling: z
    .looseObject({
      enabled: z.boolean().default(false),
      minReplicas: z.number().int().positive().optional(),
      maxReplicas: z.number().int().positive().optional(),
      targetCPU: z.number().int().min(1).max(100).optional(),
      targetMemory: z.number().int().min(1).max(100).optional(),
    })
    .optional(),
});

/**
 * Resilience patterns for enterprise requirements (FR-019)
 */
export const ResilienceSchema = z.looseObject({
  circuitBreaker: z
    .looseObject({
      enabled: z.boolean().default(false),
      threshold: z.number().int().positive().optional(),
      timeout: z.number().int().positive().optional(),
    })
    .optional(),
  retry: z
    .looseObject({
      enabled: z.boolean().default(false),
      maxAttempts: z.number().int().positive().optional(),
      backoff: z.enum(['fixed', 'exponential']).optional(),
    })
    .optional(),
  timeout: z.number().int().positive().optional().describe('Request timeout in ms'),
  bulkhead: z
    .looseObject({
      enabled: z.boolean().default(false),
      maxConcurrent: z.number().int().positive().optional(),
      maxQueue: z.number().int().positive().optional(),
    })
    .optional(),
});

/**
 * Service observability profile reference
 */
export const ServiceObservabilitySchema = z.looseObject({
  profile: z.string().optional().describe('Reference to observability profile'),
  customMetrics: z.array(z.string()).optional(),
  customAlerts: z.array(z.string()).optional(),
  slo: z
    .looseObject({
      availability: z.number().min(0).max(100).optional().describe('Target availability percentage'),
      latencyP50: z.number().int().positive().optional().describe('P50 latency target in ms'),
      latencyP99: z.number().int().positive().optional().describe('P99 latency target in ms'),
      errorRate: z.number().min(0).max(100).optional().describe('Max error rate percentage'),
    })
    .optional(),
});

/**
 * Service Schema - Individual service definition
 */
export const ServiceSchema = z.looseObject({
  // Schema version for migrations
  schemaVersion: z.string().default('1.0.0'),

  // Core identification
  name: z.string().min(1).describe('Service name'),
  description: z.string().optional().describe('Service description'),
  type: ServiceTypeSchema.optional().describe('Service type classification'),

  // Runtime configuration
  runtime: ServiceRuntimeSchema.optional(),

  // Container configuration (for containerized deployments)
  container: ContainerConfigSchema.optional(),

  // Deployment configuration (CRITICAL: includes pattern field)
  deployment: DeploymentConfigSchema.describe('Deployment configuration with pattern'),

  // Dependencies on other services
  dependencies: z.array(DependencySchema).optional(),

  // Resilience patterns (FR-019)
  resilience: ResilienceSchema.optional(),

  // Observability configuration
  observability: ServiceObservabilitySchema.optional(),

  // Environment-specific overrides (keyed by environment name)
  environments: z
    .record(
      z.string(),
      z.looseObject({
        deployment: DeploymentConfigSchema.partial().optional(),
        container: ContainerConfigSchema.partial().optional(),
        runtime: ServiceRuntimeSchema.partial().optional(),
      })
    )
    .optional(),

  // Team/ownership
  owner: z.string().optional().describe('Team or person responsible'),

  // Metadata
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type DeploymentPattern = z.infer<typeof DeploymentPatternSchema>;
export type ServiceType = z.infer<typeof ServiceTypeSchema>;
export type Dependency = z.infer<typeof DependencySchema>;
export type ContainerConfig = z.infer<typeof ContainerConfigSchema>;
export type ServiceRuntime = z.infer<typeof ServiceRuntimeSchema>;
export type DeploymentConfig = z.infer<typeof DeploymentConfigSchema>;
export type Resilience = z.infer<typeof ResilienceSchema>;
export type ServiceObservability = z.infer<typeof ServiceObservabilitySchema>;
export type Service = z.infer<typeof ServiceSchema>;
