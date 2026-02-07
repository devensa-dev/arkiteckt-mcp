# Next Plan: Write Tools, Scaffolding & Architecture Mutation

## Problem Statement

Phase 1 built a **read-only** architecture MCP server. AI tools and developers can **query** architecture context but cannot **create, update, or evolve** it through the MCP protocol. This forces developers to manually write raw YAML files — bypassing schema validation, resolution logic, and the guided workflows that make architecture-as-code accessible to developers of all levels.

The core promise of Arkiteckt is: **a junior developer who doesn't know the full architecture can ask AI to create a new service, and the MCP ensures it's done correctly** — right deployment pattern, right CI/CD steps, right observability setup, right security posture. Today, the MCP can explain what's needed but can't execute it.

---

## Vision

Arkiteckt MCP is the **bridge between developers and architecture**. Not everyone understands the full solution architecture — how many environments exist, what observability tools are used, how production differs from development, what steps are required to create a new service. With write and scaffolding tools:

1. **Junior developer** asks AI: "Create a new payment service" → MCP returns the full checklist AND can write the validated YAML
2. **Senior developer** asks AI: "Add a staging environment with reduced replicas" → MCP creates it with proper security defaults inherited from the system config
3. **Tech lead** asks AI: "Update the order-service to use kubernetes instead of lambda" → MCP updates the service config and flags which artifacts need to change
4. **AI agent** autonomously resolves what's needed based on architecture context — no scanning the entire codebase, no guessing

Future: These YAML files become the single source of truth that powers **visual architecture diagrams**, **health dashboards** (which service is up/down per environment), and **terraform auto-generation**.

---

## What Exists Today (Phase 1 — Read Only)

### 6 Read Tools
| Tool | Purpose |
|------|---------|
| `get_system_context` | Global architecture config |
| `get_service_context` | Service config with resolution |
| `get_environment_context` | Environment profiles |
| `get_ci_requirements` | CI/CD pipeline config |
| `get_observability_requirements` | Logging, metrics, tracing |
| `get_capability_requirements` | Artifact checklists for operations |

### 11 Schemas (Zod v4)
system, service, environment, observability, cicd, security, adr, tenant, rule, capability

### Store
- `init()` — creates directory structure (one-time)
- 13 read methods — all query-only
- In-memory caching with TTL
- **No create/update/delete methods**

### Resolution Engine
- 7-layer merge: System → Service → Service.env → Environment → Tenant → Tenant.env → Tenant.service
- Deep merge with source tracking
- Cycle detection for service dependencies

---

## New MCP Tools Required

### Category 1: Entity Write Tools (CRUD)

These tools create, update, and delete architecture YAML files with full schema validation.

#### `create_service`
**Purpose**: Create a new service YAML file with validated configuration.
**Why it matters**: A new developer doesn't know the project's deployment patterns, dependency conventions, or required observability setup. This tool ensures every new service starts correctly.

```
Input:
  name: string (required) — service name
  type: enum — api | backend | worker | scheduled | event-processor | frontend
  deployment_pattern: enum — lambda | ecs_fargate | kubernetes | etc.
  description: string (optional)
  dependencies: string[] (optional) — names of services this depends on
  owner: string (optional) — team/person

Behavior:
  1. Validate name doesn't conflict with existing services
  2. Load system defaults (runtime, region, tags)
  3. Load capability requirements for the deployment pattern
  4. Generate service YAML with:
     - System defaults applied (language, version, framework)
     - Pattern-appropriate container/deployment config
     - Resilience defaults based on dependency count
     - Observability profile from system config
  5. Validate against ServiceSchema
  6. Write to architecture/services/{name}.yaml
  7. Return: created file path + full capability checklist (what the developer needs to do next)

Output:
  service: Service — the created config
  file_path: string — where it was written
  checklist: ArtifactRequirement[] — what needs to be built for this service
  next_steps: string[] — human-readable action items
```

#### `update_service`
**Purpose**: Update an existing service configuration with validation.
**Why it matters**: When changing deployment patterns (lambda → kubernetes) or adding dependencies, the MCP knows what downstream impacts exist.

