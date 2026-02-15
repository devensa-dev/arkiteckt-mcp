/**
 * Scaffold tools barrel export
 *
 * Exports all scaffolding and guidance MCP tools.
 */

export * from './explain-architecture.js';

export {
  scaffoldService,
  scaffoldServiceTool,
  formatMcpResult as formatScaffoldServiceResult,
  type ScaffoldServiceInput,
  type ScaffoldServiceOptions,
} from './scaffold-service.js';

export {
  scaffoldEnvironment,
  scaffoldEnvironmentTool,
  formatMcpResult as formatScaffoldEnvironmentResult,
  type ScaffoldEnvironmentInput,
  type ScaffoldEnvironmentOptions,
  type EnvironmentScaffoldResponse,
  type ServiceImpact,
} from './scaffold-environment.js';

export {
  checkReadiness,
  checkReadinessTool,
  formatMcpResult as formatCheckReadinessResult,
  type CheckReadinessInput,
  type CheckReadinessOptions,
} from './check-readiness.js';
