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
  createService,
  createServiceTool,
  formatCreateServiceResult,
  type CreateServiceInput,
  updateService,
  updateServiceTool,
  formatUpdateServiceResult,
  type UpdateServiceInput,
  updateSystem,
  updateSystemTool,
  formatUpdateSystemResult,
  type UpdateSystemInput,
  createEnvironment,
  createEnvironmentTool,
  formatCreateEnvironmentResult,
  type CreateEnvironmentInput,
  updateEnvironment,
  updateEnvironmentTool,
  formatUpdateEnvironmentResult,
  type UpdateEnvironmentInput,
  setCICD,
  setCICDTool,
  formatSetCICDResult,
  type SetCICDInput,
  setObservability,
  setObservabilityTool,
  formatSetObservabilityResult,
  type SetObservabilityInput,
  deleteService,
  deleteServiceTool,
  formatDeleteServiceResult,
  type DeleteServiceInput,
  deleteEnvironment,
  deleteEnvironmentTool,
  formatDeleteEnvironmentResult,
  type DeleteEnvironmentInput,
  scanCodebase,
  scanCodebaseTool,
  formatScanCodebaseResult,
  type ScanCodebaseInput,
  explainArchitecture,
  explainArchitectureTool,
  formatMcpResult as formatExplainArchitectureResult,
  type ExplainArchitectureInput,
  scaffoldService,
  scaffoldServiceTool,
  formatScaffoldServiceResult,
  type ScaffoldServiceInput,
  scaffoldEnvironment,
  scaffoldEnvironmentTool,
  formatScaffoldEnvironmentResult,
  type ScaffoldEnvironmentInput,
  diffEnvironments,
  diffEnvironmentsTool,
  formatDiffEnvironmentsResult,
  type DiffEnvironmentsInput,
  validateArchitecture,
  validateArchitectureTool,
  formatValidateArchitectureResult,
  type ValidateArchitectureInput,
  checkReadiness,
  checkReadinessTool,
  formatCheckReadinessResult,
  type CheckReadinessInput,
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

  // --- Register all write tools ---

  // create_service (name, type, deployment_pattern, description?, dependencies?, owner?)
  server.registerTool(
    createServiceTool.name,
    createServiceTool.config,
    withErrorHandling(
      createServiceTool.name,
      async (args) => {
        const response = await createService(args as CreateServiceInput, options);
        return formatCreateServiceResult(response);
      },
      logger
    )
  );

  // update_service (name, updates)
  server.registerTool(
    updateServiceTool.name,
    updateServiceTool.config,
    withErrorHandling(
      updateServiceTool.name,
      async (args) => {
        const response = await updateService(args as UpdateServiceInput, options);
        return formatUpdateServiceResult(response);
      },
      logger
    )
  );

  // update_system (updates)
  server.registerTool(
    updateSystemTool.name,
    updateSystemTool.config,
    withErrorHandling(
      updateSystemTool.name,
      async (args) => {
        const response = await updateSystem(args as UpdateSystemInput, options);
        return formatUpdateSystemResult(response);
      },
      logger
    )
  );

  // create_environment (name, base_template?, availability?, scaling?, security_level?)
  server.registerTool(
    createEnvironmentTool.name,
    createEnvironmentTool.config,
    withErrorHandling(
      createEnvironmentTool.name,
      async (args) => {
        const response = await createEnvironment(args as CreateEnvironmentInput, options);
        return formatCreateEnvironmentResult(response);
      },
      logger
    )
  );

  // update_environment (name, updates)
  server.registerTool(
    updateEnvironmentTool.name,
    updateEnvironmentTool.config,
    withErrorHandling(
      updateEnvironmentTool.name,
      async (args) => {
        const response = await updateEnvironment(args as UpdateEnvironmentInput, options);
        return formatUpdateEnvironmentResult(response);
      },
      logger
    )
  );

  // set_cicd (provider?, steps?, quality_gates?, config?)
  server.registerTool(
    setCICDTool.name,
    setCICDTool.config,
    withErrorHandling(
      setCICDTool.name,
      async (args) => {
        const response = await setCICD(args as SetCICDInput, options);
        return formatSetCICDResult(response);
      },
      logger
    )
  );

  // set_observability (logging?, metrics?, tracing?, alerting?, config?)
  server.registerTool(
    setObservabilityTool.name,
    setObservabilityTool.config,
    withErrorHandling(
      setObservabilityTool.name,
      async (args) => {
        const response = await setObservability(args as SetObservabilityInput, options);
        return formatSetObservabilityResult(response);
      },
      logger
    )
  );

  // delete_service (name, force?)
  server.registerTool(
    deleteServiceTool.name,
    deleteServiceTool.config,
    withErrorHandling(
      deleteServiceTool.name,
      async (args) => {
        const response = await deleteService(args as DeleteServiceInput, options);
        return formatDeleteServiceResult(response);
      },
      logger
    )
  );

  // delete_environment (name)
  server.registerTool(
    deleteEnvironmentTool.name,
    deleteEnvironmentTool.config,
    withErrorHandling(
      deleteEnvironmentTool.name,
      async (args) => {
        const response = await deleteEnvironment(args as DeleteEnvironmentInput, options);
        return formatDeleteEnvironmentResult(response);
      },
      logger
    )
  );

  // scan_codebase (root_path?, write?)
  server.registerTool(
    scanCodebaseTool.name,
    scanCodebaseTool.config,
    withErrorHandling(
      scanCodebaseTool.name,
      async (args) => {
        const response = await scanCodebase(args as ScanCodebaseInput, { ...options, cwd: process.cwd() });
        return formatScanCodebaseResult(response);
      },
      logger
    )
  );

  // --- Register all scaffold tools ---

  // explain_architecture (focus?, service_name?)
  server.registerTool(
    explainArchitectureTool.name,
    explainArchitectureTool.config,
    withErrorHandling(
      explainArchitectureTool.name,
      async (args) => {
        const response = await explainArchitecture(args as ExplainArchitectureInput, options);
        return formatExplainArchitectureResult(response);
      },
      logger
    )
  );

  // scaffold_service (name, type, deployment_pattern, description?, dependencies?, owner?)
  server.registerTool(
    scaffoldServiceTool.name,
    scaffoldServiceTool.config,
    withErrorHandling(
      scaffoldServiceTool.name,
      async (args) => {
        const response = await scaffoldService(args as ScaffoldServiceInput, options);
        return formatScaffoldServiceResult(response);
      },
      logger
    )
  );

  // scaffold_environment (name, base_template?)
  server.registerTool(
    scaffoldEnvironmentTool.name,
    scaffoldEnvironmentTool.config,
    withErrorHandling(
      scaffoldEnvironmentTool.name,
      async (args) => {
        const response = await scaffoldEnvironment(args as ScaffoldEnvironmentInput, options);
        return formatScaffoldEnvironmentResult(response);
      },
      logger
    )
  );

  // --- Register all analysis tools ---

  // diff_environments (env_a, env_b, service_name?)
  server.registerTool(
    diffEnvironmentsTool.name,
    diffEnvironmentsTool.config,
    withErrorHandling(
      diffEnvironmentsTool.name,
      async (args) => {
        const response = await diffEnvironments(args as DiffEnvironmentsInput, options);
        return formatDiffEnvironmentsResult(response);
      },
      logger
    )
  );

  // validate_architecture (scope?)
  server.registerTool(
    validateArchitectureTool.name,
    validateArchitectureTool.config,
    withErrorHandling(
      validateArchitectureTool.name,
      async (args) => {
        const response = await validateArchitecture(args as ValidateArchitectureInput, options);
        return formatValidateArchitectureResult(response);
      },
      logger
    )
  );

  // check_service_readiness (service_name, environment?)
  server.registerTool(
    checkReadinessTool.name,
    checkReadinessTool.config,
    withErrorHandling(
      checkReadinessTool.name,
      async (args) => {
        const response = await checkReadiness(args as CheckReadinessInput, options);
        return formatCheckReadinessResult(response);
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
      createServiceTool.name,
      updateServiceTool.name,
      updateSystemTool.name,
      createEnvironmentTool.name,
      updateEnvironmentTool.name,
      setCICDTool.name,
      setObservabilityTool.name,
      deleteServiceTool.name,
      deleteEnvironmentTool.name,
      scanCodebaseTool.name,
      explainArchitectureTool.name,
      scaffoldServiceTool.name,
      scaffoldEnvironmentTool.name,
      diffEnvironmentsTool.name,
      validateArchitectureTool.name,
      checkReadinessTool.name,
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
