# End-to-End Production-Grade Workflow

---

## The Full Picture

```
Feature Idea
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: PLAN                                                      │
│  Spec Kit (/specify → /clarify → /plan → /tasks)                   │
│  + Jira MCP (create tickets) + Confluence MCP (write docs)          │
│  + Figma MCP (import designs) + Sequential Thinking (architecture)  │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: CODE                                                      │
│  Claude Code (/speckit.implement)                                   │
│  + Context7 (library docs) + GitHub MCP (PRs, reviews)              │
│  + shadcn MCP (UI components) + Prisma/Supabase (data layer)        │
│  + Clangd/PlatformIO (C++ / IoT)                                   │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 3: TEST                                                      │
│  Unit tests (vitest/jest/xunit) + Playwright MCP (E2E)             │
│  + SonarQube MCP (quality gates) + Claude Code hooks (auto-lint)    │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 4: DEPLOY                                                    │
│  Terraform MCP (IaC) + AWS/Azure MCP (cloud resources)              │
│  + Docker MCP (containers) + Kubernetes MCP (orchestration)         │
│  + GitHub MCP (Actions CI/CD) + Vercel/Cloudflare (edge)            │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 5: MONITOR                                                   │
│  Sentry MCP (errors) + Slack MCP (alerts)                           │
│  + Jira MCP (auto-create bug tickets from errors)                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Scenario: Building a Full-Stack E-Commerce Feature

### Tech Stack
- **Backend**: .NET Core Web API (C#)
- **Frontend**: React + Next.js + shadcn/ui + Tailwind
- **Database**: PostgreSQL (via Supabase or Neon)
- **Cache**: Redis (via Upstash)
- **Testing**: xUnit (.NET) + Vitest (React) + Playwright (E2E)
- **Quality**: SonarQube
- **Infrastructure**: Terraform + AWS (ECS Fargate)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry
- **Project Management**: Jira + Confluence

### Step 1: Specification (15 min)

```bash
# In Claude Code terminal
/speckit.specify
> "Product catalog feature: search, filter, pagination,
>  product detail page, add to cart integration"

/speckit.clarify
# Claude asks: "What search provider? Elastic, Algolia, or DB-level?"
# Claude asks: "Real-time inventory or cached stock levels?"

/speckit.plan
# Generates plan.md validated against constitution

/speckit.tasks
# Generates 40+ tasks with [US], [P] markers
```

### Step 2: Project Management Setup (5 min)

```bash
# Convert tasks to Jira tickets via Atlassian MCP
/speckit.taskstoissues

# Or directly:
"Create Jira epic 'Product Catalog' with child stories
 from my tasks.md user stories"
→ Atlassian MCP creates epic + stories + sub-tasks

"Create a Confluence page documenting the product catalog
 architecture from my plan.md"
→ Confluence page created with diagrams and technical details
```

### Step 3: Backend Implementation (.NET Core)

```bash
/speckit.implement
# Claude Code implements task by task:

# T001: Create ProductController.cs
"Use Context7 to check the latest ASP.NET Core 9 minimal API patterns"
→ Context7 returns current docs
→ Claude writes controller with correct patterns

# T005: Create ProductService with Supabase
"Set up the products table with search indexes"
→ Supabase MCP creates migration + generates C# types

# T008: Add Redis caching layer
"Configure Upstash Redis for product catalog caching"
→ Upstash MCP provisions database + returns connection config
```

### Step 4: Frontend Implementation (Next.js + shadcn)

```bash
# T015: Product listing page
"Use shadcn DataTable for the product listing with
 sorting, filtering, and pagination"
→ shadcn MCP returns exact component code + install command
→ Claude integrates with the .NET API

# T020: Product detail page
"Read the Figma design for product-detail-v2 frame"
→ Figma MCP returns component tree with design tokens
→ Claude generates pixel-perfect React components
```

### Step 5: Testing

```bash
# Unit tests (auto-generated during /implement)
"Run all .NET tests"    → dotnet test
"Run all React tests"   → npx vitest run

# E2E tests via Playwright MCP
"Write E2E tests for the product search flow:
 1. Navigate to /products
 2. Type 'laptop' in search
 3. Verify results contain 'laptop'
 4. Click first result
 5. Verify product detail page loads"
→ Playwright MCP generates + runs tests against live page

# Quality gate via SonarQube MCP
"Run SonarQube analysis on the product catalog module"
→ Returns: 92% coverage, 0 critical issues, A quality gate
```

### Step 6: Infrastructure (Terraform + AWS)

```bash
# Write Terraform for the product service
"Create Terraform for an ECS Fargate service behind an ALB
 with RDS PostgreSQL and ElastiCache Redis"
