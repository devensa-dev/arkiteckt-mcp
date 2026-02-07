/**
 * Integration Tests: CLI Context Commands
 *
 * Phase 12 - T077: Tests context commands via MCP protocol.
 * Uses InMemoryTransport to verify the full flow:
 * CLI utility → MCP Client → Server → Tool Handler → Formatted Output
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createMcpClient, callTool } from '../../../src/cli/utils/mcp-client.js';
import { formatOutput } from '../../../src/cli/utils/formatters.js';

describe('CLI Context Commands (via MCP)', () => {
  let testDir: string;
  let archDir: string;

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }

  beforeAll(async () => {
    testDir = join(
      tmpdir(),
      `cli-context-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(archDir, { recursive: true });

    await writeYaml(
      'system.yaml',
      `
name: test-platform
description: CLI integration test platform
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
      'environments/dev.yaml',
      `
name: dev
description: Development environment
availability:
  replicas: 1
  multiAz: false
scaling:
  minInstances: 1
  maxInstances: 2
security:
  level: standard
`
    );
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('MCP client connection', () => {
    it('should create and close a client connection', async () => {
      const connection = await createMcpClient(testDir);
      expect(connection.client).toBeDefined();
      await connection.close();
    });
  });

  describe('service context', () => {
    it('should return service data via MCP tool call', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_service_context', {
          service_name: 'order-service',
        });
        expect(result.isError).toBe(false);
        expect(result.data).toHaveProperty('name', 'order-service');
      } finally {
        await connection.close();
      }
    });

    it('should format service data as JSON', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_service_context', {
          service_name: 'order-service',
        });
        const output = formatOutput(result.data, 'json');
        const parsed = JSON.parse(output);
        expect(parsed).toHaveProperty('name', 'order-service');
      } finally {
        await connection.close();
      }
    });

    it('should format service data as YAML', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_service_context', {
          service_name: 'order-service',
        });
        const output = formatOutput(result.data, 'yaml');
        expect(output).toContain('name: order-service');
      } finally {
        await connection.close();
      }
    });

    it('should format service data as table', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_service_context', {
          service_name: 'order-service',
        });
        const output = formatOutput(result.data, 'table');
        expect(output).toContain('name');
        expect(output).toContain('order-service');
      } finally {
        await connection.close();
      }
    });

    it('should return error for non-existent service', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_service_context', {
          service_name: 'nonexistent',
        });
        expect(result.isError).toBe(true);
        expect(result.errorMessage).toContain('not found');
      } finally {
        await connection.close();
      }
    });
  });

  describe('environment context', () => {
    it('should return environment data via MCP tool call', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_environment_context', {
          environment_name: 'prod',
        });
        expect(result.isError).toBe(false);
        expect(result.data).toHaveProperty('name', 'prod');
      } finally {
        await connection.close();
      }
    });

    it('should return dev environment data', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_environment_context', {
          environment_name: 'dev',
        });
        expect(result.isError).toBe(false);
        expect(result.data).toHaveProperty('name', 'dev');
      } finally {
        await connection.close();
      }
    });

    it('should format environment data as table', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_environment_context', {
          environment_name: 'prod',
        });
        const output = formatOutput(result.data, 'table');
        expect(output).toContain('prod');
      } finally {
        await connection.close();
      }
    });

    it('should return error for non-existent environment', async () => {
      const connection = await createMcpClient(testDir);
      try {
        const result = await callTool(connection.client, 'get_environment_context', {
          environment_name: 'nonexistent',
        });
        expect(result.isError).toBe(true);
        expect(result.errorMessage).toContain('not found');
      } finally {
        await connection.close();
      }
    });
  });
});
