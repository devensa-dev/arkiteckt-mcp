# Architecture MCP – Complete Plan Document

## 1. Purpose

The Architecture MCP (Model Context Protocol server) is an **Architecture Control Plane for AI-driven engineering**.

Its purpose is to:
- Persist architectural knowledge beyond AI context windows
- Enforce enterprise architecture standards automatically
- Allow AI tools (Claude Code, Copilot, Cursor) to create systems end-to-end **without explicit instructions**
- Ensure consistency across services, environments, CI/CD, observability, and infrastructure
- Separate architectural decision-making from infrastructure execution

This system treats architecture as **structured, versioned, enforceable state**, not documentation.

---

## 2. Core Principles (Non-Negotiable)

1. Architecture is structured data, not prose
2. AI proposes; MCP decides
3. Creation is transactional and validated
4. Git is the source of truth
5. Rules are enforceable, not advisory
6. Terraform executes; MCP governs
7. Everything is queryable
8. “Why” (trade-offs) is first-class data
9. Humans and AI use the same control plane
10. No architectural logic lives in prompts

Violating any of these principles breaks the system at scale.

---

## 3. What the MCP Is Responsible For

The MCP must remember and enforce:

- System-wide architectural standards
- 10+ microservices and their dependencies
- Observability standards (logs, metrics, tracing)
- CI/CD requirements (GitHub Actions, SonarQube, security)
- Multiple environments (local, dev, staging, prod)
- Environment-specific differences (DB sizes, scaling, backups)
- ADRs and trade-offs
- Tenant-specific overrides
- Terraform intent (inputs, not resources)

The MCP does NOT:
- Generate business logic
- Provision infrastructure directly
- Replace Terraform
- Store runtime state

---

## 4. High-Level Architecture

- AI tools interact only via MCP tools
- MCP is the single architectural authority
- Git stores canonical architecture state
- Terraform is used only as an execution backend
- CI/CD enforces architecture independently of AI

---

## 5. Canonical Architecture Repository Structure

All architecture lives in a Git repository owned by MCP.

/architecture
system.yaml
principles.yaml
capabilities.yaml

services/
service-name.yaml

environments/
local.yaml
dev.yaml
staging.yaml
prod.yaml

observability/
logging.yaml
metrics.yaml
tracing.yaml

ci/
standards.yaml
templates/

security/
iam.yaml
secrets.yaml

adr/
ADR-001.yaml

tenants/
default.yaml
tenant-a.yaml


AI tools are not allowed to invent new folders or schemas.

---

## 6. Architecture Data Models

### 6.1 System Model

Defines global defaults.

Includes:
- System name
- Cloud provider
- Architecture style (monolith, microservices)
- Default runtime

---

### 6.2 Service Model

Each service is a first-class entity.

Defines:
- Runtime and container platform
- Dependencies (DB, messaging)
- Observability profile
- Environment overrides

Services reference environments; they do not redefine them.

---

### 6.3 Environment Model

Environments are profiles, not copies.

Defines:
- Availability (replicas, multi-AZ)
- Scaling behavior
- Database sizing
- Backups and DR
- Security strictness

Local is a real environment, not a special case.

---

### 6.4 Observability Model

Observability is mandatory architecture.

Defines:
- Logging format
- Metrics backend
- Tracing standard

All services inherit this unless explicitly exempted.

---

### 6.5 CI/CD Model

CI/CD is architecture, not YAML snippets.

Defines:
- Pipeline provider (GitHub Actions)
- Mandatory steps
- Quality gates (SonarQube)
- Security checks

This is why CI/CD is created automatically for new services.

---

### 6.6 ADR Model (Architecture Decision Records)

ADRs are machine-readable constraints.

Each ADR includes:
- Decision
- Reasons
- Trade-offs
- Consequences
- Reconsideration conditions

ADRs actively influence validation and creation logic.

---

### 6.7 Tenant Model

Supports multi-tenant architectures.

Tenants may override:
- Cloud provider
- Regions
- Database types
- Compliance rules

Resolution order:
Tenant → Environment → Service → System → Global

---

## 7. MCP Server Responsibilities

The MCP server is the architectural brain.

It provides:
- Context resolution
- Rule enforcement
- Capability expansion
- Validation
- Explanation (“why”)

It is authoritative; AI tools are not.

---

## 8. MCP Tooling (Mandatory)

### 8.1 Read Tools

Used by AI to understand context:

- get_system_context
- get_service_context
- get_environment_context
- get_ci_requirements
- get_observability_requirements
- explain_rule
- explain_adr

---

### 8.2 Creation Tools

Used to create architectural state:

- propose_architecture
- create_service
- register_service
- create_adr

AI proposes changes; MCP materializes them.

---

### 8.3 Validation Tools

Used before and after generation:

- validate_service
- validate_pipeline
- validate_change

Validation failures block further actions.

---

## 9. Resolution Engine

The resolution engine answers:

“What rules apply here?”

Resolution order:
1. Tenant
2. Environment
3. Service
4. System
5. Global

Only relevant context is returned to AI.
The full architecture is never loaded into prompts.

---

## 10. Rule Engine

Rules are enforceable constraints.

Each rule defines:
- Scope
- Requirement
- Severity
- Explanation

Violations:
- Block service creation
- Block CI merges
- Produce human-readable explanations

Rules are enforced both during AI generation and CI runs.

---

## 11. Capability Engine (Critical)

Capabilities define what an operation means.

Example: `create_service`

This capability requires:
- Service definition
- Environment configurations
- CI/CD pipeline
- Observability wiring
- Security defaults
- Terraform inputs

AI cannot skip steps.
Capabilities expand automatically.

This is how “create a service” produces everything end-to-end without explicit prompting.

---

## 12. Terraform Integration

Terraform is an execution backend, not an authority.

MCP:
- Decides what should exist
- Generates Terraform inputs (tfvars, module selections)
- Enforces architectural constraints

Terraform:
- Provisions resources
- Manages state
- Applies changes

Terraform modules remain human-maintained.
MCP never generates raw Terraform resources.

---

## 13. End-to-End Service Creation Flow

1. User asks AI to create a new service
2. AI queries MCP for service standards
3. MCP expands the `create_service` capability
4. AI generates:
   - Service code
   - Environment configs
   - CI/CD workflows
   - Observability wiring
   - Terraform inputs
5. MCP validates all outputs
6. CI runs architecture validation
7. Terraform executes

Nothing is forgotten.
Nothing is implicit.

---

## 14. CLI (Human Control Plane)

The CLI uses the same MCP APIs as AI.

Mandatory commands:
- arch init
- arch service create
- arch validate
- arch adr create
- arch explain rule

This ensures humans and AI follow the same architecture.

---

## 15. CI/CD Enforcement

Every pull request must run:
- Architecture validation
- Rule enforcement
- ADR compliance checks

Violations block merges.

Architecture enforcement does not depend on AI usage.

---

## 16. Business Model & Open-Core Strategy

### Open Source (Trust Layer)
- Architecture schemas
- Core MCP server
- Resolution logic
- Rule engine
- Capability definitions
- CLI
- Terraform interfaces

### Commercial (Enterprise Layer)
- Hosted MCP
- RBAC and approvals
- Audit logs
- Multi-tenant governance
- Compliance packs
- Drift detection
- Dashboards and reporting

Open source builds trust and adoption.
Enterprise features drive revenue.

---

## 17. What This System Guarantees

- New services are complete by default
- CI/CD is never forgotten
- Observability is always wired
- Environment differences are correct
- Terraform stays clean and reusable
- AI explanations are consistent
- Architecture survives time, teams, and scale

---

## 18. What You Are Actually Building

You are not building:
- A chatbot
- A code generator
- A Terraform replacement

You are building:

**An Architectural Operating System for AI-Driven Engineering**

This system sits between AI and reality.
That is why it works.
That is why enterprises will adopt it.
That is why it can become a real business.

## What should be open source (non-negotiable)

These must be open, or adoption will stall:

Architecture schemas (services, envs, ADRs, rules)

Core MCP protocol implementation

Resolution logic (tenant → env → service → global)

Capability definitions (create_service, validate, etc.)

CLI (so teams can trust and audit behavior)

Terraform interface contracts (inputs, not modules)

**This gives:**

Transparency

Community validation

Ecosystem trust

Tool integrations (Copilot, Claude, Cursor)

This becomes the de facto standard for AI-architecture interaction.

## What should be paid (this is where money is)

This is where enterprises will happily pay.

Enterprise MCP Control Plane

Multi-team RBAC

Audit logs

Approval workflows

Architecture change reviews

Multi-tenant management

Central governance across many repos

Client-specific overrides

Compliance isolation

Hosted MCP

Zero-setup SaaS

High availability

SLA-backed service

Secure org-level auth

Advanced policy engines

Regulatory compliance packs

Industry templates (finance, healthcare)

Advanced drift detection (Terraform plan vs architecture)

AI governance features

AI action audit trails

“Who allowed this?”

“Why was this generated?”

Enterprise observability

Architecture drift dashboards

Risk scoring

Cost impact analysis

## Suggested tech stack (concrete)

**Core MCP server**

TypeScript

Node.js

MCP SDK

Zod for schemas

YAML + Git for storage

CLI

TypeScript

Same schemas as server

Calls MCP APIs

UI (later)

React + TypeScript

Thin read-only layer

ML / analytics (later)

Python microservices (optional, separate)