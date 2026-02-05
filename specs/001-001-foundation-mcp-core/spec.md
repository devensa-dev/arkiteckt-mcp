# Feature Specification: MCP Core Foundation

**Feature Branch**: `001-001-foundation-mcp-core`
**Created**: 2026-02-05
**Status**: Draft
**Input**: Architecture MCP - Core infrastructure and read tools for Phase 1

> **Framework Principle**: MCP is cloud-agnostic. The examples in this spec (Lambda, ECS, Kubernetes) illustrate capabilities - they are NOT prescriptions. MCP returns whatever the USER defined in their architecture files.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI Queries System Context (Priority: P1)

As an AI tool (Claude Code, Copilot, Cursor), I need to query the MCP server to understand the system's architectural context so that I can make informed decisions when helping users create or modify services.

**Why this priority**: Without system context, AI tools cannot understand the architectural style, cloud provider, runtime defaults, or global constraints. This is the foundational query that all other operations depend on.

**Independent Test**: Can be fully tested by starting the MCP server and calling `get_system_context` tool, which returns the system configuration from `system.yaml`.

**Acceptance Scenarios**:

1. **Given** a configured architecture repository with `system.yaml`, **When** AI calls `get_system_context`, **Then** MCP returns system name, cloud provider, architecture style, and default runtime.
2. **Given** no `system.yaml` exists, **When** AI calls `get_system_context`, **Then** MCP returns an error with guidance on how to initialize the architecture.

---

### User Story 2 - AI Queries Service Context (Priority: P1)

As an AI tool, I need to query the full resolved context for a specific service in a specific environment so that I can understand its dependencies, observability profile, and environment-specific configuration.

**Why this priority**: Service context resolution is the core value of the MCP - it enables AI to create environment-aware configurations without guessing.

**Independent Test**: Can be tested by calling `get_service_context(service_name, environment)` and verifying the resolved configuration merges service, environment, and system defaults correctly.

**Acceptance Scenarios**:

1. **Given** a service `order-service` defined in `services/order.yaml`, **When** AI calls `get_service_context("order-service", "prod")`, **Then** MCP returns the service config with prod environment overrides applied.
2. **Given** a service with environment-specific database config, **When** AI queries for `dev` vs `prod`, **Then** the returned database configuration differs according to environment definitions.
3. **Given** a non-existent service name, **When** AI calls `get_service_context`, **Then** MCP returns a clear error message.

---

### User Story 3 - Architecture Store Initialization (Priority: P1)

As a developer, I need to initialize a new architecture repository with the canonical directory structure so that I have a properly formatted foundation for defining my system's architecture.

**Why this priority**: All other features depend on having a valid architecture repository structure. This is the entry point for new projects.

**Independent Test**: Can be tested by running `arch init` command and verifying the created directory structure matches the canonical layout.

**Acceptance Scenarios**:

1. **Given** an empty directory, **When** I run `arch init`, **Then** the canonical `/architecture` directory structure is created with template files.
2. **Given** an existing architecture directory, **When** I run `arch init`, **Then** the command fails with a message preventing accidental overwrite.
3. **Given** a partial architecture directory, **When** I run `arch init --repair`, **Then** missing directories and files are added without modifying existing content.

---

### User Story 4 - AI Queries Environment Context (Priority: P2)

As an AI tool, I need to query environment profiles to understand availability, scaling, security, and database requirements for each environment (local, dev, staging, prod).

**Why this priority**: Environment awareness prevents AI from suggesting production configurations for local development or vice versa.

**Independent Test**: Can be tested by calling `get_environment_context("prod")` and verifying it returns availability replicas, multi-AZ settings, and security configurations.

**Acceptance Scenarios**:

1. **Given** environment definitions in `environments/*.yaml`, **When** AI calls `get_environment_context("prod")`, **Then** MCP returns production-specific settings including replicas, security strictness, and backup policies.
2. **Given** tenant-specific environment overrides, **When** AI queries with tenant context, **Then** tenant overrides are applied to the base environment configuration.

---

### User Story 5 - AI Queries CI/CD Requirements (Priority: P2)

As an AI tool, I need to query CI/CD standards so that when I create pipelines, they automatically include required steps like build, test, sonar, docker, and deploy.

**Why this priority**: CI/CD compliance is a common source of drift. Having it queryable ensures AI-generated pipelines are correct by default.

