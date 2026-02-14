# Agent Teams — Multiple Claude Instances Working Together

---

## What Are Agent Teams?

Multiple Claude Code instances running as a **coordinated team** — one lead agent that delegates to teammate agents, each working on different parts of a task simultaneously.

```
┌───────────────────────────────────┐
│         LEAD AGENT                │
│  (orchestrates the team)          │
│                                   │
│  Maintains task list              │
│  Assigns work to teammates        │
│  Reviews results                  │
│  Coordinates dependencies         │
└──────┬────────┬────────┬─────────┘
       │        │        │
       ▼        ▼        ▼
  ┌─────────┐┌─────────┐┌─────────┐
  │Teammate │││Teammate │││Teammate ││
  │   #1    │││   #2    │││   #3    ││
  │         │││         │││         ││
  │ Backend │││Frontend │││ Tests   ││
  │  API    │││  UI     │││         ││
  └─────────┘└─────────┘└─────────┘
  (each has own context + tools)
```

> This is the most advanced feature. No other AI coding tool has anything like this.

---

## How It Works

### Starting a Team

```bash
# Launch Claude Code with teammates
claude --teammates 3

# Or dynamically during a session:
"Split this into 3 parallel workstreams"
```

### The Lead Agent

The lead agent:
1. **Breaks down** the task into independent workstreams
2. **Assigns** each workstream to a teammate
3. **Monitors** progress via task list
4. **Coordinates** when work has dependencies
5. **Reviews** and integrates results

### Teammate Agents

Each teammate:
- Has its **own context window** (no shared memory limit)
- Has access to **all tools** (Read, Write, Edit, Bash, etc.)
- Works **independently** on its assigned task
- Reports back to the lead when done

---

## Communication Model

### Task List (Shared State)

The lead maintains a task list visible to all agents:

```
Task List:
├── [ASSIGNED → Teammate 1] Implement user authentication API
├── [ASSIGNED → Teammate 2] Build login/signup UI components
├── [ASSIGNED → Teammate 3] Write E2E tests for auth flow
├── [PENDING] Integrate frontend with backend auth
└── [PENDING] Deploy to staging
```

### Mailbox Messaging

Agents communicate through a message-passing system:

```
Lead → Teammate 1: "The JWT secret is in .env as JWT_SECRET"
Teammate 1 → Lead: "Auth API complete. Endpoints: POST /login, POST /signup, GET /me"
Lead → Teammate 2: "Auth endpoints are ready. Base URL is /api/auth"
```

---

## Display Modes

| Mode | Layout | Best For |
|------|--------|----------|
| **In-Process** | Single terminal, interleaved output | Quick tasks |
| **Split Panes** | Multiple terminal panes | Visual monitoring |

```
Split Pane Layout:
┌──────────────────┬──────────────────┐
│   Lead Agent     │   Teammate #1    │
│                  │                  │
│  Coordinating... │  Writing API...  │
│                  │                  │
├──────────────────┼──────────────────┤
│   Teammate #2    │   Teammate #3    │
│                  │                  │
│  Building UI...  │  Writing tests.. │
│                  │                  │
└──────────────────┴──────────────────┘
```

---

## Scenario 1: Full-Stack Feature Implementation

**Task:** "Build a user profile page with avatar upload, settings, and password change"

```
Lead Agent breaks it down:

Teammate 1 (Backend):
  → Create ProfileController with CRUD endpoints
  → Add avatar upload to S3
  → Add password change with validation
  → Write unit tests for all endpoints

Teammate 2 (Frontend):
  → Build ProfilePage component with shadcn
  → Implement avatar upload with drag-and-drop
  → Build settings form with validation
  → Write component tests

Teammate 3 (Infrastructure):
  → Configure S3 bucket for avatars
  → Add CloudFront CDN for avatar serving
  → Update environment variables
  → Write Terraform for new resources

Lead Agent:
  → Monitors progress
  → When Backend is done, tells Frontend the API contract
  → When all done, integrates and runs E2E tests
```

**Time comparison:**
- Single agent: ~45 minutes (sequential)
- Agent team: ~15 minutes (parallel)

---

## Scenario 2: Large-Scale Refactoring

**Task:** "Migrate from REST to GraphQL across the entire application"

