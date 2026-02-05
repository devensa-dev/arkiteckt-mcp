# Arkiteckt MCP Constitution

<!--
Sync Impact Report:
- Version change: 2.0.0 → 3.0.0
- Made constitution cloud-agnostic (removed AWS/Istio/Kubernetes prescriptions)
- Enterprise standards now marked as OPTIONAL templates
- Aligned with framework nature: MCP stores architecture, doesn't prescribe it
-->

> **Key Principle**: Arkiteckt MCP is a FRAMEWORK, not a prescription. It provides schemas and tools for teams to define THEIR architecture. MCP doesn't tell you what cloud or tools to use - it lets you DEFINE your architecture so AI can understand it.

## Core Principles

### I. Architecture is Data, Not Text

Architecture MUST be stored as structured, machine-readable data (YAML), not prose documentation. Every architectural element (services, environments, ADRs, rules) is a first-class data entity with a defined schema. AI tools query this data; they do not interpret documentation.

**Rationale**: Structured data enables automated validation, programmatic querying, and consistent interpretation across all tools and processes.

### II. AI Proposes, MCP Decides

AI tools (Claude Code, Copilot, Cursor) propose changes; the MCP server validates and authorizes them. AI cannot bypass validation. Every creation or modification flows through MCP tools that enforce architectural rules.

**Rationale**: Centralizing authority in the MCP prevents AI hallucinations from creating invalid or non-compliant systems.

### III. Creation is Transactional

Every architectural change MUST be validated before and after materialization. If validation fails at any step, the entire operation fails - no partial implementations. Services are complete by default or not created at all.

**Rationale**: Transactional creation prevents the "half-implemented" services that cause drift and maintenance nightmares.

### IV. Git is the Source of Truth

All architectural state lives in Git as YAML files. The Git history IS the audit trail. MCP reads from and writes to Git with controlled commits. No out-of-band changes are allowed.

**Rationale**: Git provides version control, collaboration, and an immutable history that enables rollback and auditing.

### V. Rules are Enforceable, Not Advisory

Architectural rules (CI/CD requirements, security standards, observability mandates) are enforced by the MCP, not suggested. Violations block creation and CI merges. Rules include explanations so AI and humans understand WHY.

**Rationale**: Advisory rules decay over time as pressure mounts. Enforcement guarantees compliance.

### VI. Everything is Queryable

Any architectural question MUST be answerable via MCP tools. AI never needs to guess about environment differences, required dependencies, or CI standards. Context is resolved programmatically, not approximated.

**Rationale**: Queryability eliminates the knowledge silos that cause inconsistency across teams and services.

### VII. Trade-offs are First-Class Data

ADRs (Architecture Decision Records) are machine-readable constraints that include not just decisions but WHY, trade-offs, and reconsideration conditions. ADRs actively influence validation logic.

**Rationale**: Capturing trade-offs prevents future developers from relitigating settled decisions without understanding context.

## Technology Standards

### Language & Runtime
- **Primary Language**: TypeScript (strict mode)
- **Runtime**: Node.js LTS
- **Schema Validation**: Zod for type-safe schemas
- **Configuration Format**: YAML for all architecture files

### Cloud & Infrastructure (User-Defined)

**MCP is cloud-agnostic. Users define their infrastructure in their architecture files.**

- **Cloud Provider**: User's choice (AWS, Azure, GCP, on-premise, hybrid)
- **Deployment Patterns**: User's choice (Lambda, ECS, Kubernetes, VMs, containers, etc.)
- **Service Mesh**: Optional - user defines if needed (Istio, Linkerd, Consul, none)
- **Event Platform**: Optional - user defines their event system (Kafka, EventBridge, RabbitMQ, etc.)
- **Container Orchestration**: Optional - user defines if needed (Kubernetes, ECS, Nomad, none)

### Project Structure
- MCP server is the core deliverable
- CLI uses the same MCP API as AI tools
- Architecture state lives in `/architecture` directory
- Tests are mandatory for all engines (resolution, rule, capability)

### Quality Gates
- All code MUST pass TypeScript strict mode compilation
- All engines MUST have unit tests with >80% coverage
- Integration tests MUST cover MCP tool workflows
- ESLint + Prettier enforce consistent code style

## Enterprise Standards (Optional Templates)

**Note**: These are OPTIONAL validation templates. MCP provides these as templates that users CAN enable in their rules.yaml. They are NOT mandatory - users choose which standards apply to their architecture.

### VIII. 12-Factor App Compliance (Optional Template)

Users MAY enable 12-Factor App validation. If enabled, services are validated against:

1. **Codebase**: One codebase per service, tracked in version control
2. **Dependencies**: Explicitly declare and isolate dependencies
3. **Config**: Store configuration in environment variables
4. **Backing Services**: Treat backing services as attached resources
5. **Build/Release/Run**: Strictly separate build and run stages
6. **Processes**: Execute the app as stateless processes
7. **Port Binding**: Export services via port binding
8. **Concurrency**: Scale out via the process model
9. **Disposability**: Maximize robustness with fast startup and graceful shutdown
10. **Dev/Prod Parity**: Keep development, staging, and production as similar as possible
11. **Logs**: Treat logs as event streams
12. **Admin Processes**: Run admin/management tasks as one-off processes

**Rationale**: 12-Factor ensures services are cloud-native, portable, and scalable by default.

### IX. DORA Metrics Framework (Optional Template)

Users MAY enable DORA metrics tracking. If enabled, the MCP tracks:

- **Deployment Frequency**: How often code is deployed to production
- **Lead Time for Changes**: Time from code commit to production deployment
- **Mean Time to Recovery (MTTR)**: Time to restore service after an incident
- **Change Failure Rate**: Percentage of deployments causing production failures
- **Rework Rate**: Work that must be redone (2025 addition)

**Targets**:
- Elite: Multiple deploys/day, <1 hour lead time, <1 hour MTTR, <5% failure rate
- High: Weekly deploys, <1 week lead time, <1 day MTTR, <15% failure rate

**Rationale**: DORA metrics are the industry standard for measuring DevOps performance.

### X. Well-Architected Principles (Cloud-Agnostic, Optional)

Users MAY enable validation against well-architected pillars (applies to any cloud):

1. **Operational Excellence**: Monitoring, automation, incident response procedures
2. **Security**: Data protection, access control, compliance, zero-trust
3. **Reliability**: Resilience, failure recovery, fault tolerance, DR
4. **Performance Efficiency**: Computing resources, scaling, optimization
5. **Cost Optimization**: Resource utilization, waste elimination, FinOps

**Rationale**: Well-Architected principles are cloud-agnostic best practices. Users enable validation in their rules.yaml if desired.

### XI. Compliance Frameworks (Optional Templates)

Users MAY enable compliance validation for frameworks relevant to their industry:

- **SOC 2 Type II**: Security, availability, processing integrity, confidentiality, privacy
- **HIPAA**: Healthcare data protection (if applicable)
- **PCI-DSS**: Payment card data security (if applicable)
- **GDPR**: EU data protection and privacy
- **ISO 27001**: Information security management

**Rationale**: Enterprise adoption requires compliance certification support.

### XII. Resilience Patterns (Optional Template)

Users MAY enable resilience pattern validation. If enabled, production services are validated for:

1. **Circuit Breaker**: Prevent cascading failures (50% failure threshold, 60s timeout)
2. **Retry with Backoff**: Exponential backoff with jitter for transient failures
3. **Timeout Hierarchies**: Gateway → Service → Database timeout chains
4. **Bulkhead Isolation**: Resource isolation per dependency
5. **Fallback Strategies**: Graceful degradation when dependencies fail
6. **Health Checks**: Liveness, readiness, and startup probes

**Rationale**: Netflix/Uber-scale systems require resilience patterns to prevent cascading failures.

### XIII. SLO Framework (Optional Template)

Users MAY enable SLO validation. If enabled, services should define:

- **SLIs (Service Level Indicators)**: Quantifiable metrics (latency, error rate, throughput)
- **SLOs (Service Level Objectives)**: Targets for SLIs (99.9% availability)
- **Error Budgets**: Permitted unreliability for experimentation and velocity

**Rationale**: SLOs provide objective reliability targets and enable data-driven decisions.

## Development Workflow

### MCP Tool Development
1. Define tool schema with Zod
2. Implement handler with full error handling
3. Write unit tests for handler logic
4. Write integration tests for end-to-end flow
5. Document tool in API reference

### Architecture Schema Changes
1. Update Zod schema definition
2. Update all affected tools
3. Migrate existing YAML files
4. Update validation rules
5. Document migration in changelog

### Code Review Requirements
- All PRs require architecture validation to pass
- Schema changes require design review
- Breaking changes require ADR documentation

## Governance

This constitution governs all development on the Arkiteckt MCP project. Any feature, tool, or change MUST comply with these principles.

### Amendment Process
1. Propose amendment with rationale
2. Document impact on existing code/schemas
3. Create migration plan if breaking
4. Update all dependent artifacts
5. Version bump according to semantic rules

### Compliance
- CI validates constitution compliance on every PR
- Constitution violations block merges
- Exceptions require explicit ADR documentation

**Version**: 3.0.0 | **Ratified**: 2026-02-05 | **Last Amended**: 2026-02-05 | **Change**: Made cloud-agnostic, enterprise standards now optional