**Independent Test**: Can be tested by calling `get_ci_requirements()` and verifying required pipeline steps and quality gates are returned.

**Acceptance Scenarios**:

1. **Given** CI standards defined in `ci/standards.yaml`, **When** AI calls `get_ci_requirements`, **Then** MCP returns pipeline provider, required steps, and SonarQube thresholds.
2. **Given** service-specific CI overrides, **When** AI queries for that service, **Then** service-specific steps are merged with global requirements.

---

### User Story 6 - AI Queries Observability Requirements (Priority: P2)

As an AI tool, I need to query observability standards so that services I help create include proper logging, metrics, and tracing configuration.

**Why this priority**: Observability is often forgotten in initial implementations. Making it queryable ensures it's always included.

**Independent Test**: Can be tested by calling `get_observability_requirements()` and verifying logging format, metrics backend, and tracing standards are returned.

**Acceptance Scenarios**:

1. **Given** observability standards in `observability/*.yaml`, **When** AI calls `get_observability_requirements`, **Then** MCP returns logging format (structured-json), metrics backend (prometheus), and tracing standard (open-telemetry).
2. **Given** a service with custom observability profile, **When** AI queries for that service, **Then** service-specific overrides are returned.

---

### User Story 7 - Resolution Engine Context Merging (Priority: P1)

As the MCP server, I need to resolve configuration by merging in order: Tenant → Environment → Service → System → Global, so that more specific configurations override general ones.

**Why this priority**: The resolution engine is the core differentiator of the MCP. Without correct resolution order, configurations will be inconsistent.

**Independent Test**: Can be tested with unit tests that verify merge behavior across different resolution scenarios.

**Acceptance Scenarios**:

1. **Given** a service with no overrides, **When** context is resolved, **Then** system defaults are returned.
2. **Given** a service with environment-specific database config, **When** context is resolved for that environment, **Then** the environment config overrides the service default.
3. **Given** a tenant with region override, **When** context is resolved for a service in that tenant, **Then** the tenant region is used instead of system default.

---

### User Story 8 - AI Gets Complete Artifact Checklist (Priority: P1)

As an AI tool (Claude Code), when a developer asks me to "create a new service", I need to query the MCP to get the COMPLETE list of artifacts I must create, so that the service is production-ready without the developer having to specify each component.

**Why this priority**: This is the CORE value proposition of the MCP - AI knows what "production-ready" means without being told every step.

**Independent Test**: Can be tested by calling `get_capability_requirements("create_service", {pattern: "lambda"})` and verifying ALL required artifacts are returned.

**Acceptance Scenarios**:

1. **Given** a request to create a Lambda service, **When** AI calls `get_capability_requirements("create_service", {pattern: "lambda"})`, **Then** MCP returns checklist including: handler code, unit tests, integration tests, SAM template, CI/CD pipeline, CloudWatch alarms, IAM role config.
2. **Given** a request to create an ECS Fargate service, **When** AI calls `get_capability_requirements("create_service", {pattern: "ecs_fargate"})`, **Then** MCP returns checklist including: application code, Dockerfile, task definition, service definition, ALB config, CI/CD pipeline, CloudWatch alarms.
3. **Given** a request to add an endpoint, **When** AI calls `get_capability_requirements("add_endpoint", {service: "order-service"})`, **Then** MCP returns checklist for ONLY the endpoint-specific changes needed.

---

### User Story 9 - AI Queries Deployment Pattern Requirements (Priority: P1)

As an AI tool, I need to understand what infrastructure artifacts are required for each deployment pattern (Lambda, ECS, EC2, Kubernetes) so that I generate the correct infrastructure-as-code.

**Why this priority**: Different deployment patterns require completely different infrastructure. AI must not guess.

**Independent Test**: Can be tested by querying each pattern and verifying pattern-specific artifacts are returned.

**Acceptance Scenarios**:

1. **Given** pattern=lambda, **When** AI queries requirements, **Then** MCP returns SAM template, API Gateway config (NOT Dockerfile, NOT Helm chart).
2. **Given** pattern=ecs_fargate, **When** AI queries requirements, **Then** MCP returns Dockerfile, task definition, ALB config (NOT SAM template, NOT Helm chart).
3. **Given** pattern=kubernetes, **When** AI queries requirements, **Then** MCP returns Dockerfile, Helm chart, network policy (NOT SAM template, NOT task definition).

