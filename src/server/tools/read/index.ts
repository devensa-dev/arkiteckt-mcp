/**
 * Read Tools
 *
 * MCP tools for reading architecture configuration.
 * All read tools are side-effect free and return cached results when available.
 */

export {
  getSystemContext,
  getSystemContextTool,
  formatMcpResult as formatSystemContextResult,
  type GetSystemContextOptions,
} from './get-system-context.js';

export {
  getServiceContext,
  getServiceContextTool,
  formatMcpResult as formatServiceContextResult,
  type GetServiceContextInput,
  type GetServiceContextOptions,
} from './get-service-context.js';

export {
  getCapabilityRequirements,
  getCapabilityRequirementsTool,
  formatMcpResult as formatCapabilityRequirementsResult,
  expandCapability,
  type GetCapabilityRequirementsInput,
  type GetCapabilityRequirementsOptions,
  type ExpandedCapability,
} from './get-capability-requirements.js';

export {
  getEnvironmentContext,
  getEnvironmentContextTool,
  formatMcpResult as formatEnvironmentContextResult,
  type GetEnvironmentContextInput,
  type GetEnvironmentContextOptions,
} from './get-environment-context.js';

export {
  getCIRequirements,
  getCIRequirementsTool,
  formatMcpResult as formatCIRequirementsResult,
  type GetCIRequirementsInput,
  type GetCIRequirementsOptions,
} from './get-ci-requirements.js';

export {
  getObservabilityRequirements,
  getObservabilityRequirementsTool,
  formatMcpResult as formatObservabilityRequirementsResult,
  type GetObservabilityRequirementsInput,
  type GetObservabilityRequirementsOptions,
} from './get-observability-requirements.js';
