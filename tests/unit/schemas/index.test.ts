import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  // System
  SystemSchema,
  ArchitectureStyleSchema,
  // Service
  ServiceSchema,
  DeploymentPatternSchema,
  // Environment
  EnvironmentSchema,
  EnvironmentNameSchema,
  // Observability
  ObservabilitySchema,
  LoggingSchema,
  // CI/CD
  CICDSchema,
  PipelineProviderSchema,
  // Security
  SecuritySchema,
  ComplianceFrameworkSchema,
  // ADR
  ADRSchema,
  ADRStatusSchema,
  // Tenant
  TenantSchema,
  IsolationLevelSchema,
  // Rule
  RuleSchema,
  RuleSeveritySchema,
  // Capability
  CapabilitySchema,
  ArtifactTypeSchema,
} from '../../../src/core/schemas/index.js';

describe('Schema Exports', () => {
  it('should export SCHEMA_VERSION', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0');
  });

  it('should export all main schemas', () => {
    expect(SystemSchema).toBeDefined();
    expect(ServiceSchema).toBeDefined();
    expect(EnvironmentSchema).toBeDefined();
    expect(ObservabilitySchema).toBeDefined();
    expect(CICDSchema).toBeDefined();
    expect(SecuritySchema).toBeDefined();
    expect(ADRSchema).toBeDefined();
    expect(TenantSchema).toBeDefined();
    expect(RuleSchema).toBeDefined();
    expect(CapabilitySchema).toBeDefined();
  });

  it('should export key enum schemas', () => {
    expect(ArchitectureStyleSchema).toBeDefined();
    expect(DeploymentPatternSchema).toBeDefined();
    expect(EnvironmentNameSchema).toBeDefined();
    expect(PipelineProviderSchema).toBeDefined();
    expect(ComplianceFrameworkSchema).toBeDefined();
    expect(ADRStatusSchema).toBeDefined();
    expect(IsolationLevelSchema).toBeDefined();
    expect(RuleSeveritySchema).toBeDefined();
    expect(ArtifactTypeSchema).toBeDefined();
  });

  it('should export sub-schemas', () => {
    expect(LoggingSchema).toBeDefined();
  });
});

describe('Schema Integration', () => {
  it('should validate a complete system with services', () => {
    const system = {
      name: 'my-platform',
      architecture: { style: 'microservices', cloud: 'aws' },
    };

    const service = {
      name: 'order-service',
      deployment: { pattern: 'lambda' },
    };

    const systemResult = SystemSchema.safeParse(system);
    const serviceResult = ServiceSchema.safeParse(service);

    expect(systemResult.success).toBe(true);
    expect(serviceResult.success).toBe(true);
  });

  it('should validate environment with security settings', () => {
    const env = {
      name: 'production',
      stage: 'prod',
      isProduction: true,
      security: {
        level: 'strict',
      },
    };

    const result = EnvironmentSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it('should validate capability with pattern artifacts', () => {
    const capability = {
      id: 'create_service',
      name: 'Create Service',
      patternArtifacts: [
        {
          pattern: 'lambda',
          artifacts: [{ type: 'sam-template', name: 'template.yaml' }],
        },
      ],
    };

    const result = CapabilitySchema.safeParse(capability);
    expect(result.success).toBe(true);
  });
});
