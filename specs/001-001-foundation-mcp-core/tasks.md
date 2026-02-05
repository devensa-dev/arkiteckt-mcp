# Tasks: MCP Core Foundation

**Input**: Design documents from `/specs/001-001-foundation-mcp-core/`
**Prerequisites**: plan.md (required), spec.md (required)

**Framework Note**: MCP is cloud-agnostic. Tasks use extensible schemas (`z.looseObject()` in Zod v4) so users can add custom fields for ANY cloud/pattern.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US9)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and TypeScript configuration

- [x] T001 Initialize npm project with package.json (name: arkiteckt-mcp)
- [x] T002 Configure TypeScript 5.3+ with strict mode in tsconfig.json
- [x] T003 [P] Configure ESLint and Prettier
- [x] T004 [P] Configure Vitest for testing
- [x] T005 Install production dependencies: @modelcontextprotocol/sdk, zod, yaml, simple-git, commander
- [x] T006 Install dev dependencies: typescript, @types/node, vitest, eslint, prettier
- [x] T007 Create project directory structure per plan.md

**Checkpoint**: `npm run build` passes (even with empty files)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schemas that ALL user stories depend on

**CRITICAL**: No user story work can begin until schemas are complete

### Core Schemas (src/core/schemas/)

- [x] T008 [P] Create SystemSchema in src/core/schemas/system.schema.ts (cloud-agnostic with z.looseObject())
- [x] T009 [P] Create ServiceSchema in src/core/schemas/service.schema.ts (deployment.pattern field)
- [x] T010 [P] Create EnvironmentSchema in src/core/schemas/environment.schema.ts
- [x] T011 [P] Create ObservabilitySchema in src/core/schemas/observability.schema.ts
- [x] T012 [P] Create CICDSchema in src/core/schemas/cicd.schema.ts
- [x] T013 [P] Create SecuritySchema in src/core/schemas/security.schema.ts
- [x] T014 [P] Create ADRSchema in src/core/schemas/adr.schema.ts
- [x] T015 [P] Create TenantSchema in src/core/schemas/tenant.schema.ts
- [x] T016 [P] Create RuleSchema in src/core/schemas/rule.schema.ts
- [x] T017 [P] Create CapabilitySchema in src/core/schemas/capability.schema.ts
- [x] T018 Export all schemas from src/core/schemas/index.ts
- [x] T019 Write unit tests for all schemas in tests/unit/schemas/

### Core Utilities (src/shared/)

- [x] T020 [P] Create YAML parser utility in src/shared/utils/yaml.ts
- [x] T021 [P] Create validation utilities in src/shared/utils/validation.ts
- [x] T022 [P] Create shared types in src/shared/types/index.ts

### Architecture Store Foundation (src/core/store/)

- [x] T023 Create Cache class with TTL in src/core/store/cache.ts
- [x] T024 Create YamlParser with error handling in src/core/store/yaml-parser.ts
- [x] T025 Create ArchitectureStore interface in src/core/store/architecture-store.ts

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - AI Queries System Context (Priority: P1)

**Goal**: AI can call `get_system_context` to understand team's architecture

**Independent Test**: Start MCP server, call tool, verify system.yaml content returned

### Implementation for User Story 1

- [ ] T026 [US1] Implement getSystem() in src/core/store/architecture-store.ts
- [ ] T027 [US1] Write unit test for getSystem() in tests/unit/store/
- [ ] T028 [US1] Implement get_system_context MCP tool in src/server/tools/read/get-system-context.ts
- [ ] T029 [US1] Write integration test for get_system_context tool

**Checkpoint**: AI can query system context successfully

---

## Phase 4: User Story 2 - AI Queries Service Context (Priority: P1)

**Goal**: AI can call `get_service_context(service, env)` with resolution

**Independent Test**: Query service for different environments, verify config differs

### Implementation for User Story 2