```
Input:
  name: string (required) — existing service name
  updates: Partial<Service> — fields to update (deep merged)

Behavior:
  1. Load existing service config
  2. Deep merge updates into existing config
  3. Validate merged result against ServiceSchema
  4. If deployment.pattern changed → return new artifact requirements delta
  5. If dependencies changed → run cycle detection
  6. Write updated YAML
  7. Return: updated config + impact analysis

Output:
  service: Service — updated config
  changes: ChangeSummary — what fields changed
  impact: ImpactAnalysis — downstream effects (new artifacts needed, removed artifacts, affected environments)
```

#### `create_environment`
**Purpose**: Create a new environment profile with sensible defaults based on environment type.
**Why it matters**: A developer adding a "staging" environment doesn't know the project's security levels, scaling policies, or DR requirements for that tier.

```
Input:
  name: string (required) — environment name
  base_template: enum (optional) — dev | staging | prod (provides smart defaults)
  availability: object (optional) — override defaults
  scaling: object (optional)
  security_level: enum (optional) — relaxed | standard | strict | paranoid

Behavior:
  1. Load system config for global defaults
  2. Apply tier-appropriate defaults:
     - dev: 1 replica, no multi-AZ, relaxed security
     - staging: 2 replicas, multi-AZ, standard security
     - prod: 3+ replicas, multi-AZ, strict security, DR enabled
  3. Merge user overrides
  4. Validate against EnvironmentSchema
  5. Write to architecture/environments/{name}.yaml
  6. Return: created environment + what services will be affected

Output:
  environment: Environment — created config
  file_path: string
  affected_services: string[] — services that have environment-specific overrides for this env name
```

#### `update_environment`
**Purpose**: Update an existing environment's configuration.

```
Input:
  name: string (required)
  updates: Partial<Environment>

Behavior:
  1. Load existing, merge, validate, write
  2. Return impact on services resolved against this environment
```

#### `update_system`
**Purpose**: Update system-level configuration (defaults, architecture style, team info).
**Why it matters**: When a tech lead changes the default runtime from Node 18 to Node 20, all services inheriting system defaults should reflect this.

```
Input:
  updates: Partial<System> — fields to update

Behavior:
  1. Load existing system.yaml
  2. Deep merge updates
  3. Validate against SystemSchema
  4. Calculate impact: which services inherit changed defaults
  5. Write updated YAML
  6. Return: updated system + list of affected services

Output:
  system: System — updated config
  affected_services: ServiceImpact[] — services that inherit changed defaults (with before/after)
```

#### `set_cicd`
**Purpose**: Create or update CI/CD pipeline configuration.

```
Input:
  provider: enum — github-actions | gitlab-ci | jenkins | etc.
  steps: PipelineStep[] (optional) — override defaults
  quality_gates: QualityGate[] (optional)

Behavior:
  1. If exists, load and merge. If not, create from provider template.
  2. Validate against CICDSchema
  3. Write architecture/cicd.yaml
```

#### `set_observability`
**Purpose**: Create or update observability configuration.

```
Input:
  logging: object (optional)
  metrics: object (optional)
  tracing: object (optional)
  alerting: object (optional)

Behavior:
  1. If exists, load and merge. If not, create with defaults.
  2. Validate against ObservabilitySchema
  3. Write architecture/observability.yaml
```

#### `delete_service`
**Purpose**: Remove a service and detect orphaned dependencies.

```
Input:
  name: string (required)
  force: boolean (default: false) — skip dependency check

Behavior:
  1. Check if any other services depend on this one
  2. If dependents exist and force=false → return error with dependent list
  3. Delete architecture/services/{name}.yaml
  4. Return: deleted service + warnings about dependents
```

#### `delete_environment`
**Purpose**: Remove an environment profile.

```
Input:
  name: string (required)

Behavior:
  1. Check which services have environment-specific overrides for this env
  2. Warn about orphaned service.environments.{name} sections
  3. Delete architecture/environments/{name}.yaml
```

