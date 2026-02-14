/**
 * Write Tools
 *
 * MCP tools for creating, updating, and deleting architecture entities.
 * All write tools perform validation before modifying files and return impact analysis.
 */

// Service Tools
export {
  createService,
  createServiceTool,
  formatMcpResult as formatCreateServiceResult,
  type CreateServiceInput,
  type CreateServiceOptions,
} from './create-service.js';

export {
  updateService,
  updateServiceTool,
  formatMcpResult as formatUpdateServiceResult,
  type UpdateServiceInput,
  type UpdateServiceOptions,
} from './update-service.js';

// System Tools
export {
  updateSystem,
  updateSystemTool,
  formatMcpResult as formatUpdateSystemResult,
  type UpdateSystemInput,
  type UpdateSystemOptions,
} from './update-system.js';

// Environment Tools
export {
  createEnvironment,
  createEnvironmentTool,
  formatMcpResult as formatCreateEnvironmentResult,
  type CreateEnvironmentInput,
  type CreateEnvironmentOptions,
} from './create-environment.js';

export {
  updateEnvironment,
  updateEnvironmentTool,
  formatMcpResult as formatUpdateEnvironmentResult,
  type UpdateEnvironmentInput,
  type UpdateEnvironmentOptions,
} from './update-environment.js';

// CI/CD Tools
export {
  setCICD,
  setCICDTool,
  formatMcpResult as formatSetCICDResult,
  type SetCICDInput,
  type SetCICDOptions,
} from './set-cicd.js';

// Observability Tools
export {
  setObservability,
  setObservabilityTool,
  formatMcpResult as formatSetObservabilityResult,
  type SetObservabilityInput,
  type SetObservabilityOptions,
} from './set-observability.js';

// Delete Tools
export {
  deleteService,
  deleteServiceTool,
  formatMcpResult as formatDeleteServiceResult,
  type DeleteServiceInput,
  type DeleteServiceOptions,
} from './delete-service.js';

export {
  deleteEnvironment,
  deleteEnvironmentTool,
  formatMcpResult as formatDeleteEnvironmentResult,
  type DeleteEnvironmentInput,
  type DeleteEnvironmentOptions,
} from './delete-environment.js';
