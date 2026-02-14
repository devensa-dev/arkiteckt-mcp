# Claude Code — Unique Features Overview

---

## Features No Other Tool Has

| Feature | What It Does | Competitors |
|---------|-------------|-------------|
| **CLAUDE.md** | Project memory that loads every conversation | Cursor has .cursorrules (similar) |
| **Extended Thinking** | Up to 128K token reasoning budget | Model-dependent elsewhere |
| **Hooks** | Deterministic pre/post automation on every action | **Nobody** |
| **Sub-agents** | Parallel specialized agents with own context | **Nobody** |
| **Skills** | Reusable workflow templates (merged with slash commands) | **Nobody** |
| **Agent Teams** | Multiple Claude instances coordinating together | **Nobody** |
| **MCP (native)** | Anthropic created MCP — deepest integration | Others support it, Claude owns it |

> 4 features are Claude Code exclusives. Let's deep-dive into each.

---

## CLAUDE.md — Project Memory

Hierarchical memory that loads into every conversation automatically:

```
~/.claude/CLAUDE.md                    # Global (all projects)
  └── /project/CLAUDE.md              # Project-level
       └── /project/src/CLAUDE.md     # Directory-level (most specific wins)
```

**What to put in it:**
- Coding conventions ("use kebab-case for files")
- Architecture decisions ("all APIs use Express + Zod validation")
- Testing instructions ("run `npm test` before committing")
- Common pitfalls ("TypeScript strictNullChecks is ON")

---

## Extended Thinking

```
/think harder           # More reasoning for complex problems
/think ultrathink       # Maximum budget (128K tokens)
```

**When to use:** Architectural decisions, debugging race conditions, multi-file refactoring, understanding unfamiliar codebases.

---

## Detailed Feature Slides

| Feature | Slide |
|---------|-------|
| Hooks | [03a-hooks-deep-dive.md](03a-hooks-deep-dive.md) |
| Sub-agents | [03b-subagents-deep-dive.md](03b-subagents-deep-dive.md) |
| Skills | [03c-skills-deep-dive.md](03c-skills-deep-dive.md) |
| Agent Teams | [03d-agent-teams-deep-dive.md](03d-agent-teams-deep-dive.md) |

---

## Feature Comparison Matrix

| Feature | Claude Code | Cursor | Copilot | Windsurf | Cline | Aider |
|---------|-------------|--------|---------|----------|-------|-------|
| CLAUDE.md memory | Yes | .cursorrules | No | .windsurfrules | .clinerules | .aider |
| Extended thinking | Yes | Model-dep. | Model-dep. | No | Model-dep. | Model-dep. |
| Hooks | **Yes** | No | No | No | No | No |
| Sub-agents | **Yes** | No | No | No | No | No |
| Skills | **Yes** | No | No | No | No | No |
| Agent teams | **Yes** | No | No | No | No | No |
| MCP (native) | **Yes** | Yes | Yes | Yes | Yes | Limited |
| Git operations | Full | No | Partial | No | No | Auto-commit |
