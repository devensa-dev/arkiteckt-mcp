/**
 * Observability Schema
 *
 * Observability standards including logging format, metrics backend,
 * and tracing configuration. Supports SLO/SLI definitions (FR-021).
 */

import { z } from 'zod';

/**
 * Logging configuration
 */
export const LoggingSchema = z.looseObject({
  format: z.enum(['structured-json', 'text', 'json', 'logfmt']).default('structured-json'),
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  destination: z.string().optional().describe('Log destination (stdout, cloudwatch, etc.)'),
  retention: z
    .looseObject({
      days: z.number().int().positive().default(30),
      archiveDays: z.number().int().positive().optional(),
    })
    .optional(),
  fields: z
    .looseObject({
      required: z.array(z.string()).optional().describe('Required fields in every log'),
      sensitive: z.array(z.string()).optional().describe('Fields to mask/redact'),
    })
    .optional(),
  sampling: z
    .looseObject({
      enabled: z.boolean().default(false),
      rate: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

/**
 * Metrics configuration
 */
export const MetricsSchema = z.looseObject({
  backend: z.enum(['prometheus', 'cloudwatch', 'datadog', 'newrelic', 'grafana', 'custom']).default('prometheus'),
  endpoint: z.string().optional().describe('Metrics endpoint path'),
  port: z.number().int().positive().optional().describe('Metrics port'),
  pushInterval: z.number().int().positive().optional().describe('Push interval in seconds'),
  labels: z.record(z.string(), z.string()).optional().describe('Default labels for all metrics'),
  required: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['counter', 'gauge', 'histogram', 'summary']),
        description: z.string().optional(),
      })
    )
    .optional()
    .describe('Required metrics for all services'),
});

/**
 * Tracing configuration
 */
export const TracingSchema = z.looseObject({
  backend: z.enum(['open-telemetry', 'jaeger', 'zipkin', 'xray', 'datadog', 'custom']).default('open-telemetry'),
  enabled: z.boolean().default(true),
  samplingRate: z.number().min(0).max(1).default(1),
  propagation: z.array(z.enum(['w3c', 'b3', 'jaeger', 'xray'])).optional(),
  endpoint: z.string().optional().describe('Collector endpoint'),
  attributes: z.record(z.string(), z.string()).optional().describe('Default span attributes'),
});

/**
 * Alerting configuration
 */
export const AlertingSchema = z.looseObject({
  enabled: z.boolean().default(true),
  channels: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['slack', 'pagerduty', 'email', 'webhook', 'opsgenie', 'sns']),
        target: z.string().describe('Channel target (URL, email, ARN, etc.)'),
        severity: z.array(z.enum(['info', 'warning', 'critical', 'page'])).optional(),
      })
    )
    .optional(),
  rules: z
    .array(
      z.object({
        name: z.string(),
        condition: z.string().describe('Alert condition expression'),
        severity: z.enum(['info', 'warning', 'critical', 'page']),
        description: z.string().optional(),
        runbook: z.string().optional().describe('Runbook URL'),
      })
    )
    .optional(),
});

/**
 * SLO/SLI definitions (FR-021)
 */
export const SLOSchema = z.looseObject({
  name: z.string(),
  description: z.string().optional(),
  sli: z.object({
    type: z.enum(['availability', 'latency', 'throughput', 'error-rate', 'custom']),
    metric: z.string().describe('Metric query or expression'),
    threshold: z.number().describe('Threshold value'),
    comparison: z.enum(['lt', 'lte', 'gt', 'gte', 'eq']).default('gte'),
  }),
  target: z.number().min(0).max(100).describe('SLO target percentage'),
  window: z
    .object({
      type: z.enum(['rolling', 'calendar']),
      duration: z.string().describe('Window duration (e.g., "30d", "1w")'),
    })
    .optional(),
  burnRate: z
    .object({
      fast: z.number().optional(),
      slow: z.number().optional(),
    })
    .optional(),
});

/**
 * DORA metrics tracking (FR-022)
 */
export const DORAMetricsSchema = z.looseObject({
  enabled: z.boolean().default(false),
  deploymentFrequency: z
    .object({
      enabled: z.boolean().default(true),
      source: z.string().optional().describe('Deployment event source'),
    })
    .optional(),
  leadTime: z
    .object({
      enabled: z.boolean().default(true),
      measureFrom: z.enum(['commit', 'pr-open', 'pr-merge']).default('commit'),
    })
    .optional(),
  changeFailureRate: z
    .object({
      enabled: z.boolean().default(true),
      failureIndicators: z.array(z.string()).optional(),
    })
    .optional(),
  mttr: z
    .object({
      enabled: z.boolean().default(true),
      incidentSource: z.string().optional(),
    })
    .optional(),
});

/**
 * Observability profile - can be referenced by services
 */
export const ObservabilityProfileSchema = z.looseObject({
  schemaVersion: z.string().default('1.0.0'),
  name: z.string().min(1).describe('Profile name'),
  description: z.string().optional(),

  logging: LoggingSchema.optional(),
  metrics: MetricsSchema.optional(),
  tracing: TracingSchema.optional(),
  alerting: AlertingSchema.optional(),
  slos: z.array(SLOSchema).optional(),
  dora: DORAMetricsSchema.optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Observability Schema - Global observability standards
 */
export const ObservabilitySchema = z.looseObject({
  schemaVersion: z.string().default('1.0.0'),

  // Default logging configuration
  logging: LoggingSchema.optional(),

  // Default metrics configuration
  metrics: MetricsSchema.optional(),

  // Default tracing configuration
  tracing: TracingSchema.optional(),

  // Alerting configuration
  alerting: AlertingSchema.optional(),

  // Global SLOs
  slos: z.array(SLOSchema).optional(),

  // DORA metrics tracking
  dora: DORAMetricsSchema.optional(),

  // Named profiles for different service types
  profiles: z.record(z.string(), ObservabilityProfileSchema).optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
export type Logging = z.infer<typeof LoggingSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type Tracing = z.infer<typeof TracingSchema>;
export type Alerting = z.infer<typeof AlertingSchema>;
export type SLO = z.infer<typeof SLOSchema>;
export type DORAMetrics = z.infer<typeof DORAMetricsSchema>;
export type ObservabilityProfile = z.infer<typeof ObservabilityProfileSchema>;
export type Observability = z.infer<typeof ObservabilitySchema>;
