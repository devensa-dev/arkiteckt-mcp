# Feature Specification: MCP Write Tools, Scaffolding & Architecture Mutation

**Feature Branch**: `001-mcp-write-tools`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "Write tools, scaffolding and architecture mutation — transforming the read-only MCP server into a full CRUD architecture management platform with guided workflows"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a New Service via MCP (Priority: P1)

A developer (of any experience level) asks an AI tool to create a new service in the architecture. The MCP server creates a validated architecture configuration file with system defaults applied, deployment-pattern-appropriate settings, and returns the file along with a checklist of what the developer needs to build next. The developer no longer needs to manually write raw configuration files or know the full architecture conventions.

**Why this priority**: This is the core value proposition — enabling developers who don't know the full architecture to correctly create services through AI. Without this, all other write tools have limited value.

**Independent Test**: Can be fully tested by requesting a new service creation and verifying a valid configuration file is written with correct defaults, and an actionable checklist is returned.

**Acceptance Scenarios**:

1. **Given** a system with existing architecture defaults, **When** a user creates a new service with a name, type, and deployment pattern, **Then** a validated configuration file is written with system defaults applied and the file path is returned.
2. **Given** a system with capability definitions for a deployment pattern, **When** a service is created with that pattern, **Then** the response includes a complete artifact checklist (source code, tests, infrastructure, observability, security, documentation) specific to that pattern.
3. **Given** existing services in the architecture, **When** a user attempts to create a service with a name that already exists, **Then** the system rejects the request with a clear error message.
4. **Given** a service creation request with invalid data, **When** the request is processed, **Then** schema validation catches the error and returns a descriptive validation failure before any file is written.

---

### User Story 2 - Update Existing Architecture Entities (Priority: P1)

A tech lead or senior developer updates an existing service, environment, or system configuration through the MCP. The system deep-merges updates into existing configuration, validates the result, detects downstream impacts (affected services, new artifact requirements, dependency changes), and writes the updated file.

**Why this priority**: Equal to creation — without update capability, architecture configuration becomes stale and developers revert to manual file editing, bypassing validation.

**Independent Test**: Can be tested by updating a service's deployment pattern and verifying the merged configuration is valid, the file is updated, and impact analysis identifies affected artifacts and environments.

**Acceptance Scenarios**:

1. **Given** an existing service configuration, **When** a user submits partial updates, **Then** the updates are deep-merged into the existing configuration preserving all fields not being updated.
2. **Given** a service update that changes the deployment pattern, **When** the update is processed, **Then** the response includes a delta of new artifacts required and artifacts no longer needed.
3. **Given** a service update that adds a new dependency, **When** the update is processed, **Then** the system runs cycle detection and rejects the update if it would create a circular dependency.
4. **Given** a system-level default change (e.g., runtime version), **When** the system configuration is updated, **Then** the response lists all services that inherit the changed defaults with before/after comparison.

---

### User Story 3 - Delete Architecture Entities with Safety Checks (Priority: P2)

A developer removes a service or environment from the architecture. The system checks for dependent services and orphaned configurations before allowing deletion, preventing accidental breakage of the architecture dependency graph.

**Why this priority**: Important for architecture hygiene but less frequently used than creation and updates. Safety checks prevent costly mistakes.

**Independent Test**: Can be tested by attempting to delete a service that other services depend on and verifying the deletion is blocked with a list of dependents.

**Acceptance Scenarios**:

1. **Given** a service that other services depend on, **When** a user attempts to delete it without forcing, **Then** the deletion is rejected with a list of dependent services.
2. **Given** a service that other services depend on, **When** a user explicitly forces deletion, **Then** the service is deleted and a warning is returned listing the now-broken dependencies.
3. **Given** an environment that services have specific overrides for, **When** the environment is deleted, **Then** the response warns about orphaned service-level environment-specific configurations.
4. **Given** a service with no dependents, **When** the user deletes it, **Then** the configuration file is removed and relevant caches are invalidated.

---

### User Story 4 - Scaffold a Complete Service Workflow (Priority: P2)