---

### Edge Cases

- What happens when a service references a non-existent environment?
  - MCP MUST return a validation error listing valid environments
- How does the system handle circular dependencies in configuration?
  - Resolution engine MUST detect cycles and fail with clear error message
- What happens when YAML files contain syntax errors?
  - Store MUST validate YAML on read and return line-number-specific errors
- How does the system handle concurrent writes to Git?
  - Store MUST use atomic commits with retry logic for conflicts

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MCP server MUST expose tools via the Model Context Protocol SDK
- **FR-002**: MCP server MUST read architecture state from Git-backed YAML files
- **FR-003**: MCP server MUST validate all YAML against Zod schemas on read
- **FR-004**: Resolution engine MUST merge configurations in order: Tenant → Environment → Service → System → Global
- **FR-005**: All MCP tools MUST return structured JSON responses
- **FR-006**: MCP tools MUST include error messages with actionable guidance
- **FR-007**: Architecture store MUST support initialization of canonical directory structure
- **FR-008**: Architecture store MUST cache parsed YAML for performance (<100ms response time)
- **FR-009**: CLI MUST use the same MCP API as AI tools (no separate implementation)
- **FR-010**: All configuration files MUST be stored in `/architecture` directory

### Deployment Pattern Requirements (CRITICAL - Phase 1)

- **FR-011**: Service schema MUST include `deployment.pattern` field (lambda, ecs_fargate, ecs_ec2, ec2, kubernetes)
- **FR-012**: Capability engine MUST expand requirements based on deployment pattern
- **FR-013**: MCP MUST return pattern-specific artifact checklists when AI queries `get_capability_requirements`
- **FR-014**: Each deployment pattern MUST have defined:
  - Infrastructure artifacts (SAM template, Dockerfile, Helm chart, etc.)
  - CI/CD pipeline steps
  - Observability configuration
  - Security requirements

### Auto-Generation Requirements (CRITICAL - Phase 1)

- **FR-015**: When AI requests `get_capability_requirements("create_service", {pattern: "lambda"})`, MCP MUST return complete artifact checklist
- **FR-016**: Checklist MUST include: code structure, tests, CI/CD, infra, observability, security
- **FR-017**: AI MUST be able to create ALL artifacts without additional prompting from user
- **FR-018**: MCP MUST validate generated artifacts against organization standards

### Enterprise Requirements (Phase 2+)

- **FR-019**: Service schema MUST include resilience patterns (circuit breaker, retry, timeout, bulkhead)
- **FR-020**: MCP MUST validate services against 12-Factor App methodology
- **FR-021**: MCP MUST support SLO/SLI definitions in observability schema
- **FR-022**: MCP MUST enforce DORA metrics tracking requirements
- **FR-023**: MCP MAY validate against Well-Architected principles (cloud-agnostic, optional)
- **FR-024**: Architecture store MUST support Kubernetes schemas (when pattern=kubernetes)
- **FR-025**: Architecture store MUST support Istio service mesh configuration (optional)
- **FR-026**: Architecture store MUST support disaster recovery configuration (RTO/RPO)
- **FR-027**: Architecture store MUST support event-driven architecture schemas
- **FR-028**: MCP MUST support compliance framework validation (SOC2, HIPAA, PCI-DSS, GDPR)

### Key Entities

- **System**: Global architectural configuration (name, cloud, style, runtime default)
- **Service**: Individual service definition (runtime, container, dependencies, observability profile)
- **Environment**: Environment profile (local, dev, staging, prod with availability, security settings)
- **Tenant**: Multi-tenant configuration with overrides for cloud, region, compliance
- **Rule**: Enforceable constraint with scope, requirement, severity, and explanation
- **ADR**: Architecture Decision Record with decision, reasons, trade-offs, reconsideration conditions
- **Capability**: High-level operation definition listing required artifacts

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: MCP server responds to all read tool calls in <100ms average latency
- **SC-002**: AI tools (Claude Code) can successfully query system context without errors
- **SC-003**: Resolution engine correctly resolves 100% of test cases for merge order
- **SC-004**: CLI `arch init` creates valid architecture structure that passes validation
- **SC-005**: All schemas validate against provided example YAML files
- **SC-006**: Unit test coverage for core engines (resolution, store) exceeds 80%
- **SC-007**: Integration tests verify end-to-end MCP tool workflows
