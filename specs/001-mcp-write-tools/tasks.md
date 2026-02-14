# Tasks: MCP Write Tools, Scaffolding & Architecture Mutation

**Input**: Design documents from `/specs/001-mcp-write-tools/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User stories are ordered by priority (P1 first), with shared infrastructure in Phases 1-2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New type definitions and utility classes that all phases depend on

- [ ] T001 [P] Create `WriteResponse<T>`, `DeleteResponse`, and `ImpactAnalysis` types in `src/core/schemas/write-responses.schema.ts` — define Zod schemas and inferred TypeScript types for all write operation responses (WriteResponse, DeleteResponse, ImpactAnalysis, ServiceImpact, FieldChange, ArtifactsDelta) per data-model.md
- [ ] T002 [P] Create YAML serializer utility in `src/core/store/yaml-serializer.ts` — thin wrapper around existing `stringifyYaml()` from `src/shared/utils/yaml.ts` adding `writeYamlFile(filePath, data)` with directory creation, consistent formatting (2-space indent, block style, sorted keys), and `deleteYamlFile(filePath)` per R1
- [ ] T003 [P] Create `ScanResult`, `DetectedService`, `DetectedDependency`, `DetectedCICD`, `DetectedObservability`, `DetectedSystem` types in `src/core/schemas/scan-result.schema.ts` per data-model.md
- [ ] T004 [P] Create `WorkflowStep`, `ScaffoldResponse`, `ReadinessReport`, `ArtifactCheck` types in `src/core/schemas/scaffold-responses.schema.ts` per data-model.md
- [ ] T005 [P] Create `ValidationReport`, `ValidationIssue`, `EnvironmentDiff`, `FieldDiff`, `MigrationGuide`, `MigrationStep`, `BreakingChange` types in `src/core/schemas/analysis-responses.schema.ts` per data-model.md
- [ ] T006 Update `src/core/schemas/index.ts` to export all new schema files (T001, T003, T004, T005)

**Checkpoint**: All shared types defined — store write layer can begin

---

## Phase 2: Foundational (Store Write Layer — Phase 2A)

**Purpose**: Core write/update/delete methods on `ArchitectureStore` that ALL write tools depend on

**CRITICAL**: No write tool can be implemented until this phase is complete

### Store Write Methods

- [ ] T007 Add `createService(name, config)` method to `src/core/store/architecture-store.ts` — check name uniqueness (FR-004), validate config against ServiceSchema (FR-003), write minimal overrides only (FR-002) via YamlSerializer, invalidate cache `service:{name}` and `service:__all__` (FR-010), return `Result<Service, ArchitectureError>`
- [ ] T008 Add `updateService(name, updates)` method to `src/core/store/architecture-store.ts` — read existing config, deep-merge with `arrayStrategy: 'replace'` (FR-005), run cycle detection on new dependencies via `wouldCreateCycle()` (FR-006), validate merged config, write via YamlSerializer, invalidate cache, return `Result<Service, ArchitectureError>`
- [ ] T009 Add `deleteService(name, force?)` method to `src/core/store/architecture-store.ts` — check for dependents via `buildDependencyGraph()` (FR-007), block if has dependents and `force=false`, delete file via YamlSerializer, invalidate cache, return `Result<void, ArchitectureError>` with warnings if forced
- [ ] T010 Add `createEnvironment(name, config)` method to `src/core/store/architecture-store.ts` — check name uniqueness, validate against EnvironmentSchema (FR-003), write via YamlSerializer, invalidate cache, return `Result<Environment, ArchitectureError>`
- [ ] T011 [P] Add `updateEnvironment(name, updates)` method to `src/core/store/architecture-store.ts` — read existing, deep-merge with `arrayStrategy: 'replace'`, validate, write, invalidate cache
- [ ] T012 [P] Add `deleteEnvironment(name)` method to `src/core/store/architecture-store.ts` — scan services for orphaned environment overrides (FR-008), delete file, invalidate cache, return warnings about orphaned `service.environments.{name}` sections
- [ ] T013 [P] Add `updateSystem(updates)` method to `src/core/store/architecture-store.ts` — read existing system.yaml, deep-merge, validate against SystemSchema, write, invalidate all caches (system defaults affect everything)
- [ ] T014 [P] Add `setCICD(config)` method to `src/core/store/architecture-store.ts` — upsert behavior: create if not exists, deep-merge if exists (FR-009), validate against CICDSchema, write, invalidate cache
- [ ] T015 [P] Add `setObservability(config)` method to `src/core/store/architecture-store.ts` — upsert behavior: create if not exists, deep-merge if exists (FR-009), validate against ObservabilitySchema, write, invalidate cache

### Impact Analysis Engine

- [ ] T016 Create `ImpactAnalyzer` class in `src/core/engines/impact-analyzer.ts` — implements `analyzeServiceDeletion(name)`, `analyzeSystemDefaultsChange(oldDefaults, newDefaults)`, `analyzeDeploymentPatternChange(service, oldPattern, newPattern)`, `analyzeEnvironmentDeletion(name)` per R4, uses ArchitectureStore to scan for dependencies and overrides
- [ ] T017 Update `src/core/engines/index.ts` to export `ImpactAnalyzer`

### Store Write Tests

- [ ] T018 Unit tests for store write operations in `tests/unit/store/write-operations.test.ts` — test createService (happy path, duplicate name, validation failure, minimal overrides only), updateService (merge, array replace, cycle detection), deleteService (with/without dependents, force), create/update/delete environment, updateSystem, setCICD, setObservability with temp directories and fixture YAML files
- [ ] T019 [P] Unit tests for impact analyzer in `tests/unit/engines/impact-analyzer.test.ts` — test deletion analysis (dependents found/not found), system defaults change (affected services identified), pattern change (artifact delta computed), environment deletion (orphaned overrides detected)

**Checkpoint**: Store write layer complete — all write tools can now build on top of this

---

## Phase 3: User Story 1 — Create a New Service via MCP (Priority: P1)

**Goal**: Developers can create new service configurations through AI with validation, defaults, and an artifact checklist

**Independent Test**: Create a service via MCP and verify valid YAML is written with correct defaults and a checklist is returned

### Implementation

- [ ] T020 Create `create-service` write tool in `src/server/tools/write/create-service.ts` — define tool config (name: `create_service`, inputSchema with name, type, deployment_pattern, description?, dependencies?, owner?), handler calling `store.createService()`, `formatMcpResult()` formatter per write-tools.md contract
- [ ] T021 Create `src/server/tools/write/index.ts` barrel export for write tools
- [ ] T022 Register `create_service` tool in `src/server/index.ts` using `server.registerTool()` with `withErrorHandling()` wrapper

### Tests

- [ ] T023 Integration test for create_service in `tests/integration/tools/write/create-service.test.ts` — test creation with minimal overrides, creation with all fields, duplicate name rejection (409), validation failure (400), checklist returned from capabilities, architecture dir not initialized (503)

**Checkpoint**: create_service tool functional — can create services via MCP

---

## Phase 4: User Story 2 — Update Existing Architecture Entities (Priority: P1)

**Goal**: Tech leads can update services, environments, and system config with deep-merge, validation, and impact analysis

**Independent Test**: Update a service's deployment pattern and verify merged config is valid with artifact delta returned

### Implementation

- [ ] T024 [P] Create `update-service` write tool in `src/server/tools/write/update-service.ts` — define tool config (name: `update_service`, inputSchema with name, updates record), handler calling `store.updateService()` + `impactAnalyzer.analyzeDeploymentPatternChange()` when pattern changes, `formatMcpResult()` per write-tools.md
- [ ] T025 [P] Create `update-system` write tool in `src/server/tools/write/update-system.ts` — define tool config (name: `update_system`, inputSchema with updates record), handler calling `store.updateSystem()` + `impactAnalyzer.analyzeSystemDefaultsChange()`, `formatMcpResult()` per write-tools.md
- [ ] T026 [P] Create `create-environment` write tool in `src/server/tools/write/create-environment.ts` — define tool config (name: `create_environment`, inputSchema with name, base_template?, availability?, scaling?, security_level?), handler calling `store.createEnvironment()`, `formatMcpResult()` per write-tools.md
- [ ] T027 [P] Create `update-environment` write tool in `src/server/tools/write/update-environment.ts` — define tool config (name: `update_environment`, inputSchema with name, updates record), handler calling `store.updateEnvironment()`, `formatMcpResult()`
- [ ] T028 [P] Create `set-cicd` write tool in `src/server/tools/write/set-cicd.ts` — define tool config (name: `set_cicd`, inputSchema with provider?, steps?, quality_gates?, config?), handler calling `store.setCICD()`, `formatMcpResult()` per write-tools.md
- [ ] T029 [P] Create `set-observability` write tool in `src/server/tools/write/set-observability.ts` — define tool config (name: `set_observability`, inputSchema with logging?, metrics?, tracing?, alerting?, config?), handler calling `store.setObservability()`, `formatMcpResult()` per write-tools.md
- [ ] T030 Register all update/create tools (T024-T029) in `src/server/index.ts`
- [ ] T031 Update `src/server/tools/write/index.ts` to export all new write tools

### Tests

- [ ] T032 [P] Integration test for update_service in `tests/integration/tools/write/update-service.test.ts` — test deep-merge preserving fields, array replace, deployment pattern change with artifact delta, cycle detection rejection, not-found error (404)
- [ ] T033 [P] Integration test for update_system in `tests/integration/tools/write/update-system.test.ts` — test defaults change with affected services list, schema validation
- [ ] T034 [P] Integration test for environment tools in `tests/integration/tools/write/environment-tools.test.ts` — test create with base_template defaults, update with merge, duplicate rejection
- [ ] T035 [P] Integration test for set_cicd and set_observability in `tests/integration/tools/write/upsert-tools.test.ts` — test create-or-update behavior, schema validation

**Checkpoint**: All entity write tools functional — full CRUD for services and environments, system updates, CI/CD and observability upserts

---

## Phase 5: User Story 3 — Delete Architecture Entities with Safety Checks (Priority: P2)

**Goal**: Developers can safely delete services and environments with dependency checks preventing accidental breakage

**Independent Test**: Attempt to delete a service with dependents and verify deletion is blocked with dependent list

### Implementation

- [ ] T036 Create `delete-service` write tool in `src/server/tools/write/delete-service.ts` — define tool config (name: `delete_service`, inputSchema with name, force?), handler calling `store.deleteService()`, `formatMcpResult()` returning `DeleteResponse` per write-tools.md
- [ ] T037 [P] Create `delete-environment` write tool in `src/server/tools/write/delete-environment.ts` — define tool config (name: `delete_environment`, inputSchema with name), handler calling `store.deleteEnvironment()`, `formatMcpResult()` returning `DeleteResponse` with orphaned config warnings per write-tools.md
- [ ] T038 Register delete tools (T036-T037) in `src/server/index.ts`
- [ ] T039 Update `src/server/tools/write/index.ts` to export delete tools

### Tests

- [ ] T040 Integration test for delete tools in `tests/integration/tools/write/delete-tools.test.ts` — test delete service with dependents blocked (409), force delete with warnings, delete service with no dependents, not-found (404), delete environment with orphaned override warnings

**Checkpoint**: Full CRUD cycle complete for services and environments

---

## Phase 6: User Story 8 — Auto-Populate Architecture from Existing Codebase (Priority: P1)

**Goal**: Scan existing codebases to auto-detect services, dependencies, deployment patterns, CI/CD, and observability — generating architecture YAML after user confirmation

**Independent Test**: Run scan against a project with known services and verify detected architecture matches reality

### Implementation

- [ ] T041 Create `CodebaseScanner` class in `src/core/engines/codebase-scanner.ts` — main scanner orchestrating detectors, computing confidence scores, assembling `ScanResult` per R6
- [ ] T042 Implement `ServiceDetector` in `src/core/engines/codebase-scanner.ts` — scan for `package.json`, `pom.xml`, `go.mod`, `requirements.txt`, `Cargo.toml`, `build.gradle` to identify service directories (FR-025)
- [ ] T043 [P] Implement `DeploymentDetector` in `src/core/engines/codebase-scanner.ts` — scan for `Dockerfile`, `serverless.yml`, `k8s/` manifests, `terraform/`, `docker-compose.yml` to infer deployment patterns (FR-026)
- [ ] T044 [P] Implement `CICDDetector` in `src/core/engines/codebase-scanner.ts` — scan for `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml` to detect CI/CD provider and pipeline steps (FR-027)
- [ ] T045 [P] Implement `RuntimeDetector` in `src/core/engines/codebase-scanner.ts` — scan `.nvmrc`, `runtime.txt`, `go.mod` version, `pom.xml` properties, framework detection from dependencies (FR-030)
- [ ] T046 [P] Implement `ObservabilityDetector` in `src/core/engines/codebase-scanner.ts` — scan for `datadog.yaml`, prometheus configs, OpenTelemetry imports, logging library usage (FR-031)
- [ ] T047 Implement `DependencyDetector` in `src/core/engines/codebase-scanner.ts` — scan source code for HTTP client calls, message queue references, service discovery patterns referencing other detected services (FR-028). Regex/pattern matching approach (not AST) per R6
- [ ] T048 Implement monorepo vs polyrepo detection in `CodebaseScanner` — detect `workspaces` in root `package.json`, multiple service directories under common root per scan-tools.md
- [ ] T049 Implement confidence scoring in `CodebaseScanner` — 1.0 (build+infra+type), 0.8-0.9 (build+infra), 0.6-0.7 (build only), 0.3-0.5 (source only), <0.3 (warning) per scan-tools.md
- [ ] T050 Create `scan-codebase` tool in `src/server/tools/scan/scan-codebase.ts` — define tool config (name: `scan_codebase`, inputSchema with root_path?, write?), handler calling `CodebaseScanner.scan()`, preview mode (write=false) returns ScanResult, commit mode (write=true) writes YAML files via store methods (FR-029)
- [ ] T051 Create `src/server/tools/scan/index.ts` barrel export
- [ ] T052 Register `scan_codebase` tool in `src/server/index.ts`
- [ ] T053 Update `src/core/engines/index.ts` to export `CodebaseScanner`

### Tests

- [ ] T054 Unit tests for codebase scanner in `tests/unit/engines/codebase-scanner.test.ts` — test each detector with mock project structures (temp dirs with fixture files), confidence scoring, monorepo detection, dependency detection across services
- [ ] T055 [P] Integration test for scan_codebase in `tests/integration/tools/scan/scan-codebase.test.ts` — test scanning a fixture project structure, preview mode returns results without writing, commit mode writes YAML, empty project returns warnings

**Checkpoint**: Codebase scanning functional — existing projects can auto-populate architecture

---

## Phase 7: User Story 9 — Coding Agent Architecture Context (Priority: P1)

**Goal**: Coding agents can load full architecture context in a single MCP call for efficient task planning

**Independent Test**: Call `explain_architecture` and verify response contains enough context to plan a service-level task without additional file reads

### Implementation

- [ ] T056 Create `explain-architecture` tool in `src/server/tools/scaffold/explain-architecture.ts` — define tool config (name: `explain_architecture`, inputSchema with focus?, service_name?), handler implementing overview mode (system summary, service inventory, dependency graph, tech stack, statistics) and service focus mode (resolved config, direct+transitive deps, env variations, capability checklist, related ADRs) per scaffold-tools.md (FR-018, FR-019, FR-032, FR-033)
- [ ] T057 Create `src/server/tools/scaffold/index.ts` barrel export
- [ ] T058 Register `explain_architecture` tool in `src/server/index.ts`

### Tests

- [ ] T059 Integration test for explain_architecture in `tests/integration/tools/scaffold/explain-architecture.test.ts` — test overview mode returns complete system summary, service focus mode returns resolved config with dependencies, verify structured format optimized for agent consumption (FR-032)

**Checkpoint**: Agent context loading functional — coding agents can efficiently query architecture

---

## Phase 8: User Story 4 — Scaffold a Complete Service Workflow (Priority: P2)

**Goal**: Junior developers get comprehensive, ordered workflows tailored to deployment pattern and environment when scaffolding services

**Independent Test**: Scaffold a container-based service and verify workflow contains container-specific steps with environment-specific notes

### Smart Default Templates (Prerequisite)

- [ ] T060 [P] Create service templates in `src/core/templates/service-templates.ts` — static template objects keyed by deployment pattern (lambda, ecs_fargate, kubernetes, container) with pattern-specific defaults per R7
- [ ] T061 [P] Create environment templates in `src/core/templates/environment-templates.ts` — static template objects keyed by tier (dev: 1 replica/relaxed, staging: 2 replicas/standard, prod: 3+ replicas/strict/DR) per R7 (FR-017)
- [ ] T062 [P] Create CI/CD templates in `src/core/templates/cicd-templates.ts` — static template objects keyed by provider (github-actions, gitlab-ci) per R7

### Implementation

- [ ] T063 Create `scaffold-service` tool in `src/server/tools/scaffold/scaffold-service.ts` — define tool config (name: `scaffold_service`, inputSchema with name, type, deployment_pattern, description?, dependencies?), handler calling `store.createService()` then assembling workflow from capabilities, CI/CD, observability, environments (FR-014, FR-015, FR-016) per scaffold-tools.md
- [ ] T064 [P] Create `scaffold-environment` tool in `src/server/tools/scaffold/scaffold-environment.ts` — define tool config (name: `scaffold_environment`, inputSchema with name, base_template?), handler applying environment template defaults, returning environment config + service impacts + infrastructure steps + security checklist per scaffold-tools.md (FR-017)
- [ ] T065 Register scaffold tools (T063-T064) in `src/server/index.ts`
- [ ] T066 Update `src/server/tools/scaffold/index.ts` to export scaffold tools

### Tests

- [ ] T067 Integration test for scaffold_service in `tests/integration/tools/scaffold/scaffold-service.test.ts` — test container pattern includes Dockerfile steps, serverless pattern includes Lambda steps, workflow ordered by category, environment notes present where configs vary, flat checklist returned
- [ ] T068 [P] Integration test for scaffold_environment in `tests/integration/tools/scaffold/scaffold-environment.test.ts` — test base_template applies correct defaults (dev vs prod), service impacts listed, security checklist for strict tier

**Checkpoint**: Scaffolding complete — guided workflows for services and environments

---

## Phase 9: User Story 5 — Explain and Analyze Architecture (Priority: P3)

**Goal**: Developers and agents get structured architecture summaries and environment comparisons

**Independent Test**: Compare two environments and verify all field-level differences are returned

### Implementation

- [ ] T069 Create `diff-environments` tool in `src/server/tools/analysis/diff-environments.ts` — define tool config (name: `diff_environments`, inputSchema with env_a, env_b, service_name?), handler comparing environment configs field-by-field, with optional service-specific resolved config diff (FR-020) per analysis-tools.md
- [ ] T070 Create `src/server/tools/analysis/index.ts` barrel export
- [ ] T071 Register `diff_environments` tool in `src/server/index.ts`

### Tests

- [ ] T072 Integration test for diff_environments in `tests/integration/tools/analysis/diff-environments.test.ts` — test field-level differences detected, onlyIn fields identified, summary generated, service-specific resolved diff mode

**Checkpoint**: Environment comparison functional

---

## Phase 10: User Story 6 — Validate Architecture and Check Service Readiness (Priority: P3)

**Goal**: Validate cross-entity consistency and check whether services have all required artifacts

**Independent Test**: Run validation on an architecture with a missing dependency reference and verify the issue is reported

### Implementation

- [ ] T073 Create `validate-architecture` tool in `src/server/tools/analysis/validate-architecture.ts` — define tool config (name: `validate_architecture`, inputSchema with scope?), handler performing all 8 validation checks: missing dep refs, cycles, schema validation, env refs, SLO definitions (warning), resilience (info), security consistency, orphaned configs (FR-021) per analysis-tools.md
- [ ] T074 [P] Create `check-readiness` tool in `src/server/tools/scaffold/check-readiness.ts` — define tool config (name: `check_service_readiness`, inputSchema with service_name, environment?), handler comparing required artifacts (from capabilities for deployment pattern) against existing service, returning readiness score + completed/missing list + recommendations (FR-022) per scaffold-tools.md
- [ ] T075 Register analysis and readiness tools (T073-T074) in `src/server/index.ts`
- [ ] T076 Update `src/server/tools/analysis/index.ts` and `src/server/tools/scaffold/index.ts` to export new tools

### Tests

- [ ] T077 Integration test for validate_architecture in `tests/integration/tools/analysis/validate-architecture.test.ts` — test missing dep detection, cycle detection, orphaned config detection, valid architecture returns `valid: true`
- [ ] T078 [P] Integration test for check_service_readiness in `tests/integration/tools/scaffold/check-readiness.test.ts` — test readiness score calculation, missing artifacts identified, 100% score when all present

**Checkpoint**: Architecture validation and readiness checks functional

---

## Phase 11: User Story 7 — Guide Deployment Pattern Migration (Priority: P3)

**Goal**: Tech leads get detailed migration guides when changing deployment patterns with artifact deltas and breaking change warnings

**Independent Test**: Migrate a service from lambda to kubernetes and verify artifact delta and breaking changes are returned

### Implementation

- [ ] T079 Create `migrate-pattern` tool in `src/server/tools/scaffold/migrate-pattern.ts` — define tool config (name: `migrate_deployment_pattern`, inputSchema with service_name, new_pattern), handler calling `store.updateService()` to change pattern + `impactAnalyzer.analyzeDeploymentPatternChange()` for artifact delta, assembling migration steps and breaking changes per scaffold-tools.md (FR-023)
- [ ] T080 Register `migrate_deployment_pattern` tool in `src/server/index.ts`
- [ ] T081 Update `src/server/tools/scaffold/index.ts` to export migration tool

### Tests

- [ ] T082 Integration test for migrate_deployment_pattern in `tests/integration/tools/scaffold/migrate-pattern.test.ts` — test lambda-to-kubernetes artifact delta, ordered migration steps, breaking changes listed with remediation

**Checkpoint**: Migration guidance complete — all scaffold and analysis tools functional

---

## Phase 12: CLI Commands (Phase 2E)

**Purpose**: CLI commands mirroring all MCP tools for developer use (FR-024)

### Implementation

- [ ] T083 [P] Create `arch create` CLI command in `src/cli/commands/create.ts` — subcommands: `arch create service <name>` and `arch create env <name>`, calls same store methods as MCP tools
- [ ] T084 [P] Create `arch update` CLI command in `src/cli/commands/update.ts` — subcommands: `arch update service <name>`, `arch update system`, `arch update env <name>`, calls same store methods
- [ ] T085 [P] Create `arch delete` CLI command in `src/cli/commands/delete.ts` — subcommands: `arch delete service <name>`, `arch delete env <name>`, with `--force` flag
- [ ] T086 [P] Create `arch explain` CLI command in `src/cli/commands/explain.ts` — `arch explain [--service <name>] [--focus <area>]`
- [ ] T087 [P] Create `arch check` CLI command in `src/cli/commands/check.ts` — `arch check <service> [--env <env>]`
- [ ] T088 [P] Create `arch diff` CLI command in `src/cli/commands/diff.ts` — `arch diff env <a> <b> [--service <name>]`
- [ ] T089 [P] Create `arch migrate` CLI command in `src/cli/commands/migrate.ts` — `arch migrate <service> --pattern <pattern>`
- [ ] T090 [P] Create `arch scan` CLI command in `src/cli/commands/scan.ts` — `arch scan [--root <path>] [--write]`
- [ ] T091 Register all new CLI commands in `src/cli/index.ts`

### Tests

- [ ] T092 Integration tests for CLI commands in `tests/integration/cli/write-commands.test.ts` — test create/update/delete service and environment via CLI, verify same behavior as MCP tools

**Checkpoint**: CLI parity with MCP tools — FR-024 satisfied

---

## Phase 13: E2E Tests & Polish

**Purpose**: End-to-end validation and cross-cutting improvements

- [ ] T093 E2E tests with InMemoryTransport in `tests/e2e/write-tools.test.ts` — full MCP client/server roundtrip for create → update → scaffold → validate → delete lifecycle using `InMemoryTransport.createLinkedPair()` and `Client` from MCP SDK
- [ ] T094 [P] E2E test for scan → write flow in `tests/e2e/scan-tools.test.ts` — scan a fixture project, verify results, write YAML, then read back via existing get tools to verify consistency
- [ ] T095 Update `src/server/tools/index.ts` to re-export all new tool categories (write, scaffold, analysis, scan)
- [ ] T096 Run quickstart.md validation — verify all commands and patterns documented in quickstart.md work correctly
- [ ] T097 Verify all existing tests still pass — run full `npm test` suite to ensure no regressions from store modifications

**Checkpoint**: Feature complete — all tools working end-to-end with full test coverage

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Store Write Layer) — BLOCKS ALL tool phases
    ↓
    ├─→ Phase 3 (US1: Create Service) ──────────┐
    ├─→ Phase 4 (US2: Update Entities) ──────────┤
    ├─→ Phase 6 (US8: Codebase Scanning) ────────┤
    └─→ Phase 7 (US9: Agent Context) ────────────┤
                                                  ↓
Phase 5 (US3: Delete Entities) ← depends on Phase 3 & 4
                                                  ↓
Phase 8 (US4: Scaffolding) ← depends on Phase 3 (create_service exists)
                                                  ↓
Phase 9 (US5: Explain & Analyze) ← depends on Phase 7 (explain_architecture exists)
Phase 10 (US6: Validate & Readiness) ← depends on Phase 2
Phase 11 (US7: Migration) ← depends on Phase 4 (update_service), Phase 2 (impact analyzer)
                                                  ↓
Phase 12 (CLI) ← depends on all tool phases being complete
    ↓
Phase 13 (E2E & Polish) ← depends on everything
```

