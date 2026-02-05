# Implementation Plan: MCP Core Foundation

**Branch**: `001-001-foundation-mcp-core` | **Date**: 2026-02-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-001-foundation-mcp-core/spec.md`

## Summary

Build the foundational infrastructure for the Architecture MCP server, including:
- TypeScript project setup with strict configuration
- Zod schemas for all architecture entities (System, Service, Environment, etc.)
- Git-backed architecture store with YAML parsing and caching
- Resolution engine for context merging (Tenant → Environment → Service → System → Global)
- MCP server with read tools for AI context retrieval
- CLI scaffolding using the same MCP API

## Technical Context

**Language/Version**: TypeScript 5.3+, Node.js 20 LTS
**Primary Dependencies**: @modelcontextprotocol/sdk, zod, yaml, simple-git, commander
**Storage**: Git repository with YAML files (no database in Phase 1)
**Testing**: Jest with ts-jest
**Target Platform**: Node.js CLI and MCP server
**Project Type**: Single monorepo with server and CLI
**Performance Goals**: <100ms response time for all read operations
**Constraints**: Must work offline (Git-backed), no external services required
**Scale/Scope**: Support 10+ services, 4 environments, multiple tenants

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture is Data | ✅ Pass | All config stored as YAML with Zod schemas |
| II. AI Proposes, MCP Decides | ✅ Pass | MCP tools are authoritative |
| III. Creation is Transactional | ⏳ Phase 2 | Read-only in Phase 1 |
| IV. Git is Source of Truth | ✅ Pass | Git-backed store |
| V. Rules are Enforceable | ⏳ Phase 3 | Rule engine in later phase |
| VI. Everything is Queryable | ✅ Pass | All read tools implemented |
| VII. Trade-offs are First-Class | ⏳ Phase 2 | ADR support in Phase 2 |

## Project Structure

### Documentation (this feature)

```text
specs/001-001-foundation-mcp-core/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Technical research notes
└── tasks.md             # Generated tasks (after /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── index.ts                    # MCP server entry point
│   ├── tools/
│   │   └── read/
│   │       ├── get-system-context.ts
│   │       ├── get-service-context.ts
│   │       ├── get-environment-context.ts
│   │       ├── get-ci-requirements.ts
│   │       ├── get-observability-requirements.ts
│   │       ├── explain-rule.ts
│   │       └── explain-adr.ts
│   └── middleware/
│       ├── logging.ts
│       └── error-handling.ts
├── core/
│   ├── store/
│   │   ├── architecture-store.ts   # Main store interface
│   │   ├── git-backend.ts          # Git operations
│   │   ├── yaml-parser.ts          # YAML parsing utilities
│   │   └── cache.ts                # In-memory cache
│   ├── engines/
│   │   └── resolution-engine.ts    # Context resolution
│   └── schemas/
│       ├── system.schema.ts
│       ├── service.schema.ts
│       ├── environment.schema.ts
│       ├── observability.schema.ts
│       ├── cicd.schema.ts
│       ├── security.schema.ts
│       ├── adr.schema.ts
│       ├── tenant.schema.ts
│       ├── capability.schema.ts
│       ├── rule.schema.ts
│       └── index.ts
├── cli/
│   ├── index.ts                    # CLI entry point
│   └── commands/
│       ├── init.ts                 # arch init
│       └── context.ts              # arch context service/env
└── shared/
    ├── types/
    │   └── index.ts
    └── utils/
        ├── yaml.ts
        └── validation.ts

tests/
├── unit/
│   ├── schemas/
│   ├── store/
│   └── engines/
├── integration/
│   └── tools/
└── fixtures/
    └── architecture/               # Test architecture files

templates/
└── architecture/                   # Default init templates
    ├── system.yaml
    ├── principles.yaml
    ├── capabilities.yaml
    ├── environments/
    │   ├── local.yaml
    │   ├── dev.yaml
    │   ├── staging.yaml
    │   └── prod.yaml
    ├── observability/
    │   ├── logging.yaml
    │   ├── metrics.yaml
    │   └── tracing.yaml
    ├── ci/
    │   └── standards.yaml
    ├── security/
    │   ├── iam.yaml
    │   └── secrets.yaml
    └── tenants/
        └── default.yaml