---

### Category 2: Scaffolding & Guidance Tools

These tools don't just write files — they provide the **complete workflow** for architectural operations.

#### `scaffold_service`
**Purpose**: Full guided service creation — creates the YAML AND returns the complete step-by-step todo list a developer must follow.
**Why it matters**: This is the core "bridge" tool. A junior dev asks AI "create a payment service" and gets everything: the config file, the artifact checklist, the exact steps.

```
Input:
  name: string (required)
  type: enum (required)
  deployment_pattern: enum (required)
  description: string (optional)
  dependencies: string[] (optional)

Behavior:
  1. Call create_service internally to write the YAML
  2. Call get_capability_requirements("create_service", pattern) for artifact checklist
  3. Call get_ci_requirements() for pipeline steps
  4. Call get_observability_requirements() for monitoring setup
  5. Load environment configs to show env-specific variations
  6. Generate comprehensive workflow:
     a. Architecture files created ✓
     b. Source code structure to create
     c. Tests to write (unit, integration, e2e)
     d. Infrastructure files to create (Dockerfile, terraform, helm, etc.)
     e. CI/CD pipeline configuration
     f. Observability setup (logging, metrics, health checks)
     g. Security checklist (IAM, secrets, encryption)
     h. Documentation to write

Output:
  service: Service — created config
  workflow: WorkflowStep[] — ordered steps with:
    - step_number: number
    - category: string (code | infrastructure | testing | observability | security | documentation)
    - title: string
    - description: string
    - artifacts: ArtifactRequirement[]
    - pattern_specific: boolean — whether this step is specific to the deployment pattern
    - environment_notes: Record<string, string> — per-env variations
  checklist: string[] — flat human-readable checklist for quick reference
```

#### `scaffold_environment`
**Purpose**: Create an environment with full guidance on what needs to change across the system.

```
Input:
  name: string
  base_template: dev | staging | prod

Output:
  environment: Environment
  service_impacts: ServiceImpact[] — for each service, what env-specific config should be added
  infrastructure_steps: string[] — what infra needs to be provisioned
  security_checklist: string[] — security requirements for this env tier
```

#### `explain_architecture`
**Purpose**: Return a structured summary of the entire architecture — for AI context loading or developer onboarding.
**Why it matters**: Instead of scanning the entire codebase, an AI agent calls this once and understands everything.

```
Input:
  focus: enum (optional) — overview | services | environments | deployment | security | observability
  service_name: string (optional) — focus on one service's full picture

Output (overview):
  system: { name, style, cloud, region }
  services: ServiceSummary[] — name, type, pattern, dependency count
  environments: EnvironmentSummary[] — name, tier, security level
  dependency_graph: { nodes: string[], edges: [string, string][] }
  tech_stack: { language, framework, cloud, ci_provider, observability_providers }
  statistics: { service_count, environment_count, total_dependencies }

Output (service focus):
  service: Service — full resolved config
  dependencies: { direct: Service[], transitive: Service[] }
  environment_variations: Record<string, Partial<Service>> — how config changes per env
  capability_checklist: ArtifactRequirement[] — all artifacts needed
  related_adrs: ADR[] — architecture decisions affecting this service
```

#### `check_service_readiness`
**Purpose**: Given a service, check whether all required artifacts exist (are the todos from the checklist actually done?).
**Why it matters**: After scaffolding, developers need to know "am I done?" This tool checks.

```
Input:
  service_name: string (required)
  environment: string (optional) — check readiness for specific env

Behavior:
  1. Load service config
  2. Load capability requirements for service's deployment pattern
  3. For each required artifact, check if corresponding file/config exists:
     - Dockerfile exists? (for container patterns)
     - CI pipeline configured?
     - Health check endpoint defined?
     - Observability configured?
     - Tests exist?
  4. Return completeness report

Output:
  service_name: string
  deployment_pattern: string
  readiness_score: number (0-100)
  completed: ArtifactCheck[] — artifacts that exist
  missing: ArtifactCheck[] — artifacts still needed
  recommendations: string[] — prioritized next actions
```