- [ ] T030 [US2] Implement getService(name) in src/core/store/architecture-store.ts
- [ ] T031 [US2] Implement getServices() in src/core/store/architecture-store.ts
- [ ] T032 [P] [US2] Write unit tests for service store methods
- [ ] T033 [US2] Implement get_service_context MCP tool in src/server/tools/read/get-service-context.ts
- [ ] T034 [US2] Write integration test for get_service_context tool

**Checkpoint**: AI can query service context with environment resolution

---

## Phase 5: User Story 7 - Resolution Engine (Priority: P1)

**Goal**: Config merges correctly: Tenant → Environment → Service → System → Global

**Independent Test**: Unit tests verify merge order for various scenarios

### Implementation for User Story 7

- [ ] T035 [US7] Define ResolutionContext type in src/core/engines/resolution-engine.ts
- [ ] T036 [US7] Define ResolvedServiceContext type
- [ ] T037 [US7] Implement deep merge utility
- [ ] T038 [US7] Implement resolveServiceContext(service, env, tenant?)
- [ ] T039 [US7] Add cycle detection for dependencies
- [ ] T040 [US7] Write unit tests for merge order in tests/unit/engines/
- [ ] T041 [US7] Write unit tests for tenant overrides
- [ ] T042 [US7] Write integration tests for complex resolution scenarios

**Checkpoint**: Resolution engine correctly merges all config levels

---

## Phase 6: User Story 3 - Architecture Store Initialization (Priority: P1)

**Goal**: `arch init` creates canonical directory structure with templates

**Independent Test**: Run `arch init`, verify structure matches spec

### Implementation for User Story 3

- [ ] T043 [US3] Implement init() method in architecture-store.ts
- [ ] T044 [US3] Implement --repair flag logic (add missing, don't overwrite)
- [ ] T045 [US3] Create default template files in templates/architecture/
- [ ] T046 [US3] Implement `arch init` CLI command in src/cli/commands/init.ts
- [ ] T047 [US3] Write integration test for arch init command

**Checkpoint**: arch init creates valid, usable architecture structure

---

## Phase 7: User Story 8 & 9 - Capability Requirements (Priority: P1)

**Goal**: AI queries `get_capability_requirements` to get artifact checklists

**Independent Test**: Query create_service capability, verify pattern-specific artifacts returned

### Implementation for User Stories 8 & 9

- [ ] T048 [US8] Implement getCapabilities() in architecture-store.ts
- [ ] T049 [US8] Implement get_capability_requirements MCP tool in src/server/tools/read/get-capability-requirements.ts
- [ ] T050 [US9] Implement pattern-based artifact expansion in capability tool
- [ ] T051 [P] [US8] Write integration tests for capability requirements
- [ ] T052 [P] [US9] Write tests for pattern-specific artifact checklists (lambda, ecs, k8s examples)

**Checkpoint**: AI gets complete, pattern-specific artifact checklists

---

## Phase 8: User Story 4 - Environment Context (Priority: P2)

**Goal**: AI queries environment profiles for availability, scaling, security settings

**Independent Test**: Query prod vs dev, verify different settings returned

### Implementation for User Story 4

- [ ] T053 [US4] Implement getEnvironment(name) in architecture-store.ts
- [ ] T054 [US4] Implement getEnvironments() method
- [ ] T055 [US4] Implement resolveEnvironmentContext(env, tenant?) in resolution-engine.ts
- [ ] T056 [US4] Implement get_environment_context MCP tool in src/server/tools/read/get-environment-context.ts
- [ ] T057 [US4] Write integration test for environment context tool

**Checkpoint**: AI can query environment-specific settings

---

## Phase 9: User Story 5 - CI/CD Requirements (Priority: P2)

**Goal**: AI queries CI/CD standards for pipeline generation

**Independent Test**: Query CI requirements, verify steps and quality gates returned

### Implementation for User Story 5

- [ ] T058 [US5] Implement getCIRequirements() in architecture-store.ts
- [ ] T059 [US5] Implement get_ci_requirements MCP tool in src/server/tools/read/get-ci-requirements.ts
- [ ] T060 [US5] Write integration test for CI requirements tool

**Checkpoint**: AI can query CI/CD standards

---

## Phase 10: User Story 6 - Observability Requirements (Priority: P2)

**Goal**: AI queries observability standards for logging, metrics, tracing

**Independent Test**: Query observability requirements, verify format and tools returned

### Implementation for User Story 6

- [ ] T061 [US6] Implement getObservabilityRequirements() in architecture-store.ts
- [ ] T062 [US6] Implement get_observability_requirements MCP tool in src/server/tools/read/get-observability-requirements.ts
- [ ] T063 [US6] Write integration test for observability requirements tool

**Checkpoint**: AI can query observability standards

---

## Phase 11: MCP Server Setup

**Goal**: MCP server entry point with all tools registered

### Implementation

- [ ] T064 Set up MCP server using SDK in src/server/index.ts
- [ ] T065 [P] Implement logging middleware in src/server/middleware/logging.ts
- [ ] T066 [P] Implement error handling middleware in src/server/middleware/error-handling.ts
- [ ] T067 Register all read tools with MCP server
- [ ] T068 Configure server metadata and capabilities
- [ ] T069 Write end-to-end test: start server, query all tools

**Checkpoint**: MCP server starts and responds to all tools

---

## Phase 12: CLI Foundation

**Goal**: CLI commands using MCP API (not separate implementation)

### Implementation

- [ ] T070 Set up Commander.js CLI in src/cli/index.ts
- [ ] T071 Implement MCP client connection utility
- [ ] T072 [P] Create output formatters (JSON, YAML, table) in src/cli/utils/
- [ ] T073 Implement `arch context service <name> --env <env>` command
- [ ] T074 Implement `arch context env <name>` command
- [ ] T075 Implement `arch validate` command (basic schema validation)
- [ ] T076 Add help text and examples to all commands
- [ ] T077 Write CLI integration tests

**Checkpoint**: CLI can init repos and query context using MCP API

---

## Phase 13: Polish & Cross-Cutting

**Purpose**: Final polish, documentation, and verification

- [ ] T078 [P] Update README with usage examples
- [ ] T079 [P] Create example architecture in tests/fixtures/architecture/
- [ ] T080 Run full test suite and fix failures
- [ ] T081 Verify <100ms response time for all read operations
- [ ] T082 Test MCP server with Claude Code integration
- [ ] T083 Verify all success criteria from spec.md

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational - Schemas, Store Interface)
    ↓
