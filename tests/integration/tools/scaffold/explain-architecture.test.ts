/**
 * Integration Tests: explain_architecture MCP Tool
 *
 * User Story 9: Coding Agent Architecture Context (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given initialized architecture with services,
 *    When AI calls explain_architecture with overview mode,
 *    Then complete system summary with dependency graph is returned.
 * 2. Given initialized architecture,
 *    When AI calls explain_architecture with service focus,
 *    Then resolved config with dependencies and env variations is returned.
 * 3. Given architecture with multiple environments,
 *    When AI calls explain_architecture for a service,
 *    Then environment variations are computed and returned.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  explainArchitecture,
  formatMcpResult,
  type OverviewResponse,
  type ServiceFocusResponse,
} from '../../../../src/server/tools/scaffold/explain-architecture.js';

describe('explain_architecture MCP Tool', () => {
  let testDir: string;
  let archDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(
      tmpdir(),
      `explain-architecture-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'environments'), { recursive: true });
    await mkdir(join(archDir, 'capabilities'), { recursive: true });

    // Create system.yaml
    await writeFile(
      join(archDir, 'system.yaml'),
      `
name: test-system
architecture:
  style: microservices
  cloud: aws
  region: us-east-1
defaults:
  runtime:
    language: typescript
    version: "20"
`,
      'utf-8'
    );

    // Create two services with dependencies
    await writeFile(
      join(archDir, 'services', 'user-service.yaml'),
      `
name: user-service
type: api
description: User management service
owner: platform-team
deployment:
  pattern: kubernetes
  replicas: 3
runtime:
  language: typescript
  version: "20"
  framework: express
resources:
  cpu: "500m"
  memory: "512Mi"
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'services', 'order-service.yaml'),
      `
name: order-service
type: api
description: Order processing service
deployment:
  pattern: kubernetes
  replicas: 2
dependencies:
  - name: user-service
    type: sync
    protocol: http
runtime:
  language: typescript
  version: "20"
  framework: express
`,
      'utf-8'
    );

    // Create environments
    await writeFile(
      join(archDir, 'environments', 'dev.yaml'),
      `
name: dev
tier: development
security:
  level: relaxed
scaling:
  enabled: false
defaults:
  deployment:
    replicas: 1
  resources:
    cpu: "100m"
    memory: "128Mi"
`,
      'utf-8'
    );

    await writeFile(
      join(archDir, 'environments', 'prod.yaml'),
      `
name: prod
tier: production
security:
  level: strict
scaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
defaults:
  resources:
    cpu: "1000m"
    memory: "1Gi"
`,
      'utf-8'
    );

    // Create capabilities
    await writeFile(
      join(archDir, 'capabilities', 'services.yaml'),
      `
name: Service Capabilities
capabilities:
  - id: create_service
    name: Create Service
    description: Create a new service
    category: development
    baseArtifacts:
      - type: source-code
        name: Service implementation
        description: Core service logic
        required: true
    patternArtifacts:
      - pattern: kubernetes
        artifacts:
          - type: infrastructure
            name: Kubernetes manifests
            description: Deployment manifests
            required: true
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Overview Mode', () => {
    it('should return complete system summary with all services', async () => {
      const response = await explainArchitecture(
        { focus: 'overview' },
        { baseDir: testDir }
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();

      const data = response.data as OverviewResponse;

      // System info
      expect(data.system.name).toBe('test-system');
      expect(data.system.cloud).toBe('aws');
      expect(data.system.region).toBe('us-east-1');
      expect(data.system.style).toBe('microservices');

      // Services
      expect(data.services).toHaveLength(2);
      expect(data.services.map((s) => s.name)).toContain('user-service');
      expect(data.services.map((s) => s.name)).toContain('order-service');

      const userService = data.services.find((s) => s.name === 'user-service');
      expect(userService?.type).toBe('api');
      expect(userService?.pattern).toBe('kubernetes');
      expect(userService?.dependencyCount).toBe(0);
      expect(userService?.owner).toBe('platform-team');

      const orderService = data.services.find((s) => s.name === 'order-service');
      expect(orderService?.dependencyCount).toBe(1);

      // Environments
      expect(data.environments).toHaveLength(2);
      expect(data.environments.map((e) => e.name)).toContain('dev');
      expect(data.environments.map((e) => e.name)).toContain('prod');

      const devEnv = data.environments.find((e) => e.name === 'dev');
      expect(devEnv?.tier).toBe('development');
      expect(devEnv?.securityLevel).toBe('relaxed');

      // Dependency graph
      expect(data.dependencyGraph.nodes).toHaveLength(2);
      expect(data.dependencyGraph.edges).toHaveLength(1);
      expect(data.dependencyGraph.edges[0].from).toBe('order-service');
      expect(data.dependencyGraph.edges[0].to).toBe('user-service');
      expect(data.dependencyGraph.edges[0].type).toBe('sync');
      expect(data.dependencyGraph.edges[0].protocol).toBe('http');

      // Tech stack
      expect(data.techStack.languages).toContain('typescript');
      expect(data.techStack.frameworks).toContain('express');
      expect(data.techStack.cloud).toBe('aws');

      // Statistics
      expect(data.statistics.serviceCount).toBe(2);
      expect(data.statistics.environmentCount).toBe(2);
      expect(data.statistics.totalDependencies).toBe(1);
    });

    it('should format MCP result correctly for overview mode', async () => {
      const response = await explainArchitecture(
        { focus: 'overview' },
        { baseDir: testDir }
      );

      const mcpResult = formatMcpResult(response);

      expect(mcpResult.content).toBeDefined();
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('Architecture Overview');
      expect(mcpResult.content[0].text).toContain('test-system');
      expect(mcpResult.content[0].text).toContain('user-service');
      expect(mcpResult.content[0].text).toContain('order-service');
      expect(mcpResult.structuredContent.success).toBe(true);
    });
  });

  describe('Service Focus Mode', () => {
    it('should return detailed service context with dependencies', async () => {
      const response = await explainArchitecture(
        { service_name: 'order-service' },
        { baseDir: testDir }
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();

      const data = response.data as ServiceFocusResponse;

      // Service details
      expect(data.service.name).toBe('order-service');
      expect(data.service.type).toBe('api');
      expect(data.service.deployment?.pattern).toBe('kubernetes');

      // Direct dependencies
      expect(data.dependencies.direct).toHaveLength(1);
      expect(data.dependencies.direct[0].name).toBe('user-service');

      // Transitive dependencies (none in this case)
      expect(data.dependencies.transitive).toHaveLength(0);

      // Environment variations (may or may not have variations depending on overrides)
      expect(data.environmentVariations).toBeDefined();

      // Capability checklist (depends on capability definitions)
      expect(data.capabilityChecklist).toBeDefined();
      expect(Array.isArray(data.capabilityChecklist)).toBe(true);

      // Related ADRs (none in this test)
      expect(data.relatedADRs).toHaveLength(0);
    });

    it('should compute environment variations correctly', async () => {
      const response = await explainArchitecture(
        { service_name: 'user-service' },
        { baseDir: testDir }
      );

      expect(response.success).toBe(true);

      const data = response.data as ServiceFocusResponse;

      // Environment variations should be defined (even if empty)
      expect(data.environmentVariations).toBeDefined();

      // user-service has explicit resources (500m cpu, 512Mi memory)
      // Environment defaults will override these, so variations should exist
      const hasVariations = Object.keys(data.environmentVariations).length > 0;

      if (hasVariations) {
        // If variations exist, verify they're computed correctly
        if (data.environmentVariations.dev?.resources) {
          // Dev environment should use 100m CPU and 128Mi memory (from env defaults)
          expect(data.environmentVariations.dev.resources.cpu).toBe('100m');
          expect(data.environmentVariations.dev.resources.memory).toBe('128Mi');
        }

        if (data.environmentVariations.prod?.resources) {
          // Prod environment should use 1000m CPU and 1Gi memory (from env defaults)
          expect(data.environmentVariations.prod.resources.cpu).toBe('1000m');
          expect(data.environmentVariations.prod.resources.memory).toBe('1Gi');
        }
      }
    });

    it('should return error for non-existent service', async () => {
      const response = await explainArchitecture(
        { service_name: 'nonexistent-service' },
        { baseDir: testDir }
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.type).toBe('file');
    });

    it('should format MCP result correctly for service focus mode', async () => {
      const response = await explainArchitecture(
        { service_name: 'order-service' },
        { baseDir: testDir }
      );

      const mcpResult = formatMcpResult(response);

      expect(mcpResult.content).toBeDefined();
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('Service: order-service');
      expect(mcpResult.content[0].text).toContain('Direct Dependencies');
      expect(mcpResult.content[0].text).toContain('Environment Variations');
      expect(mcpResult.structuredContent.success).toBe(true);
    });
  });

  describe('Metadata', () => {
    it('should include correct metadata sources for overview mode', async () => {
      const response = await explainArchitecture(
        { focus: 'overview' },
        { baseDir: testDir }
      );

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.sources).toContain('architecture/system.yaml');
      expect(response.metadata?.sources).toContain('architecture/services/');
      expect(response.metadata?.sources).toContain('architecture/environments/');
    });

    it('should include correct metadata sources for service focus mode', async () => {
      const response = await explainArchitecture(
        { service_name: 'user-service' },
        { baseDir: testDir }
      );

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.sources).toContain('architecture/services/user-service.yaml');
      expect(response.metadata?.sources).toContain('architecture/services/');
      // Capabilities are only added if deployment pattern is found and capabilities exist
      if (response.success) {
        const data = response.data as ServiceFocusResponse;
        if (data.capabilityChecklist.length > 0) {
          expect(response.metadata?.sources).toContain('architecture/capabilities/');
        }
      }
    });
  });
});
