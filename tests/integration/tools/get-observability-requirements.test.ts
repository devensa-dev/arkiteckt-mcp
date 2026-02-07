/**
 * Integration Tests: get_observability_requirements MCP Tool (T063)
 *
 * User Story 6: AI Queries Observability Requirements (Priority: P2)
 *
 * Acceptance Scenarios:
 * 1. Given observability standards in observability.yaml,
 *    When AI calls get_observability_requirements,
 *    Then MCP returns logging format (structured-json), metrics backend (prometheus),
 *    and tracing standard (open-telemetry).
 * 2. Given a service with custom observability profile,
 *    When AI queries for that service,
 *    Then service-specific overrides are returned.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getObservabilityRequirements,
  formatMcpResult,
} from '../../../src/server/tools/read/get-observability-requirements.js';

describe('get_observability_requirements MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `get-obs-req-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

  describe('Acceptance Scenario 1: Retrieve observability configuration', () => {
    it('should return logging configuration with structured-json format', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
  level: info
  retention:
    days: 30
  fields:
    required:
      - requestId
      - timestamp
      - level
    sensitive:
      - password
      - token
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.logging?.format).toBe('structured-json');
      expect(result.data?.logging?.level).toBe('info');
      expect(result.data?.logging?.retention?.days).toBe(30);
      expect(result.data?.logging?.fields?.required).toContain('requestId');
      expect(result.data?.logging?.fields?.sensitive).toContain('password');
    });

    it('should return metrics configuration with prometheus backend', async () => {
      await writeYaml(
        'observability.yaml',
        `
metrics:
  backend: prometheus
  endpoint: /metrics
  port: 9090
  labels:
    team: platform
    env: prod
  required:
    - name: http_requests_total
      type: counter
      description: Total HTTP requests
    - name: http_request_duration_seconds
      type: histogram
      description: Request latency
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.metrics?.backend).toBe('prometheus');
      expect(result.data?.metrics?.endpoint).toBe('/metrics');
      expect(result.data?.metrics?.port).toBe(9090);
      expect(result.data?.metrics?.labels?.team).toBe('platform');
      expect(result.data?.metrics?.required).toHaveLength(2);
      expect(result.data?.metrics?.required?.[0].name).toBe('http_requests_total');
      expect(result.data?.metrics?.required?.[0].type).toBe('counter');
    });

    it('should return tracing configuration with open-telemetry', async () => {
      await writeYaml(
        'observability.yaml',
        `
tracing:
  backend: open-telemetry
  enabled: true
  samplingRate: 0.1
  propagation:
    - w3c
    - b3
  endpoint: https://otel-collector:4317
  attributes:
    service.namespace: my-platform
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.tracing?.backend).toBe('open-telemetry');
      expect(result.data?.tracing?.enabled).toBe(true);
      expect(result.data?.tracing?.samplingRate).toBe(0.1);
      expect(result.data?.tracing?.propagation).toContain('w3c');
      expect(result.data?.tracing?.propagation).toContain('b3');
      expect(result.data?.tracing?.endpoint).toBe('https://otel-collector:4317');
    });

    it('should return alerting configuration', async () => {
      await writeYaml(
        'observability.yaml',
        `
alerting:
  enabled: true
  channels:
    - name: ops-slack
      type: slack
      target: "#ops-alerts"
      severity:
        - critical
        - page
    - name: ops-pagerduty
      type: pagerduty
      target: PXXXXXX
  rules:
    - name: high-error-rate
      condition: "error_rate > 5%"
      severity: critical
      description: Error rate exceeds 5%
      runbook: https://wiki.example.com/runbooks/high-error-rate
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.alerting?.enabled).toBe(true);
      expect(result.data?.alerting?.channels).toHaveLength(2);
      expect(result.data?.alerting?.channels?.[0].name).toBe('ops-slack');
      expect(result.data?.alerting?.channels?.[0].type).toBe('slack');
      expect(result.data?.alerting?.channels?.[0].severity).toContain('critical');
      expect(result.data?.alerting?.rules).toHaveLength(1);
      expect(result.data?.alerting?.rules?.[0].name).toBe('high-error-rate');
      expect(result.data?.alerting?.rules?.[0].severity).toBe('critical');
    });

    it('should return SLO definitions', async () => {
      await writeYaml(
        'observability.yaml',
        `
slos:
  - name: api-availability
    description: API must be available 99.9% of the time
    sli:
      type: availability
      metric: http_success_rate
      threshold: 99.9
      comparison: gte
    target: 99.9
    window:
      type: rolling
      duration: 30d
    burnRate:
      fast: 14.4
      slow: 1
  - name: api-latency
    sli:
      type: latency
      metric: http_request_duration_p99
      threshold: 500
      comparison: lte
    target: 99
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.slos).toHaveLength(2);
      expect(result.data?.slos?.[0].name).toBe('api-availability');
      expect(result.data?.slos?.[0].sli.type).toBe('availability');
      expect(result.data?.slos?.[0].target).toBe(99.9);
      expect(result.data?.slos?.[0].window?.type).toBe('rolling');
      expect(result.data?.slos?.[0].burnRate?.fast).toBe(14.4);
      expect(result.data?.slos?.[1].name).toBe('api-latency');
      expect(result.data?.slos?.[1].sli.type).toBe('latency');
    });

    it('should return DORA metrics configuration', async () => {
      await writeYaml(
        'observability.yaml',
        `
dora:
  enabled: true
  deploymentFrequency:
    enabled: true
    source: github-actions
  leadTime:
    enabled: true
    measureFrom: pr-merge
  changeFailureRate:
    enabled: true
    failureIndicators:
      - rollback
      - hotfix
  mttr:
    enabled: true
    incidentSource: pagerduty
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.dora?.enabled).toBe(true);
      expect(result.data?.dora?.deploymentFrequency?.source).toBe('github-actions');
      expect(result.data?.dora?.leadTime?.measureFrom).toBe('pr-merge');
      expect(result.data?.dora?.changeFailureRate?.failureIndicators).toContain('rollback');
      expect(result.data?.dora?.mttr?.incidentSource).toBe('pagerduty');
    });

    it('should return full observability config with all sections', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
  level: info
metrics:
  backend: prometheus
tracing:
  backend: open-telemetry
  enabled: true
alerting:
  enabled: true
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.data?.logging?.format).toBe('structured-json');
      expect(result.data?.metrics?.backend).toBe('prometheus');
      expect(result.data?.tracing?.backend).toBe('open-telemetry');
      expect(result.data?.alerting?.enabled).toBe(true);
    });

    it('should include response metadata with sources', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.resolvedAt).toBeDefined();
      expect(result.metadata?.sources).toContain('architecture/observability.yaml');
    });

    it('should support cloud-agnostic custom fields via looseObject', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
metrics:
  backend: prometheus
customDashboard: https://grafana.example.com/d/platform
vendor:
  datadogApiKeyRef: DD_API_KEY
  newRelicAccountId: "12345"
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.customDashboard).toBe('https://grafana.example.com/d/platform');
      expect((data.vendor as Record<string, unknown>)?.datadogApiKeyRef).toBe('DD_API_KEY');
    });
  });

  describe('Acceptance Scenario 2: Service-specific observability overrides', () => {
    it('should merge service observability overrides with global', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
  level: info
metrics:
  backend: prometheus
tracing:
  backend: open-telemetry
  samplingRate: 0.1
`
      );
      await writeYaml(
        'services/order-service.yaml',
        `
name: order-service
type: api
deployment:
  pattern: lambda
observability:
  customMetrics:
    - order_created_total
    - order_processing_duration
  slo:
    availability: 99.95
    latencyP99: 200
`
      );

      const result = await getObservabilityRequirements(
        { service_name: 'order-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      // Global preserved
      expect(result.data?.logging?.format).toBe('structured-json');
      expect(result.data?.metrics?.backend).toBe('prometheus');
      expect(result.data?.tracing?.backend).toBe('open-telemetry');
      // Service overrides applied
      const data = result.data as Record<string, unknown>;
      expect(data.customMetrics).toContain('order_created_total');
      expect(data.slo).toBeDefined();
    });

    it('should resolve named profile from global profiles', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
  level: info
metrics:
  backend: prometheus
tracing:
  backend: open-telemetry
  samplingRate: 0.1
profiles:
  high-throughput:
    name: high-throughput
    logging:
      level: warn
      sampling:
        enabled: true
        rate: 0.5
    tracing:
      samplingRate: 0.01
`
      );
      await writeYaml(
        'services/event-processor.yaml',
        `
name: event-processor
type: worker
deployment:
  pattern: ecs_fargate
observability:
  profile: high-throughput
`
      );

      const result = await getObservabilityRequirements(
        { service_name: 'event-processor' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      // Profile overrides: logging level info -> warn
      expect(result.data?.logging?.level).toBe('warn');
      // Profile overrides: tracing samplingRate 0.1 -> 0.01
      expect(result.data?.tracing?.samplingRate).toBe(0.01);
      // Global preserved: metrics backend not in profile
      expect(result.data?.metrics?.backend).toBe('prometheus');
      // Global preserved: logging format not in profile
      expect(result.data?.logging?.format).toBe('structured-json');
    });

    it('should return global when service has no observability overrides', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
metrics:
  backend: prometheus
`
      );
      await writeYaml(
        'services/simple-service.yaml',
        `
name: simple-service
type: api
deployment:
  pattern: lambda
`
      );

      const result = await getObservabilityRequirements(
        { service_name: 'simple-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.logging?.format).toBe('structured-json');
      expect(result.data?.metrics?.backend).toBe('prometheus');
    });

    it('should include service in metadata sources when queried', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
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

      const result = await getObservabilityRequirements(
        { service_name: 'my-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.sources).toContain('architecture/observability.yaml');
      expect(result.metadata?.sources).toContain('architecture/services/my-service.yaml');
    });
  });

  describe('Error handling', () => {
    it('should return helpful error when observability.yaml not found', async () => {
      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('not found');
      expect(result.error?.message).toContain('arch init --repair');
    });

    it('should return error when service not found', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
`
      );

      const result = await getObservabilityRequirements(
        { service_name: 'nonexistent-service' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });

    it('should return validation error for invalid observability YAML', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: invalid-format-that-does-not-exist
  level: 12345
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });
  });

  describe('MCP result formatting', () => {
    it('should format successful result for MCP', async () => {
      await writeYaml(
        'observability.yaml',
        `
logging:
  format: structured-json
metrics:
  backend: prometheus
tracing:
  backend: open-telemetry
`
      );

      const result = await getObservabilityRequirements({}, { baseDir: testDir });
      const mcpResult = formatMcpResult(result);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('structured-json');
      expect(mcpResult.content[0].text).toContain('prometheus');
      expect(mcpResult.structuredContent).toBeDefined();
      expect(mcpResult.structuredContent.success).toBe(true);
      expect(mcpResult.isError).toBeUndefined();
    });

    it('should format error result for MCP', async () => {
      const result = await getObservabilityRequirements({}, { baseDir: testDir });
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
        'observability.yaml',
        `
logging:
  format: structured-json
  level: info
  retention:
    days: 30
metrics:
  backend: prometheus
  required:
    - name: http_requests_total
      type: counter
    - name: http_request_duration_seconds
      type: histogram
tracing:
  backend: open-telemetry
  enabled: true
  samplingRate: 0.1
alerting:
  enabled: true
  channels:
    - name: ops
      type: slack
      target: "#alerts"
slos:
  - name: availability
    sli:
      type: availability
      metric: success_rate
      threshold: 99.9
    target: 99.9
dora:
  enabled: true
`
      );

      const start = performance.now();
      await getObservabilityRequirements({}, { baseDir: testDir });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