┌─────────────────────────────────────────────────┐
│ Phase 3-10: User Stories (can proceed in        │
│ priority order: P1 first, then P2)              │
│                                                 │
│ P1 Stories (do these first):                    │
│   - US1: System Context                         │
│   - US7: Resolution Engine                      │
│   - US2: Service Context (needs resolution)     │
│   - US3: Store Initialization                   │
│   - US8/9: Capability Requirements              │
│                                                 │
│ P2 Stories (after P1 complete):                 │
│   - US4: Environment Context                    │
│   - US5: CI/CD Requirements                     │
│   - US6: Observability Requirements             │
└─────────────────────────────────────────────────┘
    ↓
Phase 11 (MCP Server) - needs all tools
    ↓
Phase 12 (CLI) - needs MCP server
    ↓
Phase 13 (Polish)
```

### Parallel Opportunities

- All schema tasks (T008-T017) can run in parallel
- All utility tasks (T020-T022) can run in parallel
- Within each user story, tasks marked [P] can run in parallel
- P2 stories (US4, US5, US6) can run in parallel after P1 complete

---

## Success Criteria Mapping

| Success Criteria | Tasks |
|-----------------|-------|
| SC-001: <100ms latency | T081 |
| SC-002: AI queries system context | T028, T029 |
| SC-003: Resolution engine merge order | T040, T041, T042 |
| SC-004: arch init creates valid structure | T046, T047 |
| SC-005: Schemas validate example YAML | T019 |
| SC-006: >80% unit test coverage | All test tasks |
| SC-007: Integration tests pass | T069, T082 |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story should be independently testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Schemas use `z.looseObject()` (Zod v4) for extensibility (cloud-agnostic)
