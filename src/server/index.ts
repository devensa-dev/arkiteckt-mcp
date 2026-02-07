/**
 * MCP Server Entry Point
 *
 * This is the main entry point for the Architecture MCP server.
 * It exposes tools via the Model Context Protocol SDK for AI tools
 * to query architecture context.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  getSystemContext,
  getSystemContextTool,
  formatSystemContextResult,
  getServiceContext,
  getServiceContextTool,
  formatServiceContextResult,
  type GetServiceContextInput,
  getEnvironmentContext,
  getEnvironmentContextTool,
  formatEnvironmentContextResult,
  type GetEnvironmentContextInput,
  getCIRequirements,
  getCIRequirementsTool,
  formatCIRequirementsResult,
  type GetCIRequirementsInput,
  getObservabilityRequirements,
  getObservabilityRequirementsTool,
  formatObservabilityRequirementsResult,
  type GetObservabilityRequirementsInput,
  getCapabilityRequirements,
  getCapabilityRequirementsTool,
  formatCapabilityRequirementsResult,
  type GetCapabilityRequirementsInput,
} from './tools/index.js';

import { createLogger } from './middleware/logging.js';
import { withErrorHandling } from './middleware/error-handling.js';

export const SERVER_VERSION = '0.1.0';

/**
 * Creates and configures the MCP server with all tools registered.
 *
 * @param baseDir - Root directory containing the /architecture folder
 * @returns Configured McpServer instance (not yet connected to a transport)
 */
export function createServer(baseDir: string): McpServer {
  const logger = createLogger();
  const options = { baseDir };

  const server = new McpServer({
    name: 'arkiteckt-mcp',
    version: SERVER_VERSION,
  });

  // --- Register all read tools ---

  // T067: get_system_context (no input parameters)
  server.registerTool(
    getSystemContextTool.name,
    getSystemContextTool.config,
    withErrorHandling(
      getSystemContextTool.name,
      async () => {
        const response = await getSystemContext(options);
        return formatSystemContextResult(response);
      },
      logger
    )
  );

  // get_service_context (service_name, environment?, tenant?)
  server.registerTool(
    getServiceContextTool.name,
    getServiceContextTool.config,
    withErrorHandling(
      getServiceContextTool.name,
      async (args) => {
        const response = await getServiceContext(args as GetServiceContextInput, options);
        return formatServiceContextResult(response);
      },
      logger
    )
  );

  // get_environment_context (environment_name, tenant?)
  server.registerTool(
    getEnvironmentContextTool.name,
    getEnvironmentContextTool.config,
    withErrorHandling(
      getEnvironmentContextTool.name,
      async (args) => {
        const response = await getEnvironmentContext(args as GetEnvironmentContextInput, options);
        return formatEnvironmentContextResult(response);
      },
      logger
    )
  );

  // get_ci_requirements (service_name?)
  server.registerTool(
    getCIRequirementsTool.name,
    getCIRequirementsTool.config,
    withErrorHandling(
      getCIRequirementsTool.name,
      async (args) => {
        const response = await getCIRequirements(args as GetCIRequirementsInput, options);
        return formatCIRequirementsResult(response);
      },
      logger
    )
  );

  // get_observability_requirements (service_name?)
  server.registerTool(
    getObservabilityRequirementsTool.name,
    getObservabilityRequirementsTool.config,
    withErrorHandling(
      getObservabilityRequirementsTool.name,
      async (args) => {
        const response = await getObservabilityRequirements(args as GetObservabilityRequirementsInput, options);
        return formatObservabilityRequirementsResult(response);
      },
      logger
    )
  );

  // get_capability_requirements (capability_id, pattern?, service_name?)
  server.registerTool(
    getCapabilityRequirementsTool.name,
    getCapabilityRequirementsTool.config,
    withErrorHandling(
      getCapabilityRequirementsTool.name,
      async (args) => {
        const response = await getCapabilityRequirements(args as GetCapabilityRequirementsInput, options);
        return formatCapabilityRequirementsResult(response);
      },
      logger
    )
  );

  // T068: Server metadata and capabilities are configured via
  // the McpServer constructor (name, version) and tool registrations above.

  logger.info('Server created', {
    version: SERVER_VERSION,
    baseDir,
    tools: [
      getSystemContextTool.name,
      getServiceContextTool.name,
      getEnvironmentContextTool.name,
      getCIRequirementsTool.name,
      getObservabilityRequirementsTool.name,
      getCapabilityRequirementsTool.name,
    ],
  });

  return server;
}

/**
 * Main entry point: creates the server and connects via stdio transport.
 */
async function main(): Promise<void> {
  const baseDir = process.env.ARCH_BASE_DIR || process.cwd();
  const server = createServer(baseDir);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  const logger = createLogger();
  logger.info('Server started on stdio transport', {
    version: SERVER_VERSION,
    baseDir,
  });
}

main().catch((error) => {
  process.stderr.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      prefix: 'arkiteckt-mcp',
      message: `Server failed to start: ${error instanceof Error ? error.message : String(error)}`,
    }) + '\n'
  );
  process.exit(1);
});
