/**
 * Schema Exports
 *
 * All Zod schemas for architecture entities are exported from here.
 * Schemas use .passthrough() for cloud-agnostic extensibility.
 */

export const SCHEMA_VERSION = '1.0.0';

// System Schema
export {
  ArchitectureStyleSchema,
  RuntimeDefaultsSchema,
  GlobalDefaultsSchema,
  RepositorySchema,
  SystemSchema,
  type ArchitectureStyle,
  type RuntimeDefaults,
  type GlobalDefaults,
  type Repository,
  type System,
} from './system.schema.js';

// Service Schema
export {
  DeploymentPatternSchema,
  ServiceTypeSchema,
  DependencySchema,
  ContainerConfigSchema,
  ServiceRuntimeSchema,
  DeploymentConfigSchema,
  ResilienceSchema,
  ServiceObservabilitySchema,
  ServiceSchema,
  type DeploymentPattern,
  type ServiceType,
  type Dependency,
  type ContainerConfig,
  type ServiceRuntime,
  type DeploymentConfig,
  type Resilience,
  type ServiceObservability,
  type Service,
} from './service.schema.js';

// Environment Schema
export {
  EnvironmentNameSchema,
  AvailabilitySchema,
  ScalingSchema,
  SecurityLevelSchema,
  EnvironmentSecuritySchema,
  DatabaseConfigSchema,
  ResourceConstraintsSchema,
  DisasterRecoverySchema,
  EnvironmentSchema,
  type EnvironmentName,
  type Availability,
  type Scaling,
  type SecurityLevel,
  type EnvironmentSecurity,
  type DatabaseConfig,
  type ResourceConstraints,
  type DisasterRecovery,
  type Environment,
} from './environment.schema.js';

// Observability Schema
export {
  LoggingSchema,
  MetricsSchema,
  TracingSchema,
  AlertingSchema,
  SLOSchema,
  DORAMetricsSchema,
  ObservabilityProfileSchema,
  ObservabilitySchema,
  type Logging,
  type Metrics,
  type Tracing,
  type Alerting,
  type SLO,
  type DORAMetrics,
  type ObservabilityProfile,
  type Observability,
} from './observability.schema.js';

// CI/CD Schema
export {
  PipelineProviderSchema,
  PipelineStepSchema,
  QualityGateSchema,
  SonarQubeSchema,
  SecurityScanSchema,
  ArtifactConfigSchema,
  DeploymentStageSchema,
  BranchStrategySchema,
  CICDSchema,
  type PipelineProvider,
  type PipelineStep,
  type QualityGate,
  type SonarQube,
  type SecurityScan,
  type ArtifactConfig,
  type DeploymentStage,
  type BranchStrategy,
  type CICD,
} from './cicd.schema.js';

// Security Schema
export {
  ComplianceFrameworkSchema,
  IAMPolicySchema,
  SecretsManagementSchema,
  EncryptionSchema,
  NetworkSecuritySchema,
  AuthenticationSchema,
  AuthorizationSchema,
  ComplianceSchema,
  VulnerabilityManagementSchema,
  SecuritySchema,
  type ComplianceFramework,
  type IAMPolicy,
  type SecretsManagement,
  type Encryption,
  type NetworkSecurity,
  type Authentication,
  type Authorization,
  type Compliance,
  type VulnerabilityManagement,
  type Security,
} from './security.schema.js';

// ADR Schema
export {
  ADRStatusSchema,
  StakeholderSchema,
  OptionSchema,
  TradeOffSchema,
  ReconsiderationConditionSchema,
  ReferenceSchema,
  ADRSchema,
  type ADRStatus,
  type Stakeholder,
  type Option,
  type TradeOff,
  type ReconsiderationCondition,
  type Reference,
  type ADR,
} from './adr.schema.js';

// Tenant Schema
export {
  IsolationLevelSchema,
  TenantTierSchema,
  TenantCloudConfigSchema,
  ResourceQuotaSchema,
  TenantFeaturesSchema,
  TenantEnvironmentOverrideSchema,
  TenantSchema,
  type IsolationLevel,
  type TenantTier,
  type TenantCloudConfig,
  type ResourceQuota,
  type TenantFeatures,
  type TenantEnvironmentOverride,
  type Tenant,
} from './tenant.schema.js';

// Rule Schema
export {
  RuleSeveritySchema,
  RuleScopeSchema,
  RuleConditionSchema,
  RemediationSchema,
  RuleCategorySchema,
  RuleSchema,
  RuleSetSchema,
  type RuleSeverity,
  type RuleScope,
  type RuleCondition,
  type Remediation,
  type RuleCategory,
  type Rule,
  type RuleSet,
} from './rule.schema.js';

// Capability Schema
export {
  ArtifactTypeSchema,
  ArtifactRequirementSchema,
  PatternArtifactsSchema,
  CapabilityInputSchema,
  ValidationStepSchema,
  CapabilitySchema,
  CapabilitySetSchema,
  type ArtifactType,
  type ArtifactRequirement,
  type PatternArtifacts,
  type CapabilityInput,
  type ValidationStep,
  type Capability,
  type CapabilitySet,
} from './capability.schema.js';

// Write Response Schemas
export {
  FieldChangeSchema,
  ServiceImpactSchema,
  ArtifactsDeltaSchema,
  ImpactAnalysisSchema,
  WriteResponseSchema,
  DeleteResponseSchema,
  type FieldChange,
  type ServiceImpact,
  type ArtifactsDelta,
  type ImpactAnalysis,
  type WriteResponse,
  type DeleteResponse,
} from './write-responses.schema.js';

// Scan Result Schemas
export {
  DetectedDependencySchema,
  DetectedServiceSchema,
  DetectedCICDSchema,
  DetectedObservabilitySchema,
  DetectedSystemSchema,
  ScanWrittenFilesSchema,
  ScanResultSchema,
  type DetectedDependency,
  type DetectedService,
  type DetectedCICD,
  type DetectedObservability,
  type DetectedSystem,
  type ScanWrittenFiles,
  type ScanResult,
} from './scan-result.schema.js';

// Scaffold Response Schemas
export {
  WorkflowStepSchema,
  ScaffoldResponseSchema,
  ArtifactCheckSchema,
  ReadinessReportSchema,
  type WorkflowStep,
  type ScaffoldResponse,
  type ArtifactCheck,
  type ReadinessReport,
} from './scaffold-responses.schema.js';

// Analysis Response Schemas
export {
  ValidationIssueSchema,
  ValidationReportSchema,
  FieldDiffSchema,
  EnvironmentDiffSchema,
  MigrationStepSchema,
  BreakingChangeSchema,
  MigrationGuideSchema,
  type ValidationIssue,
  type ValidationReport,
  type FieldDiff,
  type EnvironmentDiff,
  type MigrationStep,
  type BreakingChange,
  type MigrationGuide,
} from './analysis-responses.schema.js';
