/**
 * Integration Tests: get_environment_context MCP Tool (T057)
 *
 * User Story 4: AI Queries Environment Context (Priority: P2)
 *
 * Acceptance Scenarios:
 * 1. Given environment definitions in environments/*.yaml,
 *    When AI calls get_environment_context("prod"),
 *    Then MCP returns production-specific settings including replicas, security strictness, and backup policies.
 * 2. Given tenant-specific environment overrides,
 *    When AI queries with tenant context,
 *    Then tenant overrides are applied to the base environment configuration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getEnvironmentContext,
  formatMcpResult,
} from '../../../src/server/tools/read/get-environment-context.js';

describe('get_environment_context MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `get-env-context-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'environments'), { recursive: true });
    await mkdir(join(archDir, 'tenants'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    await writeFile(filePath, content, 'utf-8');
  }

  describe('Acceptance Scenario 1: Successful environment retrieval', () => {
    it('should return prod environment with availability settings', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
description: Production environment
isProduction: true
availability:
  replicas: 3
  multiAZ: true
  multiRegion: false
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('prod');
      expect(result.data?.isProduction).toBe(true);
      expect(result.data?.availability?.replicas).toBe(3);
      expect(result.data?.availability?.multiAZ).toBe(true);
    });

    it('should return prod environment with security settings', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
isProduction: true
security:
  level: strict
  encryption:
    atRest: true
    inTransit: true
  network:
    privateOnly: true
    vpcEndpoints: true
  authentication:
    required: true
    mfaRequired: true
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.security?.level).toBe('strict');
      expect(result.data?.security?.encryption?.atRest).toBe(true);
      expect(result.data?.security?.encryption?.inTransit).toBe(true);
      expect(result.data?.security?.network?.privateOnly).toBe(true);
      expect(result.data?.security?.authentication?.mfaRequired).toBe(true);
    });

    it('should return prod environment with database and backup config', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
isProduction: true
database:
  engine: postgres
  instanceClass: db.r6g.xlarge
  multiAZ: true
  replicas: 2
  backup:
    enabled: true
    retentionDays: 35
    window: "03:00-04:00"
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.database?.engine).toBe('postgres');
      expect(result.data?.database?.multiAZ).toBe(true);
      expect(result.data?.database?.replicas).toBe(2);
      expect(result.data?.database?.backup?.enabled).toBe(true);
      expect(result.data?.database?.backup?.retentionDays).toBe(35);
    });

    it('should return dev environment with relaxed settings', async () => {
      await writeYaml(
        'environments/dev.yaml',
        `
name: dev
stage: dev
isProduction: false
availability:
  replicas: 1
  multiAZ: false
security:
  level: relaxed
scaling:
  enabled: false
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'dev' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('dev');
      expect(result.data?.isProduction).toBe(false);
      expect(result.data?.availability?.replicas).toBe(1);
      expect(result.data?.availability?.multiAZ).toBe(false);
      expect(result.data?.security?.level).toBe('relaxed');
    });

    it('should return different configs for dev vs prod', async () => {
      await writeYaml(
        'environments/dev.yaml',
        `
name: dev
isProduction: false
availability:
  replicas: 1
  multiAZ: false
security:
  level: relaxed
`
      );
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
isProduction: true
availability:
  replicas: 3
  multiAZ: true
security:
  level: strict
`
      );

      const devResult = await getEnvironmentContext(
        { environment_name: 'dev' },
        { baseDir: testDir }
      );
      const prodResult = await getEnvironmentContext(
        { environment_name: 'prod' },
        { baseDir: testDir }
      );

      expect(devResult.success).toBe(true);
      expect(prodResult.success).toBe(true);
      expect(devResult.data?.availability?.replicas).toBe(1);
      expect(prodResult.data?.availability?.replicas).toBe(3);
      expect(devResult.data?.security?.level).toBe('relaxed');
      expect(prodResult.data?.security?.level).toBe('strict');
      expect(devResult.data?.isProduction).toBe(false);
      expect(prodResult.data?.isProduction).toBe(true);
    });

    it('should include response metadata with sources', async () => {
      await writeYaml(
        'environments/staging.yaml',
        `
name: staging
stage: staging
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'staging' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.resolvedAt).toBeDefined();
      expect(result.metadata?.sources).toContain('architecture/environments/staging.yaml');
    });

    it('should support cloud-agnostic custom fields', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
cloud:
  provider: aws
  region: us-east-1
  account: "123456789"
disasterRecovery:
  enabled: true
  rto: 240
  rpo: 60
  strategy: warm-standby
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.cloud?.provider).toBe('aws');
      expect(result.data?.cloud?.region).toBe('us-east-1');
      expect(result.data?.disasterRecovery?.enabled).toBe(true);
      expect(result.data?.disasterRecovery?.rto).toBe(240);
      expect(result.data?.disasterRecovery?.strategy).toBe('warm-standby');
    });

    it('should return scaling configuration', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
scaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 20
  targetCPU: 70
  targetMemory: 80
  cooldownPeriod: 300
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.data?.scaling?.enabled).toBe(true);
      expect(result.data?.scaling?.minReplicas).toBe(2);
      expect(result.data?.scaling?.maxReplicas).toBe(20);
      expect(result.data?.scaling?.targetCPU).toBe(70);
    });
  });

  describe('Acceptance Scenario 2: Tenant-specific environment overrides', () => {
    it('should apply tenant environment overrides', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
isProduction: true
availability:
  replicas: 3
  multiAZ: true
scaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
`
      );
      await writeYaml(
        'tenants/enterprise.yaml',
        `
id: enterprise
name: Enterprise Customer
tier: enterprise
isolation: dedicated
environments:
  prod:
    availability:
      replicas: 5
    scaling:
      minReplicas: 3
      maxReplicas: 50
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod', tenant: 'enterprise' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      // Tenant override: replicas 3 → 5
      expect(result.data?.availability?.replicas).toBe(5);
      // Tenant override: maxReplicas 10 → 50
      expect(result.data?.scaling?.maxReplicas).toBe(50);
      // Base preserved: multiAZ not overridden
      expect(result.data?.availability?.multiAZ).toBe(true);
    });

    it('should include both environment and tenant in sources', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
availability:
  replicas: 3
`
      );
      await writeYaml(
        'tenants/acme.yaml',
        `
id: acme
name: Acme Corp
environments:
  prod:
    availability:
      replicas: 10
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod', tenant: 'acme' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.sources).toContain('architecture/environments/prod.yaml');
      expect(result.metadata?.sources).toContain('architecture/tenants/acme.yaml');
      expect(result.metadata?.sources).toContain(
        'architecture/tenants/acme.yaml#environments.prod'
      );
    });

    it('should return base environment when tenant has no overrides for it', async () => {
      await writeYaml(
        'environments/dev.yaml',
        `
name: dev
availability:
  replicas: 1
`
      );
      await writeYaml(
        'tenants/basic.yaml',
        `
id: basic
name: Basic Customer
environments:
  prod:
    availability:
      replicas: 5
`
      );

      // Tenant has prod overrides but not dev overrides
      const result = await getEnvironmentContext(
        { environment_name: 'dev', tenant: 'basic' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      // No dev overrides from tenant, so base env is returned
      expect(result.data?.availability?.replicas).toBe(1);
    });

    it('should apply tenant resource overrides', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
availability:
  replicas: 3
`
      );
      await writeYaml(
        'tenants/premium.yaml',
        `
id: premium
name: Premium Customer
tier: enterprise
environments:
  prod:
    resources:
      cpu: "4000m"
      memory: "8Gi"
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod', tenant: 'premium' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(true);
      const resources = result.data?.resources as Record<string, unknown> | undefined;
      expect(resources?.cpu).toBe('4000m');
      expect(resources?.memory).toBe('8Gi');
    });
  });

  describe('Error handling', () => {
    it('should return error with available environments when not found', async () => {
      await writeYaml(
        'environments/dev.yaml',
        `
name: dev
`
      );
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'nonexistent' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('nonexistent');
      expect(result.error?.message).toContain('Available environments');
      expect(result.error?.message).toContain('dev');
      expect(result.error?.message).toContain('prod');
    });

    it('should return clear error when no environments exist', async () => {
      const result = await getEnvironmentContext(
        { environment_name: 'any' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Available environments: none');
    });

    it('should return validation error for invalid environment YAML', async () => {
      await writeYaml(
        'environments/invalid.yaml',
        `
name: 12345
isProduction: "not a boolean"
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'invalid' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });

    it('should return error when tenant not found', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod', tenant: 'nonexistent-tenant' },
        { baseDir: testDir }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('nonexistent-tenant');
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('MCP result formatting', () => {
    it('should format successful result for MCP', async () => {
      await writeYaml(
        'environments/prod.yaml',
        `
name: prod
isProduction: true
availability:
  replicas: 3
`
      );

      const result = await getEnvironmentContext(
        { environment_name: 'prod' },
        { baseDir: testDir }
      );
      const mcpResult = formatMcpResult(result);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('prod');
      expect(mcpResult.structuredContent).toBeDefined();
      expect(mcpResult.structuredContent.success).toBe(true);
      expect(mcpResult.isError).toBeUndefined();
    });

    it('should format error result for MCP', async () => {
      const result = await getEnvironmentContext(
        { environment_name: 'nonexistent' },
        { baseDir: testDir }
      );
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
        'environments/prod.yaml',
        `
name: prod
isProduction: true
availability:
  replicas: 3
  multiAZ: true
security:
  level: strict
scaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 20
`
      );

      const start = performance.now();
      await getEnvironmentContext({ environment_name: 'prod' }, { baseDir: testDir });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
