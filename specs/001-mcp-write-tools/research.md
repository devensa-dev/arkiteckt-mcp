# Research: MCP Write Tools, Scaffolding & Architecture Mutation

**Branch**: `001-mcp-write-tools` | **Date**: 2026-02-11

## R1: YAML Serialization Strategy

**Decision**: Reuse existing `stringifyYaml()` from `src/shared/utils/yaml.ts` wrapped in a thin `YamlSerializer` class.

**Rationale**: The `yaml` v2.8.2 library already has `stringify()` support. The existing `stringifyYaml(data, { indent: 2, lineWidth: 120 })` function handles serialization. A thin wrapper adds consistent formatting (no flow style, sorted keys for deterministic output) and a `writeYamlFile(filePath, data)` convenience method that handles directory creation and atomic writes.

**Alternatives considered**:
- Direct `yaml.stringify()` calls in each tool — rejected because formatting would be inconsistent across tools
- `js-yaml` library — rejected because the project already uses `yaml` v2.8.2

## R2: Store Write Method Pattern

**Decision**: Add write/update/delete methods directly to `ArchitectureStore` class following the existing `Result<T, ArchitectureError>` pattern.

**Rationale**: The store already handles file I/O, caching, and YAML parsing. Write methods follow the same pattern: validate → write → invalidate cache → return result. Keeping reads and writes in the same class maintains single responsibility (the store IS the data access layer).

**Alternatives considered**:
- Separate `ArchitectureWriter` class — rejected because it would need access to the same cache, parser, and file system abstractions, leading to tight coupling anyway
- Repository pattern — rejected as over-engineering; the store already IS the repository

**New methods to add**:
```
createService(name, config) → Result<Service, ArchitectureError>
updateService(name, updates) → Result<Service, ArchitectureError>
deleteService(name) → Result<void, ArchitectureError>
createEnvironment(name, config) → Result<Environment, ArchitectureError>
updateEnvironment(name, updates) → Result<Environment, ArchitectureError>
deleteEnvironment(name) → Result<void, ArchitectureError>
updateSystem(updates) → Result<System, ArchitectureError>
setCICD(config) → Result<CICD, ArchitectureError>
setObservability(config) → Result<Observability, ArchitectureError>
```

## R3: Deep Merge for Updates

**Decision**: Reuse existing `deepMerge()` from `src/core/engines/deep-merge.ts` with `arrayStrategy: 'replace'` (per clarification Q2).

**Rationale**: The deep merge engine already supports source tracking, array strategy selection, and circular reference detection. The `replace` strategy for arrays was confirmed during spec clarification — explicit arrays replace entirely rather than appending or smart-merging.

**Alternatives considered**:
- Smart merge by identity field (e.g., match dependencies by `name`) — rejected per user decision; replace is simpler and more predictable
- Append strategy — rejected per user decision

## R4: Impact Analysis Engine

**Decision**: Create new `ImpactAnalyzer` class in `src/core/engines/impact-analyzer.ts`.

**Rationale**: Impact analysis is a cross-cutting concern that multiple tools need (update_service, update_system, delete_service, migrate_pattern). Centralizing it in an engine follows the existing pattern (ResolutionEngine, CycleDetector).

**Methods**:
```
analyzeServiceDeletion(name) → { dependents: string[], canDelete: boolean }
analyzeSystemDefaultsChange(oldDefaults, newDefaults) → { affectedServices: ServiceImpact[] }
analyzeDeploymentPatternChange(service, oldPattern, newPattern) → { addedArtifacts, removedArtifacts }
analyzeEnvironmentDeletion(name) → { orphanedOverrides: { service: string, envKey: string }[] }
```

**Dependencies**: Uses `ArchitectureStore.getServices()` to scan for dependencies and overrides.

## R5: Write Tool Response Types

**Decision**: Create `WriteResponse<T>` and `DeleteResponse` types in `src/core/schemas/write-responses.schema.ts`.

**Rationale**: Write operations return richer data than reads — they include the written entity, file path, impact analysis, and next steps. A standardized envelope ensures consistency across all 9 write tools.

```typescript
interface WriteResponse<T> {
  entity: T;              // Created/updated entity
  filePath: string;       // Where it was written
  impact?: ImpactAnalysis; // Downstream effects
  nextSteps?: string[];   // Human-readable guidance
}

interface DeleteResponse {
  deleted: string;         // Entity name
  filePath: string;        // Deleted file path
  warnings: string[];      // Broken dependencies, orphaned configs
}
```

## R6: Codebase Scanner Architecture

**Decision**: Create `CodebaseScanner` class in `src/core/engines/codebase-scanner.ts` with pluggable detectors.