```

**Structure Decision**: Single project structure with clear separation between server, core, and CLI. The core module is shared between server and CLI to ensure consistency (Constitution Principle IX: Humans and AI use the same control plane).

## Implementation Phases

### Phase 0: Project Setup

**Goal**: Initialize TypeScript project with all tooling configured

**Tasks**:
1. Initialize npm project with package.json
2. Configure TypeScript with strict mode
3. Set up ESLint and Prettier
4. Configure Jest with ts-jest
5. Set up Husky for pre-commit hooks
6. Create basic project structure (directories)
7. Install production dependencies
8. Install development dependencies
9. Create initial README

**Acceptance**: `npm run build` and `npm test` pass with empty implementations

### Phase 1: Schema Definitions

**Goal**: Define all Zod schemas for architecture entities

**Tasks**:
1. Create `SystemSchema` with validation
2. Create `ServiceSchema` with dependencies
3. Create `EnvironmentSchema` with availability/security
4. Create `ObservabilitySchema` with logging/metrics/tracing
5. Create `CICDSchema` with pipeline requirements
6. Create `SecuritySchema` with IAM/secrets
7. Create `ADRSchema` with decision/trade-offs
8. Create `TenantSchema` with overrides
9. Create `RuleSchema` with scope/severity
10. Create `CapabilitySchema` with requirements
11. Export all schemas from index.ts
12. Write unit tests for all schemas

**Acceptance**: All schemas validate example YAML, tests pass

### Phase 2: Architecture Store

**Goal**: Implement Git-backed YAML store with caching

**Tasks**:
1. Create `YamlParser` utility for safe parsing
2. Create `Cache` class with TTL support
3. Create `GitBackend` for repository operations
4. Implement `ArchitectureStore` interface
5. Implement `getSystem()` method
6. Implement `getService(name)` method
7. Implement `getServices()` method
8. Implement `getEnvironment(name)` method
9. Implement `getEnvironments()` method
10. Implement `getADR(id)` method
11. Implement `getTenant(name)` method
12. Implement `getRules()` method
13. Implement `getCapabilities()` method
14. Implement `init()` for repository scaffolding
15. Implement `validate()` for full validation
16. Write unit tests for store operations
17. Write integration tests with fixture files

**Acceptance**: Store reads all entity types, caching works, <100ms reads

### Phase 3: Resolution Engine

**Goal**: Implement context resolution with proper merge order

**Tasks**:
1. Define `ResolutionContext` type
2. Define `ResolvedServiceContext` type
3. Define `ResolvedEnvironmentContext` type
4. Implement deep merge utility
5. Implement `resolveServiceContext(service, env, tenant?)`
6. Implement `resolveEnvironmentContext(env, tenant?)`
7. Implement `resolveRulesForScope(scope, context)`
8. Add cycle detection for dependencies
9. Add validation for referenced entities
10. Write unit tests for merge order
11. Write unit tests for tenant overrides
12. Write integration tests with complex scenarios

**Acceptance**: Resolution order matches spec, all edge cases handled

### Phase 4: MCP Server & Read Tools

**Goal**: Implement MCP server with all read tools

**Tasks**:
1. Set up MCP server using SDK
2. Configure server metadata and capabilities
3. Implement logging middleware
4. Implement error handling middleware
5. Implement `get_system_context` tool
6. Implement `get_service_context` tool with params
7. Implement `get_environment_context` tool with params
8. Implement `get_ci_requirements` tool
9. Implement `get_observability_requirements` tool
10. Implement `explain_rule` tool
11. Implement `explain_adr` tool
12. Write integration tests for each tool
13. Test with Claude Code MCP integration

**Acceptance**: All tools respond correctly, Claude Code can query

### Phase 5: CLI Foundation

**Goal**: Implement CLI with init and context commands

**Tasks**:
1. Set up Commander.js CLI framework
2. Implement MCP client connection
3. Create output formatting utilities (JSON, YAML, table)
4. Implement `arch init` command
5. Implement `arch init --repair` flag
6. Implement `arch context service <name>` command
7. Implement `arch context env <name>` command
8. Implement `arch validate` command (basic)
9. Add help text and examples
10. Write CLI integration tests

**Acceptance**: CLI can init repos and query context, uses MCP API

## Complexity Tracking

> No violations to justify - Phase 1 is minimal by design.

| Concern | Decision | Rationale |
|---------|----------|-----------|
| No database | Git + cache only | Phase 1 MVP, database adds complexity |
| No write tools | Read-only | Validation/creation in Phase 2 |
| No auth | Local only | CLI runs locally, no network auth needed |

## Dependencies Between Phases

```
Phase 0 (Setup)
    ↓
Phase 1 (Schemas) ─────────────────┐
    ↓                              │
Phase 2 (Store) ←──────────────────┤
    ↓                              │
Phase 3 (Resolution) ←─────────────┘
    ↓
Phase 4 (MCP Server) ←── Phase 3
    ↓
Phase 5 (CLI) ←── Phase 4
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| MCP SDK changes | Pin version, monitor releases |
| YAML parsing edge cases | Use established yaml library, comprehensive tests |
| Resolution complexity | Start with simple cases, add complexity incrementally |
| Performance degradation | Implement caching early, benchmark continuously |

## Definition of Done

- [ ] All schemas defined and exported
- [ ] Architecture store reads all entity types
- [ ] Resolution engine merges with correct order
- [ ] MCP server responds to all read tools
- [ ] CLI can init and query context
- [ ] Unit test coverage >80%
- [ ] Integration tests pass
- [ ] Documentation updated
- [ ] Claude Code can successfully query the MCP
