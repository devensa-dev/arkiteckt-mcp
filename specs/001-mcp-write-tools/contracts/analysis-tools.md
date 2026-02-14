# MCP Tool Contracts: Analysis Tools

## validate_architecture

**Name**: `validate_architecture`
**Category**: Analysis
**FR**: FR-021

```typescript
// Input Schema
z.object({
  scope: z.enum(['all', 'services', 'environments', 'dependencies', 'security'])
    .optional().default('all').describe('Validation scope')
})

// Response: ValidationReport
{
  valid: false,
  issues: [
    {
      severity: 'error',
      entity: 'order-service',
      entityType: 'service',
      path: 'dependencies[2].name',
      message: 'Dependency "analytics-service" does not exist',
      suggestion: 'Remove the dependency or create the analytics-service'
    },
    {
      severity: 'warning',
      entity: 'user-service',
      entityType: 'service',
      path: 'observability.slo',
      message: 'No SLO defined for production service',
      suggestion: 'Add availability and latency SLO targets'
    }
  ],
  warnings: [
    'Environment "staging" has no services with environment-specific overrides'
  ],
  dependencyAnalysis: {
    cycles: [],                // Detected circular deps
    orphans: ['legacy-api'],   // Services with no dependents and no dependencies
    missingRefs: ['analytics-service']  // Referenced but not defined
  }
}
```

**Validation checks performed**:
1. All service dependencies reference existing services
2. No circular dependencies in dependency graph
3. All services pass schema validation
4. All environments pass schema validation
5. Services with env-specific overrides reference existing environments
6. Production services have SLO definitions (warning)
7. Services have appropriate resilience config for their dependency count (info)
8. Security levels are consistent (e.g., prod env not using "relaxed" security)

## diff_environments

**Name**: `diff_environments`
**Category**: Analysis
**FR**: FR-020

```typescript
// Input Schema
z.object({
  env_a: z.string().describe('First environment name'),
  env_b: z.string().describe('Second environment name'),
  service_name: z.string().optional()
    .describe('Resolve diff for a specific service (shows merged config differences)')
})

// Response: EnvironmentDiff
{
  envA: 'staging',
  envB: 'prod',
  differences: [
    {
      path: 'availability.replicas',
      valueA: 2,
      valueB: 5
    },
    {
      path: 'availability.multiAZ',
      valueA: true,
      valueB: true
    },
    {
      path: 'security.level',
      valueA: 'standard',
      valueB: 'strict'
    },
    {
      path: 'disasterRecovery',
      valueA: undefined,
      valueB: { strategy: 'active-passive', rto: 4, rpo: 1 },
      onlyIn: 'B'
    }
  ],
  summary: 'Prod has 3 more replicas, stricter security, and disaster recovery enabled. 4 fields differ.'
}

// With service_name: resolves both environments for that service
// and shows the merged config differences (not just raw env differences)
```
