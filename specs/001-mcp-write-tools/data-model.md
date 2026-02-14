# Data Model: MCP Write Tools

**Branch**: `001-mcp-write-tools` | **Date**: 2026-02-11

## Existing Entities (No Changes)

These entities are defined in `src/core/schemas/` and remain unchanged. Write tools validate against them before writing.

| Entity | Schema File | Identity | Storage |
|--------|-------------|----------|---------|
| System | `system.schema.ts` | Singleton | `architecture/system.yaml` |
| Service | `service.schema.ts` | `name` (unique) | `architecture/services/{name}.yaml` |
| Environment | `environment.schema.ts` | `name` (unique) | `architecture/environments/{name}.yaml` |
| CICD | `cicd.schema.ts` | Singleton | `architecture/cicd.yaml` |
| Observability | `observability.schema.ts` | Singleton | `architecture/observability.yaml` |
| Security | `security.schema.ts` | Singleton | `architecture/security.yaml` |
| ADR | `adr.schema.ts` | `id` (unique) | `architecture/adrs/{id}.yaml` |
| Tenant | `tenant.schema.ts` | `name` (unique) | `architecture/tenants/{name}.yaml` |
| Rule | `rule.schema.ts` | `id` (in RuleSet) | `architecture/rules/*.yaml` |
| Capability | `capability.schema.ts` | `id` (in CapabilitySet) | `architecture/capabilities/*.yaml` |

## New Entities

### WriteResponse\<T\>

Standardized response for all write operations.

```typescript
interface WriteResponse<T> {
  entity: T;                    // The created/updated entity
  filePath: string;             // Absolute path to written file
  operation: 'create' | 'update';
  impact?: ImpactAnalysis;      // Downstream effects (optional)
  nextSteps?: string[];         // Human-readable action items
}
```

**Used by**: create_service, update_service, create_environment, update_environment, update_system, set_cicd, set_observability

### DeleteResponse

Response for delete operations with safety information.

```typescript
interface DeleteResponse {
  deleted: string;              // Entity name
  entityType: 'service' | 'environment';
  filePath: string;             // Path of deleted file
  warnings: string[];           // Orphaned deps, broken refs
  forced: boolean;              // Whether deletion was forced
}
```

**Used by**: delete_service, delete_environment

### ImpactAnalysis

Computed analysis of downstream effects from a change.

```typescript
interface ImpactAnalysis {
  affectedServices: ServiceImpact[];
  affectedEnvironments?: string[];
  artifactsDelta?: ArtifactsDelta;
}

interface ServiceImpact {
  name: string;
  reason: string;               // e.g., "inherits changed runtime defaults"
  fields: FieldChange[];        // Specific fields affected
}

interface FieldChange {
  path: string;                 // Dot-notation (e.g., "runtime.version")
  before: unknown;
  after: unknown;
}

interface ArtifactsDelta {
  added: ArtifactRequirement[];  // New artifacts needed
  removed: ArtifactRequirement[]; // Artifacts no longer needed
}
```

**Used by**: update_service (pattern change), update_system (defaults change), migrate_deployment_pattern

### ScanResult

Output from codebase scanning.

```typescript
interface ScanResult {
  services: DetectedService[];
  cicd?: DetectedCICD;
  observability?: DetectedObservability;
  system?: DetectedSystem;
  scanDuration: number;          // milliseconds
  warnings: string[];
}

interface DetectedService {
  name: string;
  path: string;                  // Relative path in project
  type?: ServiceType;
  runtime?: {
    language: string;
    version?: string;
    framework?: string;
  };
  deploymentPattern?: DeploymentPattern;
  deploymentEvidence: string[];  // e.g., ["Dockerfile found", "k8s/deployment.yaml found"]
  dependencies: DetectedDependency[];
  confidence: number;            // 0.0 - 1.0
}

interface DetectedDependency {
  targetService: string;         // Name of dependency (must match another detected service)
  type: 'sync' | 'async' | 'unknown';
  protocol?: string;             // http, grpc, amqp, etc.
  evidence: string;              // e.g., "HTTP client import to user-service found in src/clients/user.ts"
}

interface DetectedCICD {
  provider: string;
  configFile: string;
  steps: string[];               // Detected step names
}

interface DetectedObservability {
  tools: string[];               // e.g., ["datadog", "prometheus"]
  evidence: string[];
}

interface DetectedSystem {
  name?: string;                 // From package.json or repo name
  cloud?: string;                // Inferred from infra files
  region?: string;
}
```