### P1 Stories — Can Start in Parallel After Phase 2

After Phase 2 completes, these P1 phases can run in parallel:
- **Phase 3** (US1: Create Service) — no story dependencies
- **Phase 4** (US2: Update Entities) — no story dependencies
- **Phase 6** (US8: Codebase Scanning) — no story dependencies
- **Phase 7** (US9: Agent Context) — no story dependencies

### Within Each Phase

- Tasks marked [P] within a phase can run in parallel
- Tests should be written before or alongside implementation
- Register tools in `src/server/index.ts` only after handlers are complete

### Parallel Opportunities

```bash
# After Phase 2, launch all P1 story phases in parallel:
Phase 3 (create_service)    # Independent
Phase 4 (update tools)      # Independent
Phase 6 (codebase scanner)  # Independent
Phase 7 (explain_arch)      # Independent

# Within Phase 4, all write tools can be built in parallel:
T024 (update-service)       # Different file
T025 (update-system)        # Different file
T026 (create-environment)   # Different file
T027 (update-environment)   # Different file
T028 (set-cicd)             # Different file
T029 (set-observability)    # Different file

# Within Phase 6, detectors can be built in parallel:
T043 (DeploymentDetector)   # Independent
T044 (CICDDetector)         # Independent
T045 (RuntimeDetector)      # Independent
T046 (ObservabilityDetector)# Independent
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup (types and utilities)
2. Complete Phase 2: Store Write Layer (CRITICAL blocker)
3. Complete Phase 3: Create Service (US1) — **VALIDATE**: can create services via MCP
4. Complete Phase 4: Update Entities (US2) — **VALIDATE**: can update all entity types
5. Complete Phase 6: Codebase Scanning (US8) — **VALIDATE**: can scan existing projects
6. Complete Phase 7: Agent Context (US9) — **VALIDATE**: agents can load context efficiently
7. **STOP**: MVP is ready — 4 user stories, 13 MCP tools

### Incremental Delivery

1. **MVP** (P1): Phases 1-4, 6-7 → 13 tools (create, update, scan, explain)
2. **+Delete** (P2): Phase 5 → +2 tools (delete service, delete environment)
3. **+Scaffold** (P2): Phase 8 → +2 tools (scaffold service, scaffold environment)
4. **+Analysis** (P3): Phases 9-11 → +4 tools (diff, validate, readiness, migrate)
5. **+CLI** (Cross-cutting): Phase 12 → CLI parity
6. **+Polish**: Phase 13 → E2E tests, quickstart validation

### Total: 97 Tasks, 18 MCP Tools, ~40 New Files

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Pre-existing 13 test failures in resolution engine, deep-merge, cycle-detector tests (known, unrelated to this feature)
- ESM imports: always use `.js` extension
- `exactOptionalPropertyTypes`: cast args at bridge layer if Zod conflicts
