/**
 * Shared Types
 *
 * Common TypeScript types used across the application.
 */

// ============================================================================
// Result Type (for error handling)
// ============================================================================

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error from YAML parsing
 */
export interface YamlParseError {
  type: 'parse';
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
  filePath?: string;
}

/**
 * Error from schema validation
 */
export interface ValidationError {
  type: 'validation';
  message: string;
  path: string;
  expected?: string;
  received?: unknown;
  suggestion?: string;
}

/**
 * Error from file system operations
 */
export interface FileError {
  type: 'file';
  message: string;
  filePath: string;
  code?: string;
}

/**
 * Union of all architecture-related errors
 */
export type ArchitectureError = YamlParseError | ValidationError | FileError;

// ============================================================================
// Formatted Error (for CLI/API output)
// ============================================================================

/**
 * User-friendly formatted error for display
 */
export interface FormattedError {
  path: string;
  message: string;
  expected?: string;
  received?: string;
  suggestion?: string;
}

// ============================================================================
// Validation Result
// ============================================================================

/**
 * Result of validating an entity against a schema
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: FormattedError[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type for nested objects
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Extract keys of type V from T
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

// ============================================================================
// Cache Types (for T023)
// ============================================================================

/**
 * Cache entry with TTL support
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number;
  maxEntries?: number;
}

// ============================================================================
// Resolution Types (for T035+)
// ============================================================================

/**
 * Context for config resolution
 */
export interface ResolutionContext {
  service?: string;
  environment?: string;
  tenant?: string;
}

/**
 * Resolved configuration with metadata
 */
export interface ResolvedConfig<T> {
  config: T;
  sources: string[];
  resolvedAt: string;
}

// ============================================================================
// MCP Response Types
// ============================================================================

/**
 * Metadata for MCP tool responses
 */
export interface ResponseMetadata {
  cached: boolean;
  resolvedAt: string;
  sources?: string[];
}

/**
 * Standard MCP tool response envelope
 */
export interface ToolResponse<T> {
  success: boolean;
  data?: T;
  error?: ArchitectureError;
  metadata?: ResponseMetadata;
}

// ============================================================================
// Entity Types (re-exported from schemas for convenience)
// ============================================================================

export type {
  // System
  System,
  ArchitectureStyle,
  RuntimeDefaults,
  GlobalDefaults,
  Repository,
  // Service
  Service,
  DeploymentPattern,
  ServiceType,
  Dependency,
  ContainerConfig,
  ServiceRuntime,
  DeploymentConfig,
  Resilience,
  ServiceObservability,
  // Environment
  Environment,
  EnvironmentName,
  Availability,
  Scaling,
  SecurityLevel,
  EnvironmentSecurity,
  DatabaseConfig,
  ResourceConstraints,
  DisasterRecovery,
  // Observability
  Observability,
  Logging,
  Metrics,
  Tracing,
  Alerting,
  SLO,
  DORAMetrics,
  ObservabilityProfile,
  // CI/CD
  CICD,
  PipelineProvider,
  PipelineStep,
  QualityGate,
  SonarQube,
  SecurityScan,
  ArtifactConfig,
  DeploymentStage,
  BranchStrategy,
  // Security
  Security,
  ComplianceFramework,
  IAMPolicy,
  SecretsManagement,
  Encryption,
  NetworkSecurity,
  Authentication,
  Authorization,
  Compliance,
  VulnerabilityManagement,
  // ADR
  ADR,
  ADRStatus,
  Stakeholder,
  Option,
  TradeOff,
  ReconsiderationCondition,
  Reference,
  // Tenant
  Tenant,
  IsolationLevel,
  TenantTier,
  TenantCloudConfig,
  ResourceQuota,
  TenantFeatures,
  TenantEnvironmentOverride,
  // Rule
  Rule,
  RuleSet,
  RuleSeverity,
  RuleScope,
  RuleCondition,
  Remediation,
  RuleCategory,
  // Capability
  Capability,
  CapabilitySet,
  ArtifactType,
  ArtifactRequirement,
  PatternArtifacts,
  CapabilityInput,
  ValidationStep,
} from '../../core/schemas/index.js';
