# Skills — Reusable Workflow Templates

---

## What Are Skills?

Reusable prompt templates that encode complex workflows into simple slash commands. Think of them as **macros for AI workflows**.

```
Without Skills:  Type a 200-word prompt explaining exactly what to do every time
With Skills:     /deploy staging    ← one command, full workflow
```

> Skills are Claude Code exclusives. No competitor has this.

---

## How Skills Work

Skills are markdown files (`.md`) with optional YAML frontmatter stored in specific directories:

```
.claude/skills/           ← Project-level skills
~/.claude/skills/         ← Global skills (all projects)
```

When you type `/skillname` in Claude Code, it loads the markdown as context and Claude follows those instructions.

---

## Skill File Format

```markdown
---
name: deploy
description: Deploy the application to a specified environment
user_invocable: true
---

# Deploy Workflow

Deploy the application to the **$ARGUMENTS** environment.

## Steps:
1. Run the test suite — abort if any test fails
2. Build the production bundle
3. Run database migrations for the target environment
4. Deploy using the appropriate strategy:
   - staging: direct deploy
   - production: blue-green deployment
5. Run smoke tests against the deployed environment
6. Post deployment summary to #releases Slack channel

## Safety checks:
- Never deploy to production without passing staging first
- Always run migrations before deploying application code
- If smoke tests fail, automatically rollback
```

**Usage:**
```
/deploy staging
/deploy production
```

---

## Invocation Control

| Setting | Who Can Trigger | Use Case |
|---------|----------------|----------|
| `user_invocable: true` | User types `/skillname` | Interactive workflows |
| `claude_invocable: true` | Claude auto-triggers when relevant | Automated workflows |
| Both `true` | Either user or Claude | Flexible workflows |

```yaml
---
name: fix-lint
description: Fix all linting errors in changed files
user_invocable: true
claude_invocable: true    # Claude can auto-run this when it sees lint errors
---
```

---

## String Substitutions

| Variable | Replaced With |
|----------|--------------|
| `$ARGUMENTS` | Everything after the slash command |
| `$SELECTION` | Currently selected text in IDE |

```markdown
---
name: explain
description: Explain selected code in detail
---

Explain the following code in detail, including:
- What each section does
- Why it's implemented this way
- Potential improvements

Code to explain:
$SELECTION
```

**Usage:** Select code → type `/explain`

---

## Scenario 1: Spec Kit Integration

GitHub Spec Kit is implemented entirely as skills:

```
/speckit.specify     → Creates spec.md from natural language
/speckit.clarify     → Asks 5 targeted questions to catch gaps
/speckit.plan        → Generates architecture plan
/speckit.tasks       → Breaks plan into executable tasks
/speckit.implement   → Executes tasks one by one
```

Each is a `.md` file with detailed instructions that Claude follows precisely.

---

## Scenario 2: Custom PR Review Skill

```markdown
---
name: review-pr
description: Comprehensive PR review with security focus
user_invocable: true
---

# PR Review Checklist

Review PR #$ARGUMENTS with this checklist:

## Code Quality
- [ ] No code duplication introduced
- [ ] Functions are under 50 lines
- [ ] All new functions have meaningful names

## Security (OWASP Top 10)
- [ ] No SQL injection vulnerabilities
- [ ] No XSS in templates or string rendering
- [ ] No hardcoded secrets or API keys
- [ ] Authentication checked on all new endpoints
- [ ] Input validation on all new parameters

## Testing
- [ ] New code has unit tests
- [ ] Edge cases are covered
- [ ] Test names describe behavior, not implementation

## Performance
- [ ] No N+1 query patterns
- [ ] No unbounded data fetching
- [ ] Appropriate indexes for new queries

Post the review as a GitHub PR comment.
```

**Usage:**
```
/review-pr 42
```

---

## Scenario 3: Database Migration Skill

```markdown
---
name: migrate
description: Create and run database migration
user_invocable: true
---

# Database Migration: $ARGUMENTS

1. Generate a new migration file with a descriptive name
2. Write the UP migration (the change)
3. Write the DOWN migration (the rollback)
4. Run the migration against the dev database
5. Verify the schema change with a quick query
6. If successful, update the schema documentation
7. Run affected tests to ensure nothing breaks

## Rules:
- Always include a DOWN migration
- Use transactions for multi-statement migrations
- Never drop columns without a deprecation period
- Add indexes in a separate migration from table changes
```

**Usage:**
```
/migrate add-user-preferences-table
/migrate rename-email-to-primary-email
```

---

## Scenario 4: Component Generator Skill

```markdown
---
name: component
description: Generate a React component with tests and stories
user_invocable: true
---

# Generate Component: $ARGUMENTS

Create a new React component with the following structure:

```
src/components/$ARGUMENTS/
  $ARGUMENTS.tsx          ← Component implementation
  $ARGUMENTS.test.tsx     ← Unit tests
  $ARGUMENTS.stories.tsx  ← Storybook stories
  index.ts                ← Barrel export
```

## Requirements:
- Use TypeScript with strict types
- Use shadcn/ui primitives where applicable
- Include at least 3 test cases
- Include at least 2 Storybook stories (default + variant)
- Use Tailwind CSS for styling
- Export props interface
- Add JSDoc comment on the component
```

**Usage:**
```
/component UserAvatar
/component ProductCard
```

---

## Skills vs Aliases vs Prompts

| Feature | What It Is | Persistence |
|---------|-----------|-------------|
| **Skills** | Full workflow templates with logic | Stored in `.md` files, reusable |
| **Bash Aliases** | Simple command shortcuts | Shell config only |
| **Saved Prompts** | Reusable text snippets | No tool access |

> Skills are the most powerful because they combine natural language instructions with full tool access. Claude follows the skill template and uses any tool needed.

---

## Creating Your First Skill

```bash
# 1. Create the skills directory
mkdir -p .claude/skills

# 2. Create a skill file
cat > .claude/skills/test-and-commit.md << 'EOF'
---
name: test-and-commit
description: Run tests, then commit if passing
user_invocable: true
---

# Test and Commit

1. Run the full test suite
2. If ALL tests pass:
   - Stage all changed files
   - Create a commit with a descriptive message
   - Show the commit summary
3. If any tests FAIL:
   - Show which tests failed
   - Do NOT commit
   - Suggest fixes for the failures
EOF

# 3. Use it
# In Claude Code: /test-and-commit
```

---

## Key Takeaway

| Without Skills | With Skills |
|---------------|------------|
| Retype complex instructions | One slash command |
| Inconsistent workflows | Standardized process |
| Team members do it differently | Shared workflow templates |
| Onboarding = "ask someone" | Onboarding = "use our skills" |
| Knowledge lives in people's heads | Knowledge encoded in files |

> **Skills turn tribal knowledge into executable workflows.**
