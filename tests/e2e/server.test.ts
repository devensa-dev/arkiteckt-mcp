/**
 * End-to-End Tests: MCP Server
 *
 * Phase 11 - T069: Start server, query all tools via MCP protocol.
 *
 * Uses InMemoryTransport to test the full MCP protocol flow:
 * Client -> Transport -> Server -> Tool Handler -> Response
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/server/index.js';

describe('MCP Server E2E', () => {
  let testDir: string;
  let archDir: string;
  let client: Client;
  let cleanup: () => Promise<void>;

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }

  beforeAll(async () => {
    // Create test architecture directory with fixture files
    testDir = join(
      tmpdir(),
      `mcp-server-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(archDir, { recursive: true });
    await mkdir(join(archDir, 'services'), { recursive: true });
    await mkdir(join(archDir, 'environments'), { recursive: true });
    await mkdir(join(archDir, 'capabilities'), { recursive: true });

    // Create minimal fixture files
    await writeYaml(
      'system.yaml',
      `
name: test-platform
description: E2E test platform
architecture:
  style: microservices
  cloud: aws
  region: us-east-1
defaults:
  runtime:
    language: typescript
    version: "20"
    framework: express
`
    );

    await writeYaml(
      'services/order-service.yaml',
      `
name: order-service
type: backend
deployment:
  pattern: lambda
  runtime:
    language: typescript
    version: "20"
dependencies:
  - name: user-service
    type: sync
`
    );

    await writeYaml(
      'environments/prod.yaml',
      `
name: prod
description: Production environment
availability:
  replicas: 3
  multiAz: true
scaling:
  minInstances: 2
  maxInstances: 10
security:
  level: strict
`
    );

    await writeYaml(
      'cicd.yaml',
      `
provider: github-actions
steps:
  - name: build
    type: build
    required: true
  - name: test
    type: test
    required: true
  - name: deploy
    type: deploy
    required: true
`
    );

    await writeYaml(
      'observability.yaml',
      `
logging:
  format: structured-json
  level: info
metrics:
  backend: prometheus
  enabled: true
tracing:
  standard: open-telemetry
  enabled: true
`
    );

    await writeYaml(
      'capabilities/service-capabilities.yaml',
      `
name: Service Capabilities
description: Core service operations
capabilities:
  - id: create_service
    name: Create Service
    description: Create a new production-ready service
    category: service
    baseArtifacts:
      - type: source-code
        name: Application code
        required: true
      - type: unit-test
        name: Unit tests
        required: true
      - type: pipeline
        name: CI/CD pipeline
        required: true
`
    );

    // Create MCP server and client connected via InMemoryTransport
    const server = createServer(testDir);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: 'test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    await cleanup();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Server startup', () => {
    it('should connect successfully', () => {
      // If we got here, the server started and client connected
      expect(client).toBeDefined();
    });
  });

  describe('Tool listing', () => {
    it('should list all 6 registered tools', async () => {
      const result = await client.listTools();

      expect(result.tools).toHaveLength(6);

      const toolNames = result.tools.map((t) => t.name).sort();
      expect(toolNames).toEqual([
        'get_capability_requirements',
        'get_ci_requirements',
        'get_environment_context',
        'get_observability_requirements',
        'get_service_context',
        'get_system_context',
      ]);
    });

    it('should include descriptions for all tools', async () => {
      const result = await client.listTools();

      for (const tool of result.tools) {
        expect(tool.description).toBeDefined();
        expect(tool.description!.length).toBeGreaterThan(10);
      }
    });

    it('should include input schemas for all tools', async () => {
      const result = await client.listTools();

      for (const tool of result.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  describe('get_system_context', () => {
    it('should return system configuration', async () => {
      const result = await client.callTool({ name: 'get_system_context', arguments: {} });

      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();
      expect(result.content).toHaveLength(1);

      const textContent = result.content[0];
      expect(textContent).toHaveProperty('type', 'text');
      expect((textContent as { type: 'text'; text: string }).text).toContain('test-platform');
      expect((textContent as { type: 'text'; text: string }).text).toContain('microservices');
    });
  });

  describe('get_service_context', () => {
    it('should return service configuration', async () => {
      const result = await client.callTool({
        name: 'get_service_context',
        arguments: { service_name: 'order-service' },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('order-service');
      expect(text).toContain('lambda');
    });

    it('should return error for non-existent service', async () => {
      const result = await client.callTool({
        name: 'get_service_context',
        arguments: { service_name: 'non-existent-service' },
      });

      expect(result.isError).toBe(true);

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('not found');
    });
  });

  describe('get_environment_context', () => {
    it('should return environment configuration', async () => {
      const result = await client.callTool({
        name: 'get_environment_context',
        arguments: { environment_name: 'prod' },
      });

      expect(result.isError).toBeFalsy();

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('prod');
    });
  });

  describe('get_ci_requirements', () => {
    it('should return CI/CD standards', async () => {
      const result = await client.callTool({
        name: 'get_ci_requirements',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('github-actions');
    });
  });

  describe('get_observability_requirements', () => {
    it('should return observability standards', async () => {
      const result = await client.callTool({
        name: 'get_observability_requirements',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('structured-json');
      expect(text).toContain('prometheus');
    });
  });

  describe('get_capability_requirements', () => {
    it('should return capability artifact checklist', async () => {
      const result = await client.callTool({
        name: 'get_capability_requirements',
        arguments: { capability_id: 'create_service' },
      });

      expect(result.isError).toBeFalsy();

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('create_service');
      expect(text).toContain('source-code');
    });

    it('should return error for non-existent capability', async () => {
      const result = await client.callTool({
        name: 'get_capability_requirements',
        arguments: { capability_id: 'non_existent_capability' },
      });

      expect(result.isError).toBe(true);

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('non_existent_capability');
    });
  });

  describe('Error handling', () => {
    it('should handle calls to non-existent tools gracefully', async () => {
      const result = await client.callTool({ name: 'non_existent_tool', arguments: {} });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('not found');
    });
  });
});