**Used by**: scan_codebase

### WorkflowStep

Ordered step in a scaffolding workflow.

```typescript
interface WorkflowStep {
  stepNumber: number;
  category: 'code' | 'infrastructure' | 'testing' | 'observability' | 'security' | 'documentation';
  title: string;
  description: string;
  artifacts: ArtifactRequirement[];  // From capability schema
  patternSpecific: boolean;          // Whether step varies by deployment pattern
  environmentNotes: Record<string, string>;  // Per-env variations
}
```

**Used by**: scaffold_service, scaffold_environment

### ScaffoldResponse

Full scaffolding output combining service creation with workflow.

```typescript
interface ScaffoldResponse {
  service: Service;              // Created service config
  filePath: string;
  workflow: WorkflowStep[];      // Ordered steps
  checklist: string[];           // Flat human-readable checklist
}
```

**Used by**: scaffold_service

### ReadinessReport

Service readiness assessment.

```typescript
interface ReadinessReport {
  serviceName: string;
  deploymentPattern: string;
  readinessScore: number;        // 0-100
  completed: ArtifactCheck[];
  missing: ArtifactCheck[];
  recommendations: string[];
}

interface ArtifactCheck {
  type: string;                  // ArtifactType from capability schema
  name: string;
  required: boolean;
  exists: boolean;
  path?: string;                 // Where it was found (if exists)
}
```

**Used by**: check_service_readiness

### ValidationReport

Cross-entity validation results.

```typescript
interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: string[];
  dependencyAnalysis: {
    cycles: string[][];
    orphans: string[];
    missingRefs: string[];
  };
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  entity: string;
  entityType: string;
  path: string;
  message: string;
  suggestion?: string;
}
```

**Used by**: validate_architecture

### EnvironmentDiff

Environment comparison output.

```typescript
interface EnvironmentDiff {
  envA: string;
  envB: string;
  differences: FieldDiff[];
  summary: string;
}

interface FieldDiff {
  path: string;
  valueA: unknown;
  valueB: unknown;
  onlyIn?: 'A' | 'B';          // Field exists in only one env
}
```

**Used by**: diff_environments

### MigrationGuide

Deployment pattern migration output.

```typescript
interface MigrationGuide {
  service: Service;              // Updated service config
  fromPattern: string;
  toPattern: string;
  artifactsToAdd: ArtifactRequirement[];
  artifactsToRemove: ArtifactRequirement[];
  migrationSteps: MigrationStep[];
  breakingChanges: BreakingChange[];
}

interface MigrationStep {
  order: number;
  title: string;
  description: string;
  category: string;
}

interface BreakingChange {
  what: string;                  // What will break
  why: string;                   // Why it breaks
  fix: string;                   // How to fix it
}
```

**Used by**: migrate_deployment_pattern

## Entity Relationships

```
System (1) ──inherits──> Service (many)     [system defaults resolve at read time]
Service (many) ──depends on──> Service (many) [cycle detection enforced]
Service (many) ──overrides──> Environment (many) [via service.environments.{env}]
Environment (many) ──applies to──> Service (many) [via resolution engine]
Capability (many) ──defines artifacts for──> DeploymentPattern (many)
ScanResult ──generates──> Service, CICD, Observability, System [after user confirmation]
```

## Validation Rules

| Rule | Enforced At | FR |
|------|-------------|-----|
| Service name uniqueness | `createService()` | FR-004 |
| Schema validation before write | All write methods | FR-003 |
| No circular dependencies | `createService()`, `updateService()` | FR-006 |
| Dependent check before delete | `deleteService()` | FR-007 |
| Cache invalidation after write | All write methods | FR-010 |
| Scan results require user confirmation | `scanCodebase()` | FR-029 |
| Array fields replace entirely | `deepMerge()` with `arrayStrategy: 'replace'` | FR-005 |
| Service YAML = minimal overrides only | `createService()` | FR-002 |
