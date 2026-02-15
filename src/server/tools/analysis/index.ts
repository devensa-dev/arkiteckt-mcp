/**
 * Analysis Tools
 *
 * MCP tools for architecture analysis, validation, and comparison.
 */

export {
  diffEnvironments,
  diffEnvironmentsTool,
  formatMcpResult as formatDiffEnvironmentsResult,
  type DiffEnvironmentsInput,
  type DiffEnvironmentsOptions,
} from './diff-environments.js';

export {
  validateArchitecture,
  validateArchitectureTool,
  formatMcpResult as formatValidateArchitectureResult,
  type ValidateArchitectureInput,
  type ValidateArchitectureOptions,
} from './validate-architecture.js';