→ Terraform MCP provides current provider docs
→ Claude writes main.tf, variables.tf, outputs.tf

# Validate before deploy
"Validate my CloudFormation/Terraform"
→ AWS IaC MCP runs cfn-lint + security compliance checks

# Deploy
"Apply the Terraform plan to staging"
→ Claude runs terraform plan → shows diff → terraform apply
```

### Step 7: CI/CD (GitHub Actions)

```bash
# Create GitHub Actions workflow
"Create a CI/CD pipeline that:
 1. Runs .NET tests
 2. Runs React tests
 3. Runs Playwright E2E
 4. Runs SonarQube analysis
 5. Builds Docker images
 6. Deploys to staging on merge to develop
 7. Deploys to production on merge to main with manual approval"

→ Claude writes .github/workflows/ci.yml
→ GitHub MCP creates PR with the workflow
```

### Step 8: Monitoring + Feedback Loop

```bash
# After deployment
"Check Sentry for any new errors in the product-catalog service"
→ Sentry MCP returns: 2 new issues, 0 critical

"Create Jira bug tickets for the Sentry errors"
→ Atlassian MCP creates tickets with stack traces attached

"Post deployment summary to #product-team on Slack"
→ Slack MCP sends formatted deployment report
```

---

## C++ / IoT Scenario: Building a Smart Sensor Gateway

### Tech Stack
- **Firmware**: C++ (ESP32 via PlatformIO)
- **Communication**: MQTT (EMQX broker)
- **Cloud**: AWS IoT SiteWise
- **Backend**: .NET Core API for dashboard
- **Frontend**: React + Next.js for monitoring UI

### Workflow

```bash
# 1. Spec + Plan (same Spec Kit flow)
/speckit.specify
> "Smart sensor gateway: reads temperature, humidity, pressure
>  from I2C sensors, publishes to MQTT, displays on web dashboard"

# 2. Firmware Development
"Initialize a PlatformIO project for ESP32-S3"
→ PlatformIO MCP initializes project with board config

"Find the definition of SensorManager::calibrate()"
→ Clangd MCP returns exact source location + type info

"Install the Adafruit BME280 library"
→ PlatformIO MCP installs library

"Build and upload the firmware"
→ PlatformIO MCP compiles + flashes ESP32

# 3. IoT Cloud Setup
"Create an AWS IoT SiteWise asset model for the sensor gateway"
→ AWS IoT SiteWise MCP creates model with properties

"Set up anomaly detection for temperature readings"
→ IoT SiteWise MCP configures ML-powered monitoring

# 4. Backend + Frontend (same .NET + React flow as above)
# 5. Deploy, Test, Monitor (same tools)
```

---

## MCP Configuration (.mcp.json)

All MCPs configured in one file at project root:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/github/github-mcp-server"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "" }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-playwright"]
    },
    "atlassian": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-atlassian"],
      "env": {
        "JIRA_URL": "https://your-org.atlassian.net",
        "JIRA_EMAIL": "",
        "JIRA_API_TOKEN": ""
      }
    },
    "sonarqube": {
      "command": "npx",
      "args": ["-y", "sonarqube-mcp-server"],
      "env": { "SONARQUBE_URL": "", "SONARQUBE_TOKEN": "" }
    },
    "terraform": {
      "command": "npx",
      "args": ["-y", "@hashicorp/terraform-mcp-server"]
    },
    "shadcn": {
      "command": "npx",
      "args": ["-y", "shadcn-ui-mcp-server"]
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "supabase-mcp-server"]
    }
  }
}
```

---

## The Production-Grade Checklist

| Concern | Tool/MCP | Status |
|---------|----------|--------|
| Specification | Spec Kit | /specify → /plan → /tasks |
| Project tracking | Jira MCP | Tickets from tasks |
| Documentation | Confluence MCP | Auto-generated from plan |
| Code quality | SonarQube MCP | Quality gates enforced |
| Unit tests | Built-in (vitest/xunit) | >80% coverage |
| E2E tests | Playwright MCP | Critical flows covered |
| Security scan | SonarQube + AWS IaC MCP | SAST + IaC compliance |
| Infrastructure | Terraform + AWS MCP | Reproducible IaC |
| Containers | Docker MCP | Consistent environments |
| CI/CD | GitHub Actions + GitHub MCP | Automated pipeline |
| Deployment | Vercel / AWS / K8s MCP | Zero-downtime deploy |
| Monitoring | Sentry MCP | Error tracking + alerting |
| Communication | Slack MCP | Team notifications |
| Design fidelity | Figma MCP | Design token extraction |
| Architecture docs | Arkiteckt MCP | Architecture as code |
