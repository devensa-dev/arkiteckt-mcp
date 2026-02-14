# Implementation Plan: MCP Write Tools, Scaffolding & Architecture Mutation

**Branch**: `001-mcp-write-tools` | **Date**: 2026-02-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-mcp-write-tools/spec.md`

## Summary

Transform the read-only Arkiteckt MCP server into a full architecture management platform by adding:
- **9 entity write tools** (CRUD for services/environments, system updates, CI/CD and observability upserts)
- **7 scaffolding & analysis tools** (scaffold service/environment, explain architecture, check readiness, migrate pattern, validate architecture, diff environments)
- **1 codebase scanning tool** (auto-detect services, deps, patterns from existing code)
- **Impact analysis engine** for all write operations
- **Smart default templates** for services, environments, and CI/CD providers

All tools follow the existing `registerTool` pattern with `ToolResponse<T>` envelope, `formatMcpResult()` formatters, and `withErrorHandling()` middleware.

## Technical Context

**Language/Version**: TypeScript 5.9+ (strict mode, `exactOptionalPropertyTypes: true`)
**Primary Dependencies**: MCP SDK v1.26.0, Zod v4.3.6, yaml v2.8.2, Commander v14
**Storage**: Local YAML files in `architecture/` directory
**Testing**: Vitest 4.0 (unit, integration, e2e with InMemoryTransport)
**Target Platform**: Node.js 20+ (ESM modules, `.js` extensions)
**Project Type**: Single project (MCP server + CLI)
**Performance Goals**: Write operations complete in <500ms, scan operations complete in <10s for 50-service codebases
**Constraints**: No external dependencies beyond existing stack, no file locking, local filesystem only
**Scale/Scope**: 18 new MCP tools (9 write + 7 scaffold/analysis + 1 scan + 1 agent context), ~40 new files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Architecture is Data | PASS | All write tools produce structured YAML with Zod validation |
| II. AI Proposes, MCP Decides | PASS | All mutations flow through MCP tools that validate before writing |
| III. Creation is Transactional | PASS | Schema validation before file write; no partial writes (FR-003) |
| IV. Git is Source of Truth | PASS | YAML files live in Git; MCP writes to filesystem, user commits |
| V. Rules are Enforceable | PASS | Cycle detection, dependency checks, schema validation block invalid states |
| VI. Everything is Queryable | PASS | explain_architecture, diff_environments, validate_architecture add queryability |
| VII. Trade-offs are First-Class | PASS | Impact analysis returns before/after for every mutation |
| Quality Gates | PASS | >80% test coverage target (SC-012), TypeScript strict mode, ESLint+Prettier |

**Gate result: ALL PASS** — no violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-mcp-write-tools/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Design decisions
├── data-model.md        # Phase 1: Entity model
├── quickstart.md        # Phase 1: Getting started guide
├── contracts/           # Phase 1: MCP tool contracts
│   ├── write-tools.md
│   ├── scaffold-tools.md
│   ├── analysis-tools.md
│   └── scan-tools.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── future-phases.md     # Phase 3-6 vision
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── engines/
│   │   ├── impact-analyzer.ts        # NEW — impact analysis for write ops
│   │   ├── codebase-scanner.ts       # NEW — scan code to detect architecture
│   │   ├── cycle-detector.ts         # EXISTING — reuse for write validation
│   │   ├── deep-merge.ts             # EXISTING — reuse for update merging
│   │   ├── resolution-engine.ts      # EXISTING — reuse for read-time resolution
│   │   └── index.ts                  # MODIFY — add new exports
│   ├── schemas/
│   │   ├── write-responses.schema.ts # NEW — WriteResponse, DeleteResponse, etc.
│   │   └── [existing schemas]        # EXISTING — no changes
│   ├── store/
│   │   ├── architecture-store.ts     # MODIFY — add write/update/delete methods
│   │   ├── yaml-serializer.ts        # NEW — YAML write utility (wraps stringifyYaml)
│   │   └── [existing files]          # EXISTING — no changes
│   └── templates/
│       ├── service-templates.ts      # NEW — smart defaults per deployment pattern
│       ├── environment-templates.ts  # NEW — smart defaults per env tier
│       └── cicd-templates.ts         # NEW — smart defaults per CI provider
├── server/
│   ├── tools/
│   │   ├── read/                     # EXISTING — no changes
│   │   ├── write/                    # NEW — 9 write tool handlers
│   │   │   ├── create-service.ts
│   │   │   ├── update-service.ts
│   │   │   ├── delete-service.ts
│   │   │   ├── create-environment.ts
│   │   │   ├── update-environment.ts
│   │   │   ├── delete-environment.ts
│   │   │   ├── update-system.ts
│   │   │   ├── set-cicd.ts
│   │   │   ├── set-observability.ts
│   │   │   └── index.ts
│   │   ├── scaffold/                 # NEW — 5 scaffold tool handlers
│   │   │   ├── scaffold-service.ts
│   │   │   ├── scaffold-environment.ts
│   │   │   ├── explain-architecture.ts
│   │   │   ├── check-readiness.ts
│   │   │   ├── migrate-pattern.ts
│   │   │   └── index.ts
│   │   ├── analysis/                 # NEW — 2 analysis tool handlers
│   │   │   ├── validate-architecture.ts
│   │   │   ├── diff-environments.ts
│   │   │   └── index.ts
│   │   ├── scan/                     # NEW — 1 scan tool handler
│   │   │   ├── scan-codebase.ts
│   │   │   └── index.ts
│   │   └── index.ts                  # MODIFY — re-export new tool categories
│   └── index.ts                      # MODIFY — register all new tools
├── cli/
│   ├── commands/
│   │   ├── create.ts                 # NEW — arch create service/env
│   │   ├── update.ts                 # NEW — arch update service/system
│   │   ├── delete.ts                 # NEW — arch delete service/env
│   │   ├── explain.ts               # NEW — arch explain [--service]
│   │   ├── check.ts                  # NEW — arch check <service>
│   │   ├── diff.ts                   # NEW — arch diff env <a> <b>
│   │   ├── migrate.ts               # NEW — arch migrate <svc> --pattern
│   │   ├── scan.ts                   # NEW — arch scan
│   │   └── [existing commands]       # EXISTING — no changes
│   └── index.ts                      # MODIFY — register new commands

tests/
├── unit/
│   ├── engines/
│   │   ├── impact-analyzer.test.ts   # NEW
│   │   └── codebase-scanner.test.ts  # NEW
│   └── store/
│       └── write-operations.test.ts  # NEW
├── integration/
│   └── tools/
│       ├── write/                    # NEW — integration tests for write tools
│       ├── scaffold/                 # NEW — integration tests for scaffold tools
│       ├── analysis/                 # NEW — integration tests for analysis tools
│       └── scan/                     # NEW — integration tests for scan tool
└── e2e/
    └── write-tools.test.ts           # NEW — full e2e with InMemoryTransport
```