```
Lead Agent plan:

Teammate 1: Schema Definition
  → Define GraphQL schema from existing REST endpoints
  → Create type definitions for all entities
  → Define queries and mutations

Teammate 2: Resolver Implementation
  → Implement resolvers for each query/mutation
  → Connect to existing service layer
  → Add authentication middleware

Teammate 3: Frontend Migration
  → Replace fetch/axios calls with Apollo Client
  → Update components to use useQuery/useMutation
  → Remove old REST utility functions

Teammate 4: Testing
  → Write integration tests for GraphQL endpoints
  → Update E2E tests for new data fetching
  → Performance benchmarks (REST vs GraphQL)

Lead Agent coordinates:
  → Teammate 1 finishes schema → Teammate 2 starts resolvers
  → Teammate 2 finishes resolvers → Teammate 3 updates frontend
  → All done → Teammate 4 runs full test suite
```

---

## Scenario 3: Microservices Development

**Task:** "Create order processing system with payment, inventory, and notification services"

```
Teammate 1: Payment Service
  → Stripe integration
  → Payment processing logic
  → Webhook handlers
  → Unit tests

Teammate 2: Inventory Service
  → Stock management
  → Reservation system
  → Low-stock alerts
  → Unit tests

Teammate 3: Notification Service
  → Email templates
  → SMS via Twilio
  → Push notifications
  → Unit tests

Teammate 4: Orchestration
  → Saga pattern for order flow
  → Event bus configuration
  → Error handling + compensation
  → Integration tests

Lead: Defines API contracts upfront → assigns → coordinates → integrates
```

---

## Scenario 4: Bug Triage Sprint

**Task:** "Fix the top 10 bugs from the latest sprint"

```
Lead Agent:
  → Reads all 10 bug reports
  → Groups by area (3 backend, 4 frontend, 3 infrastructure)
  → Assigns groups to teammates

Teammate 1: Backend bugs
  → Bug #1: Race condition in order processing
  → Bug #4: Timeout on large file uploads
  → Bug #7: Incorrect pagination offset

Teammate 2: Frontend bugs
  → Bug #2: Modal doesn't close on mobile
  → Bug #3: Date picker timezone issue
  → Bug #6: Infinite scroll stops at page 5
  → Bug #9: Dark mode toggle flickers

Teammate 3: Infrastructure bugs
  → Bug #5: Health check returns 503 intermittently
  → Bug #8: Redis connection pool exhaustion
  → Bug #10: Log rotation not working

Lead: Monitors → reviews fixes → runs full regression
```

---

## Event Hooks for Teams

Agent teams have special hook events:

| Hook Event | When It Fires | Use Case |
|-----------|--------------|----------|
| `TeammateIdle` | Teammate finishes its task | Reassign to new work |
| `TaskCompleted` | A task in the task list is marked done | Trigger dependent tasks |
| `TeamComplete` | All teammates are done | Run final integration |

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Task completed' | tee -a team-progress.log"
          }
        ]
      }
    ]
  }
}
```

---

## Best Practices

| Do | Don't |
|----|-------|
| Break work into independent streams | Create tightly coupled tasks |
| Define API contracts before assigning | Let teammates guess interfaces |
| Use for tasks >30 min single-agent | Use for simple 5-minute tasks |
| Let lead coordinate dependencies | Have teammates coordinate directly |
| Review integrated result at the end | Skip integration testing |

---

## Limitations to Know

| Limitation | Workaround |
|-----------|-----------|
| Teammates can't directly talk to each other | Lead relays messages |
| Each teammate uses its own API tokens | Cost scales with teammates |
| File conflicts possible (concurrent edits) | Lead assigns non-overlapping files |
| More teammates ≠ always faster | 3-4 is usually optimal |

---

## When to Use Agent Teams

| Task | Single Agent | Agent Team |
|------|-------------|------------|
| Fix a typo | Yes | Overkill |
| Add one API endpoint | Yes | Overkill |
| Build a full feature | Maybe | **Yes** |
| Refactor entire codebase | Slow | **Yes** |
| Fix 10+ bugs | Very slow | **Yes** |
| Build microservices | Impractical | **Yes** |
| Migrate technology stack | Days | **Hours** |

> **Rule of thumb:** If the task would take >30 minutes with a single agent, consider Agent Teams.

---

## The Multiplier Effect

```
Single Agent:    1 Claude  ×  1 context window  =  sequential work
Sub-Agents:      1 Claude  +  N search agents   =  parallel research
Agent Teams:     1 Lead    +  N full agents      =  parallel implementation

Agent Teams is the most powerful because each teammate can:
  ✓ Read files          ✓ Write files
  ✓ Run commands        ✓ Search code
  ✓ Use MCP servers     ✓ Call sub-agents of their own
```

> **This is the closest thing to having an actual development team that works at AI speed.**
