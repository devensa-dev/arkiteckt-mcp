/**
 * MCP Client Connection Utility
 *
 * Creates an in-process MCP client connected to the architecture server
 * via InMemoryTransport. This ensures the CLI uses the same MCP protocol
 * as AI tools (FR-009).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../server/index.js';

export interface McpClientConnection {
  client: Client;
  close: () => Promise<void>;
}

export interface ToolCallResult {
  data: unknown;
  isError: boolean;
  errorMessage?: string;
}

/**
 * Creates an in-process MCP client connected to the architecture server.
 * Uses InMemoryTransport — the same MCP wire protocol as AI tools.
 */
export async function createMcpClient(baseDir: string): Promise<McpClientConnection> {
  const server = createServer(baseDir);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'arch-cli', version: '0.1.0' });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/**
 * Calls an MCP tool and extracts the data from the response.
 */
export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<ToolCallResult> {
  const result = await client.callTool({ name: toolName, arguments: args });

  const content = result.content as Array<{ type: string; text: string }>;
  const text = content[0]!.text;

  if (result.isError) {
    return { data: undefined, isError: true, errorMessage: text };
  }

  const data: unknown = JSON.parse(text);
  return { data, isError: false };
}
