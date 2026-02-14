# MCP Tool Contracts: Write Tools

## create_service

**Name**: `create_service`
**Category**: Write
**FR**: FR-001, FR-002, FR-003, FR-004, FR-006, FR-010

```typescript
// Input Schema (Zod)
z.object({
  name: z.string().describe('Service name (must be unique)'),
  type: ServiceTypeSchema.describe('Service type'),
  deployment_pattern: DeploymentPatternSchema.describe('Deployment pattern'),
  description: z.string().optional().describe('Service description'),
  dependencies: z.array(z.object({
    name: z.string(),
    type: z.enum(['sync', 'async']).optional(),
    protocol: z.string().optional()
  })).optional().describe('Service dependencies'),
  owner: z.string().optional().describe('Team or person owning this service')
})

// Response: WriteResponse<Service>
{
  entity: Service,           // Created config (minimal overrides only)
  filePath: string,          // architecture/services/{name}.yaml
  operation: 'create',
  impact: null,              // No impact on creation
  nextSteps: string[]        // Checklist from capabilities
}

// Errors:
// - 409: Service with name already exists
// - 400: Schema validation failure
// - 400: Circular dependency detected
// - 503: Architecture directory not initialized
```

## update_service

**Name**: `update_service`
**Category**: Write
**FR**: FR-005, FR-006, FR-010, FR-011, FR-012

```typescript
// Input Schema
z.object({
  name: z.string().describe('Existing service name'),
  updates: z.record(z.unknown()).describe('Partial service config to deep-merge')
})

// Response: WriteResponse<Service>
{
  entity: Service,           // Updated config
  filePath: string,
  operation: 'update',
  impact: {
    affectedServices: ServiceImpact[],  // If deps changed
    artifactsDelta: ArtifactsDelta      // If pattern changed
  },
  nextSteps: string[]
}

// Errors:
// - 404: Service not found
// - 400: Merged config fails validation
// - 400: Circular dependency detected
```

## delete_service

**Name**: `delete_service`
**Category**: Write
**FR**: FR-007, FR-010

```typescript
// Input Schema
z.object({
  name: z.string().describe('Service to delete'),
  force: z.boolean().optional().default(false).describe('Skip dependency check')
})

// Response: DeleteResponse
{
  deleted: string,
  entityType: 'service',
  filePath: string,
  warnings: string[],       // Broken dependencies if forced
  forced: boolean
}

// Errors:
// - 404: Service not found
// - 409: Has dependents (when force=false), returns dependent list
```

## create_environment

**Name**: `create_environment`
**Category**: Write
**FR**: FR-003, FR-010, FR-017

```typescript
// Input Schema
z.object({
  name: z.string().describe('Environment name'),
  base_template: z.enum(['dev', 'staging', 'prod']).optional()
    .describe('Apply smart defaults from template'),
  availability: z.object({...}).optional(),
  scaling: z.object({...}).optional(),
  security_level: z.enum(['relaxed', 'standard', 'strict', 'paranoid']).optional()
})

// Response: WriteResponse<Environment>
{
  entity: Environment,
  filePath: string,          // architecture/environments/{name}.yaml
  operation: 'create',
  impact: {
    affectedServices: string[]  // Services with env-specific overrides
  },
  nextSteps: string[]
}
```

## update_environment

**Name**: `update_environment`
**Category**: Write
**FR**: FR-005, FR-010, FR-013

```typescript
// Input Schema
z.object({
  name: z.string().describe('Existing environment name'),
  updates: z.record(z.unknown()).describe('Partial environment config')
})

// Response: WriteResponse<Environment>
```

## delete_environment

**Name**: `delete_environment`
**Category**: Write
**FR**: FR-008, FR-010

```typescript
// Input Schema
z.object({
  name: z.string().describe('Environment to delete')
})

// Response: DeleteResponse
{
  deleted: string,
  entityType: 'environment',
  filePath: string,
  warnings: string[]         // Orphaned service.environments.{name} sections
}
```

## update_system

**Name**: `update_system`
**Category**: Write
**FR**: FR-005, FR-010, FR-011

```typescript
// Input Schema
z.object({
  updates: z.record(z.unknown()).describe('Partial system config')
})

// Response: WriteResponse<System>
{
  entity: System,
  filePath: string,          // architecture/system.yaml
  operation: 'update',
  impact: {
    affectedServices: ServiceImpact[]  // Services inheriting changed defaults
  }
}
```

## set_cicd

**Name**: `set_cicd`
**Category**: Write
**FR**: FR-009, FR-010

```typescript
// Input Schema
z.object({
  provider: PipelineProviderSchema.optional(),
  steps: z.array(PipelineStepSchema).optional(),
  quality_gates: z.array(QualityGateSchema).optional(),
  config: z.record(z.unknown()).optional().describe('Additional CI/CD config')
})

// Response: WriteResponse<CICD>
// Behavior: Creates if not exists, merges if exists (upsert)
```

## set_observability

**Name**: `set_observability`
**Category**: Write
**FR**: FR-009, FR-010

```typescript
// Input Schema
z.object({
  logging: z.object({...}).optional(),
  metrics: z.object({...}).optional(),
  tracing: z.object({...}).optional(),
  alerting: z.object({...}).optional(),
  config: z.record(z.unknown()).optional()
})

// Response: WriteResponse<Observability>
// Behavior: Creates if not exists, merges if exists (upsert)
```