**Structure Decision**: Extends the existing single-project structure. New files follow the established `src/server/tools/{category}/` pattern. All new tools mirror the existing read tool architecture (tool config + handler + formatMcpResult).

## Implementation Phases

### Phase 2A: Store Write Layer (Foundation)
**Files**: `architecture-store.ts` (modify), `yaml-serializer.ts` (new), `impact-analyzer.ts` (new)
**Tests**: `write-operations.test.ts`, `impact-analyzer.test.ts`
**Key reuse**: `stringifyYaml()` from `src/shared/utils/yaml.ts`, `deepMerge()`, `wouldCreateCycle()`

### Phase 2B: Entity Write MCP Tools (9 tools)
**Files**: `src/server/tools/write/*.ts`, `src/server/index.ts`
**Tests**: `tests/integration/tools/write/`, `tests/e2e/write-tools.test.ts`
**Key reuse**: Existing tool pattern (config + handler + formatMcpResult + withErrorHandling)

### Phase 2C: Templates & Scaffolding Tools (7 tools)
**Files**: `src/core/templates/*.ts`, `src/server/tools/scaffold/*.ts`, `src/server/tools/analysis/*.ts`
**Tests**: Integration tests for each tool

### Phase 2D: Codebase Scanning (1 tool)
**Files**: `src/core/engines/codebase-scanner.ts`, `src/server/tools/scan/scan-codebase.ts`
**Tests**: Unit tests with mock project structures

### Phase 2E: CLI Commands
**Files**: `src/cli/commands/{create,update,delete,explain,check,diff,migrate,scan}.ts`
**Tests**: Integration tests for CLI commands

**Dependency rule**: 2A → 2B → 2C (templates needed), 2A → 2D (store write methods needed), 2B+2C+2D → 2E
