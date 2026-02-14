# MCP Tool Contracts: Scaffold & Guidance Tools

## scaffold_service

**Name**: `scaffold_service`
**Category**: Scaffold
**FR**: FR-014, FR-015, FR-016

```typescript
// Input Schema
z.object({
  name: z.string().describe('Service name'),
  type: ServiceTypeSchema.describe('Service type'),
  deployment_pattern: DeploymentPatternSchema.describe('Deployment pattern'),
  description: z.string().optional(),
  dependencies: z.array(z.object({
    name: z.string(),
    type: z.enum(['sync', 'async']).optional(),
    protocol: z.string().optional()
  })).optional()
})

// Response: ScaffoldResponse
{
  service: Service,            // Created config
  filePath: string,
  workflow: [
    {
      stepNumber: 1,
      category: 'code',
      title: 'Create source code structure',
      description: 'Set up the service entry point...',
      artifacts: [...],        // From capability requirements
      patternSpecific: true,
      environmentNotes: {
        dev: 'Use local dependencies',
        prod: 'Use container registry'
      }
    },
    // ... more steps
  ],
  checklist: [
    '1. [code] Create source code structure',
    '2. [infrastructure] Set up deployment configuration',
    '3. [testing] Write unit and integration tests',
    // ...
  ]
}
```

**Internal flow**:
1. Call `store.createService()` to write YAML
2. Call `store.getCapabilities()` to find artifacts for deployment pattern
3. Call `store.getCICD()` for pipeline steps
4. Call `store.getObservability()` for monitoring setup
5. Call `store.getEnvironments()` for environment variations
6. Assemble workflow steps ordered by category

## scaffold_environment

**Name**: `scaffold_environment`
**Category**: Scaffold
**FR**: FR-017

```typescript
// Input Schema
z.object({
  name: z.string().describe('Environment name'),
  base_template: z.enum(['dev', 'staging', 'prod']).optional()
})

// Response
{
  environment: Environment,
  filePath: string,
  serviceImpacts: ServiceImpact[],     // What each service should configure for this env
  infrastructureSteps: string[],       // What infra to provision
  securityChecklist: string[]          // Security requirements for this tier
}
```

## explain_architecture

**Name**: `explain_architecture`
**Category**: Scaffold
**FR**: FR-018, FR-019, FR-032, FR-033

```typescript
// Input Schema
z.object({
  focus: z.enum(['overview', 'services', 'environments', 'deployment', 'security', 'observability'])
    .optional().default('overview').describe('Focus area'),
  service_name: z.string().optional().describe('Focus on one service')
})

// Response (overview mode)
{
  system: { name, style, cloud, region },
  services: [
    { name, type, pattern, dependencyCount, owner }
  ],
  environments: [
    { name, tier, securityLevel }
  ],
  dependencyGraph: {
    nodes: string[],
    edges: [{ from, to, type, protocol }]
  },
  techStack: {
    language, framework, cloud, ciProvider, observabilityProviders
  },
  statistics: {
    serviceCount, environmentCount, totalDependencies
  }
}

// Response (service focus mode)
{
  service: Service,            // Full resolved config
  dependencies: {
    direct: Service[],
    transitive: Service[]
  },
  environmentVariations: Record<string, Partial<Service>>,
  capabilityChecklist: ArtifactRequirement[],
  relatedADRs: ADR[]
}
```

## check_service_readiness

**Name**: `check_service_readiness`
**Category**: Scaffold
**FR**: FR-022

```typescript
// Input Schema
z.object({
  service_name: z.string().describe('Service to check'),
  environment: z.string().optional().describe('Check readiness for specific env')
})

// Response: ReadinessReport
{
  serviceName: string,
  deploymentPattern: string,
  readinessScore: 75,          // 0-100
  completed: [
    { type: 'source-code', name: 'Service entry point', required: true, exists: true, path: 'src/main.ts' }
  ],
  missing: [
    { type: 'dockerfile', name: 'Container image', required: true, exists: false }
  ],
  recommendations: [
    'Create Dockerfile for container deployment',
    'Add health check endpoint at /health'
  ]
}
```

## migrate_deployment_pattern

**Name**: `migrate_deployment_pattern`
**Category**: Scaffold
**FR**: FR-023

```typescript
// Input Schema
z.object({
  service_name: z.string().describe('Service to migrate'),
  new_pattern: DeploymentPatternSchema.describe('Target deployment pattern')
})

// Response: MigrationGuide
{
  service: Service,
  fromPattern: 'lambda',
  toPattern: 'kubernetes',
  artifactsToAdd: [
    { type: 'dockerfile', name: 'Container image', ... },
    { type: 'k8s-manifest', name: 'Kubernetes deployment', ... }
  ],
  artifactsToRemove: [
    { type: 'sam-template', name: 'SAM template', ... }
  ],
  migrationSteps: [
    { order: 1, title: 'Create Dockerfile', description: '...', category: 'infrastructure' },
    { order: 2, title: 'Create K8s manifests', description: '...', category: 'infrastructure' },
    { order: 3, title: 'Update CI/CD pipeline', description: '...', category: 'ci' }
  ],
  breakingChanges: [
    { what: 'API Gateway routing', why: 'Lambda uses API Gateway; K8s uses Ingress', fix: 'Create Ingress resource' }
  ]
}
```