A junior developer asks AI to scaffold a new service. Beyond just creating the configuration file, the system returns a comprehensive, ordered workflow: what source code to create, what tests to write, what infrastructure files are needed, what CI/CD pipeline steps to configure, what observability to set up, what security checklist to follow, and what documentation to write — all tailored to the specific deployment pattern and environment configurations.

**Why this priority**: This is the "guided bridge" experience that differentiates Arkiteckt from simple file generation. Depends on core CRUD (P1) being complete.

**Independent Test**: Can be tested by scaffolding a service and verifying the returned workflow contains ordered steps across all categories (code, infrastructure, testing, observability, security, documentation) with pattern-specific and environment-specific details.

**Acceptance Scenarios**:

1. **Given** a scaffolding request for a container-based service, **When** the scaffold completes, **Then** the workflow includes container-specific steps (container image, orchestration config, health checks) that would not appear for a serverless pattern.
2. **Given** multiple configured environments, **When** a service is scaffolded, **Then** each workflow step includes environment-specific notes where configurations vary between environments.
3. **Given** a scaffolding request, **When** the scaffold completes, **Then** a flat human-readable checklist is returned alongside the detailed workflow for quick reference.

---

### User Story 5 - Explain and Analyze Architecture (Priority: P3)

A developer or AI agent requests a structured summary of the entire architecture (or a single service's full picture). The system returns a comprehensive overview including all services, environments, dependency graph, tech stack, and statistics — enabling instant context loading without scanning the codebase. Additionally, developers can compare environments to understand exactly what differs between them.

**Why this priority**: High value for onboarding and AI context, but read-only analysis that doesn't block core write functionality.

**Independent Test**: Can be tested by requesting an architecture explanation and verifying it returns complete service inventory, dependency graph, environment summaries, and tech stack information.

**Acceptance Scenarios**:

1. **Given** an architecture with multiple services and environments, **When** a user requests an architecture overview, **Then** the response includes service summaries, environment summaries, a dependency graph, tech stack details, and aggregate statistics.
2. **Given** a specific service name, **When** a user requests a focused explanation, **Then** the response includes the service's full resolved configuration, direct and transitive dependencies, per-environment variations, capability checklist, and related architecture decisions.
3. **Given** two environment names, **When** a user requests an environment comparison, **Then** the response shows all field-level differences with values from each environment and a human-readable summary.

---

### User Story 6 - Validate Architecture and Check Service Readiness (Priority: P3)

A developer or CI pipeline validates the entire architecture for cross-entity consistency (missing dependencies, orphaned references, security gaps) and checks whether a specific service has all required artifacts in place (configuration, tests, infrastructure, observability).

**Why this priority**: Quality assurance tooling that enhances confidence but depends on write tools existing first to have content to validate.

**Independent Test**: Can be tested by running architecture validation on a deliberately inconsistent setup and verifying all issues are detected with severity, location, and suggested fixes.

**Acceptance Scenarios**:

1. **Given** an architecture with a service referencing a non-existent dependency, **When** validation runs, **Then** the issue is reported with severity, the affected entity, and a suggestion.
2. **Given** a service with a specific deployment pattern, **When** readiness is checked, **Then** the response shows a completeness score and lists which required artifacts exist and which are missing.
3. **Given** a service with all required artifacts in place, **When** readiness is checked, **Then** the completeness score is 100% and recommendations are empty.

---

### User Story 7 - Guide Deployment Pattern Migration (Priority: P3)

A tech lead changes a service's deployment pattern (e.g., from serverless to container orchestration). The system updates the service configuration and returns a detailed migration guide: new artifacts to create, old artifacts to remove, ordered migration steps, and breaking changes with remediation guidance.

**Why this priority**: Valuable but relatively rare operation. Depends on update tools and capability lookups being complete.

**Independent Test**: Can be tested by migrating a service from one deployment pattern to another and verifying the response includes artifact deltas, ordered steps, and breaking change warnings.

**Acceptance Scenarios**:

1. **Given** a service using one deployment pattern, **When** migration to a different pattern is requested, **Then** the service configuration is updated and the response includes artifacts to add and artifacts to remove.
2. **Given** a pattern migration, **When** the migration is processed, **Then** ordered migration steps are returned with clear sequencing.
3. **Given** a pattern migration with breaking changes, **When** the migration is processed, **Then** each breaking change is listed with what will break and how to fix it.

---

### User Story 8 - Auto-Populate Architecture from Existing Codebase (Priority: P1)

A developer installs the Arkiteckt MCP on an existing project for the first time. The MCP scans the codebase (read-only) to detect services, dependencies, deployment patterns, environments, CI/CD pipelines, and observability tooling — then generates all architecture YAML files automatically. The developer reviews and confirms the detected architecture before the files are written. This eliminates the need to manually author YAML for an existing project.

**Why this priority**: This is the onboarding experience. If a developer has to manually write YAML for 12 existing services before the MCP becomes useful, adoption fails. Auto-populate makes the MCP instantly valuable on day one.

**Independent Test**: Can be tested by running the scan tool against an existing project with known services, Dockerfiles, CI configs, and infrastructure files, then verifying the generated YAML accurately reflects the actual codebase.

**Acceptance Scenarios**:

1. **Given** an existing project with multiple service directories, **When** the codebase scan runs, **Then** each service is detected with its name, type, and runtime language inferred from project files (package.json, pom.xml, go.mod, requirements.txt, etc.).
2. **Given** a project with Dockerfiles and Kubernetes manifests, **When** the scan runs, **Then** deployment patterns are correctly inferred (e.g., Dockerfile + k8s = kubernetes, serverless.yml = lambda).
3. **Given** a project with `.github/workflows/` or `.gitlab-ci.yml`, **When** the scan runs, **Then** the CI/CD provider and pipeline steps are detected and a cicd.yaml is generated.
4. **Given** a project with inter-service HTTP calls or message queue references in source code, **When** the scan runs, **Then** service dependencies are detected with protocol types (sync/async).
5. **Given** scan results, **When** the results are presented to the user, **Then** the user can review, modify, and confirm before any YAML files are written to the architecture directory.
6. **Given** a project with no detectable services or an empty project, **When** the scan runs, **Then** the system reports that no services were detected and suggests using the guided initialization flow instead.

---

### User Story 9 - Coding Agent Architecture Context (Priority: P1)

A coding agent (e.g., Claude Code) consults the MCP before planning any task to understand the full architecture context. Instead of scanning dozens of files and consuming large amounts of tokens, the agent calls a single MCP tool and receives a structured summary of the system — services, dependencies, deployment patterns, environments, tech stack, and conventions. This enables the agent to plan tasks accurately and efficiently, knowing exactly which deployment pattern a service uses, what dependencies exist, and what artifacts are required.

**Why this priority**: This is the primary integration point between the MCP and coding agents. Without this, agents waste tokens scanning codebases and may miss architectural context. This makes the MCP the "architecture brain" that agents consult for every task.

**Independent Test**: Can be tested by having a coding agent call `explain_architecture` and verifying the response contains enough structured context to correctly plan a task (e.g., "add an endpoint to order-service") without any additional file reads.

**Acceptance Scenarios**:

1. **Given** a coding agent starting a task on a specific service, **When** the agent calls `explain_architecture` with a service focus, **Then** the response includes the service's deployment pattern, runtime, dependencies, environment variations, and required artifact types — sufficient for the agent to plan implementation without scanning source code.
2. **Given** a coding agent planning a cross-service change (e.g., "add rate limiting to all API services"), **When** the agent calls `explain_architecture` with an overview focus, **Then** the response includes all services with their types, enabling the agent to identify which services are affected.
3. **Given** a coding agent creating infrastructure for a service, **When** the agent calls `get_capability_requirements` for the service's deployment pattern, **Then** the response includes the exact artifacts needed (Dockerfile, helm chart, terraform, etc.), so the agent knows what files to create.
4. **Given** a coding agent that has consulted the MCP, **When** it plans a task, **Then** it uses fewer tokens compared to scanning the codebase directly, because the MCP provides pre-structured, validated architecture context.

---

### Edge Cases

- What happens when a write operation is attempted but the architecture directory hasn't been initialized? → System prompts the user with guided initialization questions and creates the full structure before proceeding.
- How does the system handle concurrent write operations to the same configuration file?
- What happens when a service update would make the configuration exceed schema constraints (e.g., too many dependencies)?
- How does the system behave when the underlying file system is read-only or permissions are insufficient?
- What happens when a deep merge produces conflicting values (e.g., array merge strategies)?
- How does cache invalidation work when a write affects multiple cached entities (e.g., system default change)?
- What happens when a scaffolding request references a deployment pattern that has no capability definitions?
- What happens when codebase scanning detects a service but cannot determine the deployment pattern?
- How does the scan handle monorepo vs polyrepo project structures?
- What happens when the scan detects conflicting information (e.g., both a Dockerfile and a serverless.yml in the same service)?
- How does the system handle projects with non-standard directory structures where services aren't in obvious folders?

## Requirements *(mandatory)*

### Functional Requirements

**Entity Write Operations**

- **FR-001**: System MUST allow creation of new service configurations with a name, type, deployment pattern, and optional fields (description, dependencies, owner).
- **FR-002**: System MUST write only service-specific values to service YAML files; system-level defaults (runtime, region, tags) are NOT baked into service files but resolved at read time by the resolution engine. Validation at creation time MUST use resolved (merged) data to ensure correctness.
- **FR-003**: System MUST validate all configuration data against the appropriate schema before writing any file to disk.
- **FR-004**: System MUST reject creation of a service with a name that already exists in the architecture.
- **FR-005**: System MUST support deep-merge updates to existing service, environment, and system configurations, preserving fields not included in the update. For array fields (e.g., dependencies), an explicitly provided array MUST replace the existing array entirely (not append or smart-merge).
- **FR-005a**: System SHOULD be able to scan a service's source code to auto-detect dependencies (e.g., imports, HTTP calls, message queue references to other known services) and suggest them to the user for confirmation before writing.
- **FR-006**: System MUST detect and prevent circular dependencies when creating or updating service dependencies.
- **FR-007**: System MUST block deletion of a service that other services depend on, unless explicitly forced by the user.
- **FR-008**: System MUST warn about orphaned environment-specific configurations when an environment is deleted.
- **FR-009**: System MUST support create-or-update semantics for CI/CD and observability configurations (upsert behavior).
- **FR-010**: System MUST invalidate relevant cached data after any write operation to ensure subsequent reads reflect the latest state.
- **FR-010a**: When any write tool is called and the architecture directory is not initialized, the system MUST detect this, prompt the user with guided initialization questions (system name, cloud provider, architecture style, region, runtime defaults, team info), create the full directory structure and system.yaml, and then proceed with the original write operation.

**Impact Analysis**

- **FR-011**: System MUST return a list of affected services when system-level defaults are changed.
- **FR-012**: System MUST return an artifact requirements delta when a service's deployment pattern changes.
- **FR-013**: System MUST identify which services have environment-specific overrides when an environment is created or deleted.

**Scaffolding & Guidance**

- **FR-014**: System MUST provide a comprehensive, ordered workflow when scaffolding a new service, covering: source code structure, tests, infrastructure, CI/CD, observability, security, and documentation.
- **FR-015**: System MUST tailor scaffolding output to the specific deployment pattern (e.g., container-specific steps for container patterns, serverless-specific steps for serverless patterns).
- **FR-016**: System MUST include environment-specific notes in scaffolding workflows where configurations vary between environments.
- **FR-017**: System MUST provide smart defaults based on templates when creating environments (development, staging, production tiers have different default configurations for replicas, security, and availability).

**Architecture Analysis**

- **FR-018**: System MUST return a structured architecture summary including: service inventory, environment inventory, dependency graph, tech stack, and aggregate statistics.
- **FR-019**: System MUST support focused architecture explanation for a single service, including resolved configuration, dependencies (direct and transitive), and per-environment variations.
- **FR-020**: System MUST compare two environments and return all field-level differences with values from each environment.
- **FR-021**: System MUST perform cross-entity validation detecting: missing dependency references, circular dependencies, orphaned configurations, and inconsistent security levels.
- **FR-022**: System MUST check service readiness by comparing required artifacts (based on deployment pattern) against what exists, returning a completeness score and list of missing items.
- **FR-023**: System MUST guide deployment pattern migration by returning: updated configuration, new artifacts, removed artifacts, ordered migration steps, and breaking changes.

**Codebase Scanning & Auto-Populate**

- **FR-025**: System MUST scan an existing codebase (read-only) to detect services by analyzing project structure, build files (package.json, pom.xml, go.mod, requirements.txt, Cargo.toml, etc.), and directory conventions.
- **FR-026**: System MUST infer deployment patterns from infrastructure files (Dockerfile, serverless.yml, kubernetes manifests, terraform files, docker-compose.yml, etc.).
- **FR-027**: System MUST detect CI/CD configuration from pipeline files (.github/workflows/, .gitlab-ci.yml, Jenkinsfile, etc.) and generate a cicd.yaml.
- **FR-028**: System MUST detect inter-service dependencies by scanning source code for HTTP client calls, message queue references, and service discovery patterns that reference other known services in the project.
- **FR-029**: System MUST present scan results to the user for review and confirmation before writing any YAML files to the architecture directory.
- **FR-030**: System MUST detect runtime information (language, version, framework) from build/config files (e.g., .nvmrc, runtime.txt, pom.xml properties, go.mod version).
- **FR-031**: System MUST detect observability tooling from configuration files (datadog.yaml, prometheus configs, opentelemetry setup, logging libraries) and generate observability.yaml.

**Agent Integration**

- **FR-032**: System MUST return architecture context in a structured format optimized for coding agent consumption — pre-organized by entity type with all relationships resolved, so agents can plan tasks without additional file reads.
- **FR-033**: System MUST support a single-call context loading pattern where a coding agent can call one tool and receive all architecture information needed to plan a task for a specific service.

**Consistency**

- **FR-024**: All write and scaffolding operations MUST be accessible through both the MCP protocol (for AI tools) and a command-line interface (for developers), using the same underlying logic.

### Key Entities

- **Service Configuration**: Represents a deployable service with its type, deployment pattern, dependencies, resilience settings, and environment-specific overrides.
- **Environment Configuration**: Represents a deployment environment (dev, staging, prod) with availability, scaling, security, and disaster recovery settings.
- **System Configuration**: The global architecture defaults (runtime, cloud provider, region, tags) inherited by all services unless overridden.
- **CI/CD Configuration**: Pipeline definition with provider, steps, and quality gates.
- **Observability Configuration**: Logging, metrics, tracing, and alerting setup shared across the architecture.
- **Impact Analysis**: A computed result showing which entities are affected by a change, with before/after comparisons.
- **Workflow**: An ordered sequence of categorized steps (code, infrastructure, testing, observability, security, documentation) with pattern-specific and environment-specific annotations.
- **Readiness Report**: A completeness assessment showing which required artifacts exist and which are missing for a given service.
- **Scan Result**: A detected architecture snapshot from codebase analysis, including discovered services, inferred deployment patterns, detected dependencies, and confidence levels — presented for user review before committing to YAML.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with no prior knowledge of the architecture can create a correctly configured service through AI in under 2 minutes, compared to 15+ minutes of manual configuration file authoring.
- **SC-002**: All created and updated configuration files pass schema validation with zero manual corrections required.
- **SC-003**: Circular dependency introduction is detected and blocked 100% of the time during service creation or update.
- **SC-004**: Scaffolding output covers all required artifact categories for the given deployment pattern, with zero missing categories.
- **SC-005**: Architecture explanation provides sufficient context for an AI agent to understand the full system without additional file scanning.
- **SC-006**: Service readiness checks accurately identify missing artifacts with a 0% false-negative rate (no missing artifact goes unreported).
- **SC-007**: Environment comparison surfaces all field-level differences between two environments with no omissions.
- **SC-008**: Deletion safety checks prevent accidental removal of services with dependents 100% of the time (unless explicitly overridden).
- **SC-009**: Write operations correctly invalidate caches so that subsequent reads always reflect the latest written state.
- **SC-010**: All new capabilities are available through both the MCP protocol and command-line interface, sharing identical behavior.
- **SC-011**: Cross-entity validation detects all referential integrity issues (missing dependencies, orphaned configs) with zero false negatives.
- **SC-012**: Unit test coverage for all new functionality exceeds 80%.
- **SC-013**: Codebase scanning correctly detects at least 90% of services, deployment patterns, and dependencies in a multi-service project without manual intervention.
- **SC-014**: A coding agent using the MCP's `explain_architecture` tool can plan a service-level task using at least 70% fewer tokens compared to scanning the codebase directly.
- **SC-015**: Codebase scan results are presented for user review before any files are written — zero auto-writes without confirmation.

## Clarifications

### Session 2026-02-11

- Q: Should created service YAML files bake in system defaults (full snapshot) or store only service-specific overrides (relying on the resolution engine to merge defaults at read time)? → A: Minimal overrides — service YAML contains only service-specific values; the resolution engine fills in system defaults at read time. This keeps files lean and ensures system-level changes automatically propagate to all services.
- Q: How should arrays (e.g., dependencies) be handled during deep-merge updates? → A: Replace — when a user explicitly provides an array field, it completely replaces the existing array. Additionally, update_service should be able to scan source code to auto-detect and suggest dependencies before the user confirms.
- Q: What should happen when a write tool is called but the architecture directory hasn't been initialized? → A: Prompt the user — detect the missing directory, ask all relevant initialization questions (system name, cloud provider, architecture style, region, runtime defaults, team info, etc.) to properly configure the system, then create and initialize the full directory structure before proceeding with the original write operation.
- Q: Does the MCP modify source code? → A: No. The MCP only reads/writes YAML files in the architecture/ folder. It can scan source code (read-only) to detect services, dependencies, and patterns, but it never modifies source code, Dockerfiles, CI pipelines, or any files outside the architecture/ directory. The coding agent (e.g., Claude Code) uses MCP output as context and then writes the actual code separately.

## Assumptions

- The existing schema definitions (Zod v4) are stable and will not undergo breaking changes during this feature's development.
- The existing resolution engine (7-layer merge) and cycle detector will be reused for write-time validation without modification.
- The `yaml` library used for parsing also supports serialization with consistent formatting (2-space indent, block style).
- Architecture files are written to a local file system; remote storage or distributed locking is out of scope.
- Concurrent write operations are not expected in typical usage; file-level locking is not required for the initial implementation.
- Smart defaults for environment templates (dev/staging/prod) follow industry-standard cloud deployment practices.
- The existing MCP SDK `registerTool` API supports the additional tools without protocol-level changes.

## Scope Boundaries

**In Scope**:
- 9 entity write tools (create/update/delete for services and environments, update system, set cicd, set observability)
- 5 scaffolding and guidance tools (scaffold service, scaffold environment, explain architecture, check readiness, migrate pattern)
- 2 analysis tools (validate architecture, diff environments)
- Codebase scanning tool — auto-detect services, dependencies, deployment patterns, CI/CD, and observability from existing code (read-only scan, user confirms before writing)
- Agent-optimized context loading — structured architecture summaries for coding agent consumption
- Impact analysis for all write operations
- CLI commands mirroring all MCP tools
- Smart default templates for services, environments, and CI/CD providers
- Unit, integration, and end-to-end tests

**Out of Scope**:
- Rule engine and enforcement (Phase 3)
- Visual architecture UI / dashboards (Phase 4)
- Runtime health monitoring integration (Phase 5)
- Terraform generation or drift detection (Phase 6)
- File-level locking or distributed write coordination
- Version history or undo/rollback for configuration changes
- Authentication or authorization for write operations
