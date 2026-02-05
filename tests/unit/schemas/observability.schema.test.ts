import { describe, it, expect } from 'vitest';
import {
  ObservabilitySchema,
  LoggingSchema,
  MetricsSchema,
  TracingSchema,
  AlertingSchema,
  SLOSchema,
  DORAMetricsSchema,
} from '../../../src/core/schemas/observability.schema.js';

describe('ObservabilitySchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal observability config', () => {
      const input = {};

      const result = ObservabilitySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schemaVersion).toBe('1.0.0');
      }
    });

    it('should validate a full observability config', () => {
      const input = {
        logging: {
          format: 'structured-json',
          level: 'info',
          destination: 'cloudwatch',
          retention: {
            days: 30,
          },
        },
        metrics: {
          backend: 'prometheus',
          endpoint: '/metrics',
          port: 9090,
          labels: {
            service: 'my-service',
          },
        },
        tracing: {
          backend: 'open-telemetry',
          enabled: true,
          samplingRate: 0.1,
          propagation: ['w3c', 'b3'],
        },
        alerting: {
          enabled: true,
          channels: [
            {
              name: 'slack-alerts',
              type: 'slack',
              target: 'https://hooks.slack.com/xxx',
              severity: ['critical', 'warning'],
            },
          ],
        },
        slos: [
          {
            name: 'availability-slo',
            sli: {
              type: 'availability',
              metric: 'up',
              threshold: 99.9,
              comparison: 'gte',
            },
            target: 99.9,
          },
        ],
        dora: {
          enabled: true,
          deploymentFrequency: { enabled: true },
          leadTime: { enabled: true },
        },
      };

      const result = ObservabilitySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.logging?.format).toBe('structured-json');
        expect(result.data.metrics?.backend).toBe('prometheus');
        expect(result.data.slos?.length).toBe(1);
      }
    });
  });
});

describe('LoggingSchema', () => {
  it('should apply defaults', () => {
    const result = LoggingSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('structured-json');
      expect(result.data.level).toBe('info');
    }
  });

  it('should validate all log formats', () => {
    const formats = ['structured-json', 'text', 'json', 'logfmt'];
    formats.forEach((format) => {
      const result = LoggingSchema.safeParse({ format });
      expect(result.success).toBe(true);
    });
  });

  it('should validate all log levels', () => {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    levels.forEach((level) => {
      const result = LoggingSchema.safeParse({ level });
      expect(result.success).toBe(true);
    });
  });
});

describe('MetricsSchema', () => {
  it('should apply defaults', () => {
    const result = MetricsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backend).toBe('prometheus');
    }
  });

  it('should validate all metrics backends', () => {
    const backends = ['prometheus', 'cloudwatch', 'datadog', 'newrelic', 'grafana', 'custom'];
    backends.forEach((backend) => {
      const result = MetricsSchema.safeParse({ backend });
      expect(result.success).toBe(true);
    });
  });
});

describe('TracingSchema', () => {
  it('should apply defaults', () => {
    const result = TracingSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backend).toBe('open-telemetry');
      expect(result.data.enabled).toBe(true);
      expect(result.data.samplingRate).toBe(1);
    }
  });

  it('should validate sampling rate bounds', () => {
    const validResult = TracingSchema.safeParse({ samplingRate: 0.5 });
    expect(validResult.success).toBe(true);

    const invalidResult = TracingSchema.safeParse({ samplingRate: 1.5 });
    expect(invalidResult.success).toBe(false);
  });
});

describe('SLOSchema', () => {
  it('should validate a valid SLO', () => {
    const input = {
      name: 'availability',
      sli: {
        type: 'availability',
        metric: 'http_requests_total{status!~"5.."}',
        threshold: 99.9,
      },
      target: 99.9,
    };

    const result = SLOSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should require SLI fields', () => {
    const input = {
      name: 'test',
      target: 99.9,
    };

    const result = SLOSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('DORAMetricsSchema', () => {
  it('should apply defaults', () => {
    const result = DORAMetricsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
    }
  });
});