#### `migrate_deployment_pattern`
**Purpose**: Guide migration when a service changes deployment pattern (e.g., lambda → kubernetes).

```
Input:
  service_name: string
  new_pattern: enum

Output:
  updated_service: Service
  artifacts_to_add: ArtifactRequirement[] — new artifacts needed
  artifacts_to_remove: ArtifactRequirement[] — artifacts no longer needed
  migration_steps: MigrationStep[] — ordered migration workflow
  breaking_changes: string[] — what will break and how to fix it
```

---

### Category 3: Validation & Analysis Tools

#### `validate_architecture`
**Purpose**: Deep validation beyond schema — cross-entity consistency checks.
**Extends existing `arch validate` with MCP-accessible deeper analysis.**

```
Input:
  scope: enum — all | services | environments | dependencies | security

Output:
  valid: boolean
  issues: ValidationIssue[] — with severity, entity, path, message, suggestion
  warnings: string[] — non-blocking concerns
  dependency_analysis: { cycles: string[][], orphans: string[], missing_refs: string[] }
```

#### `diff_environments`
**Purpose**: Compare two environments to show exactly what differs.
**Why it matters**: "What's different between staging and prod?" is a constant question.

```
Input:
  env_a: string
  env_b: string
  service_name: string (optional) — resolve for a specific service

Output:
  differences: FieldDiff[] — path, env_a_value, env_b_value
  summary: string — human-readable comparison
```

---

## Implementation Phases

### Phase 2A: Store Write Layer (Foundation)

**Goal**: Add write/update/delete methods to ArchitectureStore.

#### Tasks

1. **Add write methods to ArchitectureStore**
   - `createService(name, config)` → validates, writes YAML, invalidates cache
   - `updateService(name, updates)` → loads, deep merges, validates, writes
   - `deleteService(name)` → deletes file, invalidates cache
   - `createEnvironment(name, config)` → same pattern
   - `updateEnvironment(name, updates)`
   - `deleteEnvironment(name)`
   - `updateSystem(updates)` → merge into existing system.yaml
   - `setCICD(config)` → create or update cicd.yaml
   - `setObservability(config)` → create or update observability.yaml

