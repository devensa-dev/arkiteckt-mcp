# Hooks — Deterministic Automation on Every Action

---

## What Are Hooks?

Shell commands that **automatically execute** before or after Claude Code actions. Unlike AI decisions, hooks are **deterministic** — they run every time, no exceptions.

```
User types prompt → [PreToolUse hook] → Claude runs tool → [PostToolUse hook] → Result
```

> No other AI coding tool has this. Cursor, Copilot, Windsurf — none.

---

## Hook Types

| Type | When It Fires | Use Case |
|------|--------------|----------|
| **PreToolUse** | Before a tool executes | Block dangerous commands, validate inputs |
| **PostToolUse** | After a tool completes | Auto-format, auto-lint, notify |
| **Notification** | On status changes | Slack alerts, sound notifications |

---

## Configuration

Hooks live in `.claude/settings.json` (project) or `~/.claude/settings.json` (global):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'About to run a bash command'"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-script.sh"
          }
        ]
      }
    ]
  }
}
```

---

## Environment Variables Available to Hooks

Every hook receives context through environment variables:

| Variable | Description | Available In |
|----------|-------------|-------------|
| `CLAUDE_TOOL_NAME` | The tool being called (e.g., "Bash", "Write") | Both |
| `CLAUDE_TOOL_INPUT` | JSON string of tool input parameters | Both |
| `CLAUDE_TOOL_OUTPUT` | JSON string of tool result | PostToolUse only |
| `CLAUDE_SESSION_ID` | Current session identifier | Both |
| `CLAUDE_WORKING_DIR` | Current working directory | Both |

---

## Exit Code Behavior

| Exit Code | Effect |
|-----------|--------|
| **0** | Hook succeeded — continue normally |
| **1** | Hook failed — show stderr to Claude, Claude adapts |
| **2** | **BLOCK** — prevent the tool from executing entirely |

> Exit code 2 is the superpower — it lets you **hard-block** dangerous operations.

---

## Scenario 1: Auto-Format on Every File Write

**Problem:** Claude writes code but doesn't always match your formatting rules.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_TOOL_INPUT\" 2>/dev/null; exit 0"
          }
        ]
      }
    ]
  }
}
```

**Result:** Every file Claude writes is auto-formatted by Prettier. Zero formatting drift.

---

## Scenario 2: Block Dangerous Git Commands

**Problem:** You don't want Claude to ever `git push --force` or `git reset --hard`.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo $CLAUDE_TOOL_INPUT | grep -qE '(push --force|reset --hard|clean -fd)' && exit 2 || exit 0"
          }
        ]
      }
    ]
  }
}
```

**Result:** Claude is physically blocked from running destructive git commands. Not just "asked not to" — actually blocked (exit code 2).

---

## Scenario 3: Auto-Run Tests After Code Changes

**Problem:** You want tests to run automatically after every code edit, not manually.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "cd $CLAUDE_WORKING_DIR && npx vitest run --reporter=dot 2>&1 | tail -5"
          }
        ]
      }
    ]
  }
}
```

**Result:** After every edit, tests run automatically. Claude sees failures immediately and self-corrects.

---

## Scenario 4: Slack Notification on Task Completion

**Problem:** You want to be notified when Claude finishes a long task.

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST $SLACK_WEBHOOK_URL -d '{\"text\": \"Claude Code completed a task in '$CLAUDE_WORKING_DIR'\"}'"
          }
        ]
      }
    ]
  }
}
```

**Result:** Walk away, get a Slack ping when Claude is done.

---

## Scenario 5: Enforce ESLint Before Commits

**Problem:** You want every commit to pass linting — no exceptions.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo $CLAUDE_TOOL_INPUT | grep -q 'git commit' && (npx eslint . --quiet || exit 2) || exit 0"
          }
        ]
      }
    ]
  }
}
```

**Result:** If ESLint fails, the commit is blocked (exit 2). Claude must fix lint errors first.

---

## Why This Matters

| Without Hooks | With Hooks |
|--------------|-----------|
| "Please format the code" (every time) | Auto-formatted on every write |
| Hope Claude doesn't push --force | Physically impossible to push --force |
| Manually run tests | Tests run on every edit |
| Check back to see if done | Slack notification on completion |
| Trust AI follows rules | Rules are enforced by the system |

> **Hooks turn guidelines into guarantees.** That's why no competitor has matched this.

---

## Quick Reference

```
PreToolUse   → runs BEFORE the tool   → can BLOCK with exit 2
PostToolUse  → runs AFTER the tool    → can trigger follow-up actions
Notification → runs on status changes → alerts and logging

matcher: "Bash"   → only Bash commands
matcher: "Write"  → only file writes
matcher: "Edit"   → only file edits
matcher: ""       → ALL tools (catch-all)
```
