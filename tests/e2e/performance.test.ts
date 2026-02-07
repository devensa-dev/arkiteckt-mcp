/**
 * Performance Tests: MCP Server Tool Latency
 *
 * Phase 13 - T081: Verify all MCP tools respond in <100ms (SC-001).
 *
 * Uses InMemoryTransport for zero-network-overhead measurement.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/server/index.js';

describe('MCP Server Performance (SC-001)', () => {
  let testDir: string;
  let archDir: string;
  let client: Client;
  let closeServer: () => Promise<void>;

  async function writeYaml(relativePath: string, content: string): Promise<void> {
    const filePath = join(archDir, relativePath);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }

  beforeAll(async () => {
    testDir = join(
      tmpdir(),
      `perf-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    archDir = join(testDir, 'architecture');
    await mkdir(archDir, { recursive: true });

    // Create fixture files for all tools
    await writeYaml(
      'system.yaml',
      `
name: perf-test-platform
architecture:
  style: microservices
  cloud: aws
defaults:
  runtime:
    language: typescript
    version: "20"
`
    );

    await writeYaml(
      'services/api-service.yaml',
      `
name: api-service
type: api
deployment:
  pattern: lambda
dependencies:
  - name: db-service
    type: sync
`
    );

    await writeYaml(
      'environments/prod.yaml',
      `
name: prod
availability:
  replicas: 3
  multiAZ: true
scaling:
  minReplicas: 2
  maxReplicas: 10
`
    );

    await writeYaml(
      'cicd.yaml',
      `
provider: github-actions
steps:
  - name: test
    type: test
    command: npm test
  - name: build
    type: build
    command: npm run build
`
    );

    await writeYaml(
      'observability.yaml',
      `
logging:
  format: structured
  level: info
metrics:
  provider: prometheus
tracing:
  enabled: true
  provider: otel
`
    );

    await writeYaml(
      'capabilities/service-caps.yaml',
      `
name: service-caps
capabilities:
  - name: create_service
    description: Create a new service
    artifacts:
      - type: source-code
        template: service-template
        path: "src/"
`
    );

    // Connect client
    const server = createServer(testDir);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    client = new Client({ name: 'perf-test', version: '0.1.0' });
    await client.connect(clientTransport);

    closeServer = async () => {
      await client.close();
      await server.close();
    };

    // Warm up: make one call to each tool so we measure steady-state, not cold start
    await client.callTool({ name: 'get_system_context', arguments: {} });
    await client.callTool({ name: 'get_service_context', arguments: { service_name: 'api-service' } });
    await client.callTool({ name: 'get_environment_context', arguments: { environment_name: 'prod' } });
    await client.callTool({ name: 'get_ci_requirements', arguments: {} });
    await client.callTool({ name: 'get_observability_requirements', arguments: {} });
    await client.callTool({ name: 'get_capability_requirements', arguments: { capability_name: 'service-caps' } });
  });

  afterAll(async () => {
    await closeServer();
    await rm(testDir, { recursive: true, force: true });
  });

  const LATENCY_THRESHOLD_MS = 100;

  it('get_system_context responds in <100ms', async () => {
    const start = performance.now();
    await client.callTool({ name: 'get_system_context', arguments: {} });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  it('get_service_context responds in <100ms', async () => {
    const start = performance.now();
    await client.callTool({ name: 'get_service_context', arguments: { service_name: 'api-service' } });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  it('get_service_context with resolution responds in <100ms', async () => {
    const start = performance.now();
    await client.callTool({
      name: 'get_service_context',
      arguments: { service_name: 'api-service', environment: 'prod' },
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  it('get_environment_context responds in <100ms', async () => {
    const start = performance.now();
    await client.callTool({ name: 'get_environment_context', arguments: { environment_name: 'prod' } });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  it('get_ci_requirements responds in <100ms', async () => {
    const start = performance.now();
    await client.callTool({ name: 'get_ci_requirements', arguments: {} });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  it('get_observability_requirements responds in <100ms', async () => {
    const start = performance.now();
    await client.callTool({ name: 'get_observability_requirements', arguments: {} });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  it('get_capability_requirements responds in <100ms', async () => {
    const start = performance.now();
    await client.callTool({ name: 'get_capability_requirements', arguments: { capability_name: 'service-caps' } });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  it('average latency across all tools is <100ms', async () => {
    const tools = [
      { name: 'get_system_context', arguments: {} },
      { name: 'get_service_context', arguments: { service_name: 'api-service' } },
      { name: 'get_environment_context', arguments: { environment_name: 'prod' } },
      { name: 'get_ci_requirements', arguments: {} },
      { name: 'get_observability_requirements', arguments: {} },
      { name: 'get_capability_requirements', arguments: { capability_name: 'service-caps' } },
    ];

    let totalDuration = 0;

    for (const tool of tools) {
      const start = performance.now();
      await client.callTool(tool);
      totalDuration += performance.now() - start;
    }

    const averageMs = totalDuration / tools.length;
    expect(averageMs).toBeLessThan(LATENCY_THRESHOLD_MS);
  });
});
