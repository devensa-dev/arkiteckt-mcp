# Spec-Driven Development with GitHub Spec Kit

---

## What Is Spec Kit?

An open-source toolkit by GitHub (28K+ stars) that makes **specifications executable**.

**Core idea:** Define *what* and *why* first. AI generates *how*.

```
Traditional:  "Build me a login page"  →  AI guesses everything
Spec-Driven:  Spec → Plan → Tasks → Implement  →  AI follows a contract
```

---

## The Workflow

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   /speckit.constitution    (ONE TIME — project DNA)     │
│          ↓                                              │
│   /speckit.specify         (spec.md — user stories)     │
│          ↓                                              │
│   /speckit.clarify         (catch gaps — 5 questions)   │
│          ↓                                              │
│   /speckit.checklist       (validate spec quality)      │
│          ↓                                              │
│   /speckit.plan            (plan.md — architecture)     │
│          ↓                                              │
│   /speckit.tasks           (tasks.md — T001, T002...)   │
│          ↓                                              │
│   /speckit.analyze         (cross-artifact check)       │
│          ↓                                              │
│   /speckit.implement       (write code, mark [x])       │
│          ↓                                              │
│   /speckit.taskstoissues   (GitHub Issues — optional)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Breakdown

### Step 1: `/speckit.constitution` (Run Once)

Defines your project's non-negotiable principles:

```markdown
## Core Principles
1. Architecture is Data — YAML+Zod schemas, not prose
2. 80% test coverage minimum
3. API responses under 200ms
4. All code must pass ESLint strict
5. TypeScript strict mode always ON
```

> All subsequent commands validate against this. It's your project's "law."

### Step 2: `/speckit.specify`

Creates `spec.md` with user stories, requirements, and success criteria:

```markdown
## User Story 1: Developer Creates New Service (P1)
As a junior developer,
I want to run `arch create service payment-service`,
So that I get a fully scaffolded service with correct architecture.

### Acceptance Scenarios:
- Given a new service name, When I create it, Then YAML is schema-valid
- Given existing dependencies, When I add them, Then cycle detection runs
```

> Technology-agnostic. Focuses on WHAT and WHY, not HOW.

### Step 3: `/speckit.clarify`

AI asks up to 5 targeted questions to catch ambiguity:

```
Q1: Should delete_service cascade to tenant overrides? [Completeness]
Q2: What happens when deployment pattern changes mid-environment? [Edge Case]
Q3: Should scaffold_service auto-create env override stubs? [Scope]
Q4: Is dry-run mode required for write operations? [Safety]
Q5: How to handle concurrent writes from two AI agents? [Consistency]
```

> Answers get encoded back into spec.md. Gaps caught BEFORE coding.

### Step 4: `/speckit.plan`

Generates `plan.md` with architecture, file structure, and phases:

```markdown
## Phase 2A: Store Write Layer
- src/core/store/yaml-serializer.ts
- src/core/engines/impact-analyzer.ts
- Tests for all write operations

## Constitution Check
| Principle | Status |
|-----------|--------|
| Architecture is Data | PASS — YAML+Zod throughout |
| 80% coverage | PASS — tests planned for every method |
```

### Step 5: `/speckit.tasks`

Breaks plan into executable tasks with dependency ordering:

```markdown
- [ ] T001 Create YAML serializer in src/core/store/yaml-serializer.ts
- [ ] T002 [P] Add createService() to ArchitectureStore
- [ ] T003 [P] Add updateService() to ArchitectureStore
- [ ] T004 [US1] Write unit tests for createService
- [ ] T005 [US1] Implement create_service MCP tool handler
```

> `[P]` = parallelizable. `[US1]` = maps to user story. Dependencies respected.

### Step 6: `/speckit.analyze`

Cross-checks spec ↔ plan ↔ tasks for consistency:

```
| Finding | Severity | Location |
|---------|----------|----------|
| No test task for delete cascade | HIGH | tasks.md |
| US3 has no tasks mapped | CRITICAL | spec → tasks |
| Constitution: coverage gap in Phase 2C | MEDIUM | plan.md |
```

### Step 7: `/speckit.implement`

Executes tasks one by one, marks complete:

```markdown
- [x] T001 Create YAML serializer ✓
- [x] T002 Add createService() ✓
- [ ] T003 Add updateService() ← currently executing
```

---

## What Makes This Work

| Without Spec Kit | With Spec Kit |
|-----------------|---------------|
| "Build me a login page" | Spec defines exact user stories |
| AI guesses architecture | Plan validated against constitution |
| Coding starts immediately | Gaps caught by /clarify first |
| No traceability | Every task maps to a user story |
| Manual testing | Checklists validate requirement quality |
| "Are we done?" | Tasks tracked with [x] checkboxes |

---

## Real Results

From our Arkiteckt MCP project (Phase 1):

- **9 user stories** in spec.md
- **5 phases** in plan.md
- **83 tasks** in tasks.md
- **496 tests passing** after implementation
- **88% code coverage**
- **All 7 constitution principles** satisfied
- **<1ms latency** on all MCP tool calls

> Spec Kit doesn't slow you down. It prevents the rework that slows you down.