**Rationale**: Different detection tasks (services, dependencies, CI/CD, deployment patterns) are independent and should be composable. A detector-based architecture allows adding new detectors without modifying the scanner core.

**Detectors**:
1. `ServiceDetector` — scans for package.json, pom.xml, go.mod, requirements.txt, Cargo.toml
2. `DeploymentDetector` — scans for Dockerfile, serverless.yml, k8s manifests, docker-compose.yml
3. `CICDDetector` — scans for .github/workflows/, .gitlab-ci.yml, Jenkinsfile
4. `DependencyDetector` — scans source code for HTTP calls, imports referencing other detected services
5. `RuntimeDetector` — scans .nvmrc, runtime.txt, go.mod version, pom.xml properties
6. `ObservabilityDetector` — scans for datadog.yaml, prometheus configs, opentelemetry imports

**Output**: `ScanResult` with confidence levels, presented for user review before writing.

**Alternatives considered**:
- AST-based source code analysis — rejected for initial implementation; too complex and language-specific. Regex/pattern matching on imports and HTTP URLs is sufficient for v1.
- External tools (e.g., running `npm ls`) — rejected to avoid requiring tool installation or project build

## R7: Template System for Smart Defaults

**Decision**: Static template objects in `src/core/templates/` — no templating engine needed.

**Rationale**: Templates are just default configuration objects that get deep-merged with user input. TypeScript objects with type safety are simpler and more maintainable than a templating engine.

**Service templates** (keyed by deployment pattern):
- `lambda`: entrypoint-based, no container config, API Gateway integration
- `ecs_fargate`: container config with health checks, auto-scaling defaults
- `kubernetes`: container config with k8s-specific resources, probes
- `container`: generic container with Dockerfile defaults

**Environment templates** (keyed by tier):
- `dev`: 1 replica, no multi-AZ, relaxed security, no DR
- `staging`: 2 replicas, multi-AZ, standard security
- `prod`: 3+ replicas, multi-AZ, strict security, DR enabled

**CI/CD templates** (keyed by provider):
- `github-actions`: workflow structure with standard steps
- `gitlab-ci`: pipeline stages with standard jobs

## R8: Guided Initialization Flow

**Decision**: When write tools detect uninitialized architecture directory, return a structured prompt response that the AI agent or CLI can use to ask the user setup questions.

**Rationale**: Per clarification Q3, the system should prompt the user with guided initialization questions. Since the MCP protocol is request/response (not interactive), the tool returns a structured "needs initialization" response with the questions to ask, and the agent/CLI handles the interaction. The actual initialization is then performed via a follow-up `init_architecture` tool call with the user's answers.

**Alternatives considered**:
- Auto-initialize with hardcoded defaults — rejected per user decision; they want guided setup
- Block with error message — rejected per user decision; too much friction

## R9: Existing Utilities to Reuse

**Decision**: Maximize reuse of existing code; no new dependencies needed.

| Existing Code | Reuse For |
|---------------|-----------|
| `stringifyYaml()` in `src/shared/utils/yaml.ts` | YAML serialization in write operations |
| `deepMerge()` in `src/core/engines/deep-merge.ts` | Merging updates into existing configs |
| `wouldCreateCycle()` in `src/core/engines/cycle-detector.ts` | Validating dependency changes |
| `buildDependencyGraph()` in `src/core/engines/cycle-detector.ts` | Finding dependents for deletion safety |
| `ResolutionEngine` in `src/core/engines/resolution-engine.ts` | Resolving merged configs for validation |
| `Cache` in `src/core/store/cache.ts` | Cache invalidation after writes |
| `YamlParser` in `src/core/store/yaml-parser.ts` | Reading existing configs before update |
| `withErrorHandling()` in `src/server/middleware/error-handling.ts` | Wrapping new tool handlers |
| `createLogger()` in `src/server/middleware/logging.ts` | Logging in new tools |
| `Result<T, E>` type | Error handling in all new methods |
| `ToolResponse<T>` type | Response envelope for all new tools |
| All Zod schemas | Validation before writing |

## R10: MCP Tool Naming Convention

**Decision**: Follow verb_noun pattern matching existing tools, with category grouping.

**Naming**:
- Write: `create_service`, `update_service`, `delete_service`, `create_environment`, `update_environment`, `delete_environment`, `update_system`, `set_cicd`, `set_observability`
- Scaffold: `scaffold_service`, `scaffold_environment`, `explain_architecture`, `check_service_readiness`, `migrate_deployment_pattern`
- Analysis: `validate_architecture`, `diff_environments`
- Scan: `scan_codebase`

**Rationale**: Consistent with existing `get_system_context`, `get_service_context` etc. The verb clearly indicates whether the operation is read-only or mutating.
