# Future Phases — Arkiteckt MCP Roadmap

**Purpose**: Document future capabilities discussed during Phase 2 specification that are explicitly out of scope for the current feature but inform architectural decisions.

---

## Phase 3: Rule Engine & Enforcement

- `enforce_rules` tool — validate architecture against defined rules
- `create_rule` / `update_rule` tools
- Pre-write validation hooks (rules checked before any write completes)

## Phase 4: Visual Architecture UI & Diagrams

- Web UI reading from the same YAML files
- C4 diagram generation (Context, Container, Component levels)
  - System-level context diagram from system.yaml
  - Container diagram from services/*.yaml with dependency arrows (sync/async, http/grpc/amqp)
  - Deployment diagrams showing services mapped to environments
- Service dependency graph visualization (interactive)
- Environment comparison view
- Data flow diagrams (sync vs async communication paths)
- Real-time architecture diagram showing ACTUAL architecture (not a stale Confluence/Lucidchart export)
- Technology-agnostic: the YAML schema works with any language/framework, so diagrams represent logical architecture regardless of tech stack

## Phase 5: Health & Runtime Integration

- Per-environment health dashboard
- Service online/offline status per environment
- Database connectivity status
- Integration with cloud provider APIs for live status

## Phase 6: Continuous Scanning & Drift Detection

- Continuous/daemon mode MCP server that watches the codebase for changes
- Periodic codebase scanning to detect architecture drift:
  - New service folder detected but no architecture YAML exists
  - Service imports another service but dependency not in YAML
  - Dockerfile added/removed but deployment pattern unchanged
  - New CI pipeline file but cicd.yaml not updated
- Drift reporting and alerting
- CI integration: run drift detection as a pre-merge check
- Terraform integration:
  - Read terraform files to auto-generate architecture YAML
  - Reverse: generate terraform from architecture definitions
  - Drift detection between architecture-as-code and actual infrastructure

## Token Efficiency Value Proposition

Key insight: The MCP serves as the coding agent's "architecture brain."

- Without MCP: Agent scans 50+ files (~50,000-100,000 tokens) per task for context
- With MCP: Agent calls one tool (~2,000-5,000 tokens) for complete, structured architecture context
- Repeated every conversation/task — the savings compound
- Structured, validated, always consistent context vs. ad-hoc file scanning

## Technology Agnosticism

The YAML schema is designed to work with any technology stack:

- `runtime.language` supports any language (TypeScript, Java, Python, Go, Rust, etc.)
- `runtime.framework` supports any framework (Express, Spring Boot, Django, Gin, etc.)
- `deployment.pattern` supports any deployment model (lambda, kubernetes, ecs_fargate, vm, etc.)
- Artifact checklists adapt to the technology: Maven vs npm, JVM tuning vs Python runtime, etc.

This universality enables:
- Cross-language project architecture management
- Technology migration guidance (e.g., Express → Fastify, Lambda → Kubernetes)
- Consistent architecture patterns regardless of implementation language
