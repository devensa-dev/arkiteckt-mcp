# MCP Tool Contracts: Codebase Scanning Tools

## scan_codebase

**Name**: `scan_codebase`
**Category**: Scan
**FR**: FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031

```typescript
// Input Schema
z.object({
  root_path: z.string().optional()
    .describe('Project root to scan (defaults to current working directory)'),
  write: z.boolean().optional().default(false)
    .describe('If true, write detected architecture to YAML files after presenting results')
})

// Response: ScanResult (when write=false, preview mode)
{
  services: [
    {
      name: 'order-service',
      path: 'services/order-service',
      type: 'backend',
      runtime: {
        language: 'typescript',
        version: '20',
        framework: 'express'
      },
      deploymentPattern: 'ecs_fargate',
      deploymentEvidence: [
        'Dockerfile found at services/order-service/Dockerfile',
        'ECS task definition at services/order-service/infra/task-def.json'
      ],
      dependencies: [
        {
          targetService: 'user-service',
          type: 'sync',
          protocol: 'http',
          evidence: 'HTTP client import in services/order-service/src/clients/user-client.ts'
        },
        {
          targetService: 'payment-service',
          type: 'async',
          protocol: 'amqp',
          evidence: 'RabbitMQ producer in services/order-service/src/events/payment.ts'
        }
      ],
      confidence: 0.92
    },
    {
      name: 'user-service',
      path: 'services/user-service',
      type: 'api',
      runtime: {
        language: 'typescript',
        version: '20',
        framework: 'express'
      },
      deploymentPattern: 'lambda',
      deploymentEvidence: [
        'serverless.yml found at services/user-service/serverless.yml'
      ],
      dependencies: [],
      confidence: 0.95
    }
  ],
  cicd: {
    provider: 'github-actions',
    configFile: '.github/workflows/ci.yml',
    steps: ['lint', 'test', 'build', 'deploy']
  },
  observability: {
    tools: ['datadog'],
    evidence: ['datadog.yaml found at root', 'dd-trace import in services/order-service/src/main.ts']
  },
  system: {
    name: 'ecommerce-platform',
    cloud: 'aws',
    region: 'us-east-1'
  },
  scanDuration: 3500,
  warnings: [
    'Service "shared-lib" detected at libs/shared but appears to be a library, not a deployable service',
    'Could not determine deployment pattern for "analytics-worker" — no Dockerfile or serverless config found'
  ]
}

// Response (when write=true, commit mode)
// Same as above, plus:
{
  // ...scan results...
  written: {
    files: [
      'architecture/system.yaml',
      'architecture/services/order-service.yaml',
      'architecture/services/user-service.yaml',
      'architecture/cicd.yaml',
      'architecture/observability.yaml'
    ],
    skipped: [],
    errors: []
  }
}
```

**Detection strategies**:

| What | How | Files Checked |
|------|-----|---------------|
| Services | Directory with build file | `package.json`, `pom.xml`, `go.mod`, `requirements.txt`, `Cargo.toml`, `build.gradle` |
| Runtime language | Build file type + config | `.nvmrc`, `runtime.txt`, `go.mod`, `pom.xml` properties |
| Runtime framework | Dependency analysis | `express` in package.json, `spring-boot` in pom.xml, etc. |
| Deployment pattern | Infrastructure files | `Dockerfile`, `serverless.yml`, `k8s/`, `terraform/`, `docker-compose.yml` |
| CI/CD provider | Pipeline config | `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml` |
| Dependencies | Source code imports | HTTP client files, message queue producers/consumers, service URLs |
| Observability | Config files + imports | `datadog.yaml`, prometheus configs, OpenTelemetry imports |
| System info | Root project files | Root `package.json` name, git remote URL, cloud provider from infra |

**Monorepo vs Polyrepo detection**:
- Monorepo: Root `package.json` with `workspaces`, or multiple service directories under a common root
- Polyrepo: Single service at root level

**Confidence scoring**:
- 1.0: Build file + infrastructure file + explicit type indicator
- 0.8-0.9: Build file + infrastructure file
- 0.6-0.7: Build file only (deployment pattern inferred from conventions)
- 0.3-0.5: Directory with source files but no build file
- < 0.3: Ambiguous — presented as warning, not as detected service
