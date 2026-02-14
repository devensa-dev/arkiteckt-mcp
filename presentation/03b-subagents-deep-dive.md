# Sub-Agents — Parallel Specialized Workers

---

## What Are Sub-Agents?

Independent Claude instances that run **in parallel** with their own context window. The main Claude delegates tasks to specialized sub-agents, each with its own tools and focus.

```
┌──────────────────────┐
│   Main Claude Agent   │
│   (orchestrator)      │
└──────┬───┬───┬───────┘
       │   │   │
       ▼   ▼   ▼
    ┌───┐┌───┐┌───┐
    │ E ││ B ││ P │    E = Explore agent
    │   ││   ││   │    B = Bash agent
    │   ││   ││   │    P = Plan agent
    └───┘└───┘└───┘
    (parallel execution)
```

> No other tool has this. Cursor, Copilot, Windsurf — they all use a single agent thread.

---

## Built-In Agent Types

| Agent Type | Specialty | Tools Available |
|-----------|-----------|----------------|
| **Explore** | Fast codebase search | Glob, Grep, Read, WebSearch, WebFetch |
| **Plan** | Architecture design | All read tools (no Edit/Write) |
| **Bash** | Command execution | Bash only |
| **general-purpose** | Complex multi-step tasks | All tools |

---

## How to Invoke Sub-Agents

Sub-agents are invoked automatically by Claude when it determines parallel work is beneficial. You can also guide it:

```
"Search for all API endpoints while also checking the test coverage"
→ Claude spawns Explore agent for endpoints + Bash agent for coverage

"Investigate the auth module and the payment module simultaneously"
→ Claude spawns 2 Explore agents in parallel
```

---

## Foreground vs Background Agents

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Foreground** | Blocks main agent until complete | Results needed before continuing |
| **Background** | Runs independently, check later | Long tasks (test suites, builds) |

```
Background example:
Claude: "I'll run the full test suite in the background while I fix this bug."
→ Bash agent runs tests in background
→ Main Claude continues editing code
→ When tests finish, results are available
```

---

## Custom Agents (via `.claude/agents/`)

Create your own specialized agents by adding markdown files:

```
.claude/agents/
  security-reviewer.md
  api-tester.md
  docs-generator.md
```

**Example: `security-reviewer.md`**

```markdown
---
name: security-reviewer
description: Reviews code for OWASP Top 10 vulnerabilities
tools: [Read, Grep, Glob]
---

# Security Reviewer Agent

You are a security expert. When invoked, you:
1. Search for SQL queries without parameterization
2. Check for XSS vulnerabilities in templates
3. Look for hardcoded secrets or API keys
4. Verify authentication checks on all API routes
5. Check for CSRF protection on state-changing endpoints

Report findings in this format:
- **CRITICAL**: [description] at [file:line]
- **HIGH**: [description] at [file:line]
- **MEDIUM**: [description] at [file:line]
```

**Invocation:**
```
"Run the security reviewer on the src/api/ directory"
→ Claude spawns the custom agent with its specialized instructions
```

---

## Scenario 1: Parallel Codebase Research

**Task:** "Understand how the authentication system works across frontend and backend"

```
Main Claude spawns:
  ├── Explore agent → searches backend auth (controllers, middleware, JWT)
  ├── Explore agent → searches frontend auth (hooks, context, guards)
  └── Explore agent → searches test files for auth test patterns

Results returned in parallel → Main Claude synthesizes the full picture
```

**Time saved:** 3 sequential searches → 1 parallel batch. ~3x faster.

---

## Scenario 2: Multi-File Refactoring with Validation

**Task:** "Rename the User model to Account across the entire codebase"

```
Main Claude:
  1. Spawns Explore agent → find all files referencing "User" model
  2. Gets results → edits all files
  3. Spawns Bash agent (background) → runs full test suite
  4. Continues with next task while tests run
  5. Checks test results when done
```

---

## Scenario 3: Research + Implementation in Parallel

**Task:** "Add Redis caching to the product API"

```
Main Claude spawns simultaneously:
  ├── Explore agent → "How is caching currently implemented in this project?"
  ├── general-purpose agent → "Query Context7 for Redis best practices in Node.js"
  └── Explore agent → "Find all product API endpoints that need caching"

All 3 return results → Main Claude implements with full context
```

---

## Scenario 4: Build + Test + Lint Simultaneously

**Task:** After implementing a feature

```
Main Claude spawns 3 Bash agents in parallel:
  ├── Bash agent → npm run build
  ├── Bash agent → npm test
  └── Bash agent → npm run lint

All 3 run simultaneously → Results combined → Fix any issues
```

**Time saved:** 3 sequential steps → 1 parallel batch.

---

## When to Use Sub-Agents

| Situation | Recommendation |
|-----------|---------------|
| Simple file read | Don't use sub-agents — Read directly |
| Search 1-2 files | Don't use sub-agents — Grep directly |
| Search across entire codebase | **Use Explore agent** |
| Run build + tests | **Use Bash agents in parallel** |
| Research multiple topics | **Use multiple Explore agents** |
| Complex multi-step research | **Use general-purpose agent** |
| Long-running command | **Use background Bash agent** |

---

## Key Benefits

| Single Agent | With Sub-Agents |
|-------------|----------------|
| Sequential research (slow) | Parallel research (fast) |
| One context window fills up | Each agent has own context |
| Long tasks block everything | Background agents don't block |
| Generic approach to all tasks | Specialized agents for specific jobs |
| Main context polluted with search results | Sub-agents return only summaries |

> **Sub-agents are like having a team of junior developers you can dispatch simultaneously.** You give directions, they do the legwork, you synthesize.