2. **Add YAML serialization to yaml-parser**
   - `serializeToYaml(data)` → converts JS object to clean YAML string
   - Preserve comments where possible (use `yaml` library's document model)
   - Consistent formatting (2-space indent, no flow style for objects)

3. **Add impact analysis engine**
   - `analyzeServiceImpact(serviceName)` → which other services depend on this
   - `analyzeDefaultsImpact(changedDefaults)` → which services inherit these defaults
   - `analyzeEnvironmentImpact(envName)` → which services have overrides for this env

4. **Add dependency validation**
   - On service create/update: validate all referenced dependencies exist
   - On service delete: check for dependents
   - Use existing cycle-detector for circular dependency prevention

5. **Unit tests for all write operations**

#### Files to Create/Modify
| Action | File |
|--------|------|
| Modify | `src/core/store/architecture-store.ts` — add write methods |
| Create | `src/core/store/yaml-serializer.ts` — YAML write utility |
| Create | `src/core/engines/impact-analyzer.ts` — impact analysis |
| Create | `tests/unit/store/write-operations.test.ts` |
| Create | `tests/unit/engines/impact-analyzer.test.ts` |

---

### Phase 2B: Entity Write MCP Tools

**Goal**: Expose write operations as MCP tools.

#### Tasks

1. **Implement MCP write tools**
   - `create_service` tool + handler
   - `update_service` tool + handler
   - `delete_service` tool + handler
   - `create_environment` tool + handler
   - `update_environment` tool + handler
   - `delete_environment` tool + handler
   - `update_system` tool + handler
   - `set_cicd` tool + handler
   - `set_observability` tool + handler

2. **Register tools in server/index.ts**

3. **Add write tool response types**
   - `WriteResponse<T>` — includes created/updated entity, file path, impact analysis
   - `DeleteResponse` — includes deleted entity, warnings

4. **Integration tests via InMemoryTransport**

#### Files to Create/Modify
| Action | File |
|--------|------|
| Create | `src/server/tools/write/create-service.ts` |
| Create | `src/server/tools/write/update-service.ts` |
| Create | `src/server/tools/write/delete-service.ts` |
| Create | `src/server/tools/write/create-environment.ts` |
| Create | `src/server/tools/write/update-environment.ts` |
| Create | `src/server/tools/write/delete-environment.ts` |
| Create | `src/server/tools/write/update-system.ts` |
| Create | `src/server/tools/write/set-cicd.ts` |
| Create | `src/server/tools/write/set-observability.ts` |
| Create | `src/server/tools/write/index.ts` |
| Modify | `src/server/index.ts` — register write tools |
| Create | `tests/integration/tools/write/` — integration tests |
| Create | `tests/e2e/write-tools.test.ts` — e2e tests |

---

### Phase 2C: Scaffolding & Guidance Tools

**Goal**: High-level tools that combine reads + writes + capability lookups into guided workflows.

#### Tasks

1. **Implement scaffolding tools**
   - `scaffold_service` — creates service + returns full workflow
   - `scaffold_environment` — creates env + returns impact analysis
   - `explain_architecture` — returns structured architecture summary
   - `check_service_readiness` — checks artifact completeness
   - `migrate_deployment_pattern` — guides pattern migration

2. **Implement analysis tools**
   - `validate_architecture` — deep cross-entity validation
   - `diff_environments` — environment comparison

3. **Template system for smart defaults**
   - Service templates per deployment pattern (lambda defaults, kubernetes defaults, etc.)
   - Environment templates per tier (dev, staging, prod defaults)
   - CI/CD templates per provider (github-actions defaults, gitlab-ci defaults, etc.)

4. **Register all tools in server**

5. **CLI commands for scaffolding**
   - `arch create service <name> --type <type> --pattern <pattern>`
   - `arch create env <name> --template <tier>`
   - `arch explain [--service <name>]`
   - `arch check <service-name>`
   - `arch diff env <env-a> <env-b>`

#### Files to Create/Modify
| Action | File |
|--------|------|
| Create | `src/server/tools/scaffold/scaffold-service.ts` |
| Create | `src/server/tools/scaffold/scaffold-environment.ts` |
| Create | `src/server/tools/scaffold/explain-architecture.ts` |
| Create | `src/server/tools/scaffold/check-readiness.ts` |
| Create | `src/server/tools/scaffold/migrate-pattern.ts` |
| Create | `src/server/tools/analysis/validate-architecture.ts` |
| Create | `src/server/tools/analysis/diff-environments.ts` |
| Create | `src/server/tools/scaffold/index.ts` |
| Create | `src/server/tools/analysis/index.ts` |
| Create | `src/core/templates/service-templates.ts` |
| Create | `src/core/templates/environment-templates.ts` |
| Create | `src/core/templates/cicd-templates.ts` |
| Create | `src/cli/commands/create.ts` |
| Create | `src/cli/commands/explain.ts` |
| Create | `src/cli/commands/check.ts` |
| Create | `src/cli/commands/diff.ts` |
| Modify | `src/cli/index.ts` — register new commands |
| Modify | `src/server/index.ts` — register scaffold + analysis tools |

---

## Complete MCP Tool Registry (After Phase 2)

### Read Tools (Existing — 6)
| Tool | Category |
|------|----------|
| `get_system_context` | Read |
| `get_service_context` | Read |
| `get_environment_context` | Read |
| `get_ci_requirements` | Read |
| `get_observability_requirements` | Read |
| `get_capability_requirements` | Read |

### Write Tools (New — 9)
| Tool | Category |
|------|----------|
| `create_service` | Write |
| `update_service` | Write |
| `delete_service` | Write |
| `create_environment` | Write |
| `update_environment` | Write |
| `delete_environment` | Write |
| `update_system` | Write |
| `set_cicd` | Write |
| `set_observability` | Write |

### Scaffolding Tools (New — 5)
| Tool | Category |
|------|----------|
| `scaffold_service` | Scaffold |
| `scaffold_environment` | Scaffold |
| `explain_architecture` | Scaffold |
| `check_service_readiness` | Scaffold |
| `migrate_deployment_pattern` | Scaffold |

### Analysis Tools (New — 2)
| Tool | Category |
|------|----------|
| `validate_architecture` | Analysis |
| `diff_environments` | Analysis |

**Total: 22 MCP tools (6 existing + 16 new)**

---

## CLI Commands (After Phase 2)

### Existing
| Command | Purpose |
|---------|---------|
| `arch init` | Initialize architecture directory |
| `arch context service <name>` | Query service config |
| `arch context env <name>` | Query environment config |
| `arch validate` | Validate all files |

### New
| Command | Purpose |
|---------|---------|
| `arch create service <name>` | Scaffold a new service (guided) |
| `arch create env <name>` | Scaffold a new environment |
| `arch update service <name>` | Update service config |
| `arch update system` | Update system config |
| `arch delete service <name>` | Remove a service |
| `arch delete env <name>` | Remove an environment |
| `arch explain` | Show architecture summary |
| `arch explain --service <name>` | Show service deep-dive |
| `arch check <service>` | Check service readiness |
| `arch diff env <a> <b>` | Compare environments |
| `arch migrate <service> --pattern <new>` | Guide pattern migration |

---

## Success Criteria

| ID | Criteria |
|----|----------|
| SC-W01 | `create_service` writes valid YAML that passes schema validation |
| SC-W02 | `update_service` preserves existing fields not being updated |
| SC-W03 | `delete_service` prevents deletion when dependents exist (unless forced) |
| SC-W04 | All write tools validate against Zod schemas before writing |
| SC-W05 | `scaffold_service` returns complete artifact checklist matching the deployment pattern |
| SC-W06 | `explain_architecture` returns full system summary in <100ms |
| SC-W07 | `check_service_readiness` correctly identifies missing vs complete artifacts |
| SC-W08 | `diff_environments` shows all field-level differences between two envs |
| SC-W09 | Write operations invalidate relevant cache entries |
| SC-W10 | All new tools have >80% unit test coverage |
| SC-W11 | Cycle detection prevents circular dependencies on service create/update |
| SC-W12 | New CLI commands use same MCP API as AI tools (FR-009 compliance) |

---

## Execution Order

```
Phase 2A: Store Write Layer
    ├── YAML serializer
    ├── Write methods on ArchitectureStore
    ├── Impact analysis engine
    └── Unit tests
         ↓
Phase 2B: Entity Write MCP Tools
    ├── 9 write tool handlers
    ├── Server registration
    ├── Write response types
    └── Integration + e2e tests
         ↓
Phase 2C: Scaffolding & Guidance
    ├── Template system (service, env, cicd defaults)
    ├── 5 scaffold tools + 2 analysis tools
    ├── CLI commands (create, explain, check, diff, migrate)
    └── Full test suite
```

**Dependency rule**: Each phase builds on the previous. 2B needs 2A's store methods. 2C needs both 2A and 2B.

---

## Future Phases (Out of Scope for Phase 2, Noted for Context)

### Phase 3: Rule Engine & Enforcement
- `enforce_rules` tool — validate architecture against defined rules
- `create_rule` / `update_rule` tools
- Pre-write validation hooks (rules checked before any write completes)

### Phase 4: Visual Architecture UI
- Web UI reading from the same YAML files
- Service dependency graph visualization
- Environment comparison view
- Real-time architecture diagram (not Confluence/Lucidchart — this shows the ACTUAL architecture)

### Phase 5: Health & Runtime Integration
- Per-environment health dashboard
- Service online/offline status
- Database connectivity status
- Integration with cloud provider APIs for live status

### Phase 6: Terraform Integration
- Read terraform files to auto-generate architecture YAML
- Reverse: generate terraform from architecture definitions
- Drift detection between architecture-as-code and actual infrastructure
