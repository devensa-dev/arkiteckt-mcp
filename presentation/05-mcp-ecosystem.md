# MCP Ecosystem — 30+ Servers for Every Development Phase

---

## What Is MCP?

**Model Context Protocol** — created by Anthropic. An open standard that lets AI tools connect to external services.

```
┌──────────────┐     MCP Protocol      ┌──────────────────┐
│  Claude Code  │ ←──────────────────→  │  MCP Server      │
│  (AI Agent)   │   tools / resources   │  (Jira, GitHub,  │
│              │   prompts              │   Terraform...)   │
└──────────────┘                        └──────────────────┘
```

**Add a server in one command:**
```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

---

## MCP Servers by Development Lifecycle

### Phase 1: PLANNING & PROJECT MANAGEMENT

| Server | What It Does | Key Tools |
|--------|-------------|-----------|
| **Atlassian (Jira + Confluence)** | Official Atlassian MCP — create/search issues, write docs | Search issues, bulk-create tickets from specs, create/update Confluence pages |
| **Linear** | AI-powered issue management | 21 tools: create issues, manage sprints, search workspace |
| **Figma** | Design context for code generation | Get design frames, extract design tokens, component metadata |
| **Sequential Thinking** | Structured reasoning for complex decisions | Break down problems, revise reasoning, explore alternatives |

**Example workflow:**
```
"Create Jira tickets from my spec.md user stories" → Atlassian MCP creates 9 tickets
"Read the design for the dashboard page" → Figma MCP returns component tree
```

---

### Phase 2: CODING & DEVELOPMENT

| Server | What It Does | Key Tools |
|--------|-------------|-----------|
| **Context7** | Real-time library docs (no hallucination) | `resolve-library-id`, `query-docs` — always current API docs |
| **GitHub** | Full GitHub API — repos, PRs, issues, Actions | Browse code, create PRs, review, monitor CI/CD workflows |
| **shadcn/ui** | Component library for React/Vue/Svelte | List components, get source code, installation guides |
| **Memory** | Persistent knowledge graph across sessions | Create entities, relations, observations — remember decisions |
| **Filesystem** | Structured file operations | Read, write, search, move files with access control |

**Example workflow:**
```
"How do I use the new Next.js 15 App Router?" → Context7 returns current docs
"Add a shadcn DataTable to the users page" → shadcn MCP returns exact code + install steps
```

---

### Phase 3: C++ & EMBEDDED / IoT

| Server | What It Does | Key Tools |
|--------|-------------|-----------|
| **Clangd MCP** | Semantic C++ code intelligence | Find definitions, references, hover info, diagnostics, call hierarchy |
| **Clangaroo** | 14-tool C++ intelligence (works with broken builds) | Symbol search, type hierarchy, function signatures, AI-enhanced insights |
| **MCP-CPP** | Large codebase analysis (Rust-powered) | Project details, symbol search, deep context analysis |
| **PlatformIO MCP** | Embedded dev workflow (1000+ boards) | Init project, build, upload firmware, monitor serial, manage libraries |
| **ESP MCP over MQTT** | MCP server running ON ESP32 hardware | Dynamic tool registration — AI controls real IoT devices |

**Example workflow:**
```
"Find all references to SensorManager::read() in the firmware" → Clangd MCP returns semantic results
"Build the ESP32 project and upload to the connected device" → PlatformIO compiles + flashes
"Read the temperature from the IoT sensor" → ESP32 MCP server responds with live data
```

---

### Phase 4: DATA & BACKEND

| Server | What It Does | Key Tools |
|--------|-------------|-----------|
| **PostgreSQL** | Direct DB access — query, schema discovery | Execute SQL, list tables, describe columns, index tuning |
| **Supabase** | Full backend management | Create projects, design tables, generate migrations, TypeScript types |
| **Neon** | Serverless Postgres with branching | Create DB branches, run migrations, safe start/commit |
| **Prisma** | ORM workflow automation | Schema generation, migration management, type generation |
| **Upstash** | Redis/caching management | Create databases, manage keys, backups, throughput metrics |

**Example workflow:**
```
"Create a users table with email, role, and created_at" → Supabase MCP creates migration
"Add a Redis cache for the session store" → Upstash MCP provisions + configures
```

---

### Phase 5: TESTING & QUALITY

| Server | What It Does | Key Tools |
|--------|-------------|-----------|
| **Playwright** | Browser automation & E2E testing (by Microsoft) | Navigate, click, fill forms, generate tests, accessibility tree snapshots |
| **SonarQube** | Code quality & security scanning | Analyze files, quality gate status, detect vulnerabilities, code smells |
| **Puppeteer/Browserbase** | Web scraping & visual regression | Screenshots, JS execution, form interaction, PDF generation |

**Example workflow:**
```
"Write E2E tests for the login flow" → Playwright MCP generates test code from live page
"Run SonarQube analysis on the auth module" → SonarQube MCP returns quality report
```

---

### Phase 6: INFRASTRUCTURE & DEPLOYMENT

| Server | What It Does | Key Tools |
|--------|-------------|-----------|
| **Terraform** | HashiCorp's official IaC server | Provider docs, module search, policy libraries, workspace management |
| **AWS (65+ servers)** | Full AWS service access | Lambda, ECS, EKS, S3, CDK, CloudFormation, IoT SiteWise, 15K+ APIs |
| **AWS IaC** | CDK + CloudFormation assistance | Validate templates, compliance scanning, deployment troubleshooting |
| **AWS IoT SiteWise** | Industrial IoT asset management | 70+ tools: assets, models, time series, anomaly detection, gateways |
| **Azure** | 47+ Azure services | AKS, Container Apps, Cosmos DB, AI Foundry, and more |
| **Docker** | Container management + MCP catalog | Create/manage containers, Docker Compose stacks, 270+ containerized MCPs |
| **Kubernetes** | Cluster management (by Red Hat) | Pod ops, deployments, services, namespaces, logs, diagnostics |
| **Cloudflare** | Edge deployment & Workers | Deploy to edge, DNS, security, CDN configuration |
| **Vercel** | Application deployment | Deploy apps, manage serverless functions, MCP server hosting |

**Example workflow:**
```
"Write Terraform for an ECS Fargate service with ALB" → Terraform MCP provides current provider docs
"Validate my CloudFormation template" → AWS IaC MCP runs cfn-lint + cfn-guard security scan
"Deploy the Next.js app to Vercel" → Vercel MCP handles deployment
```

---

### Phase 7: MONITORING & OPERATIONS

| Server | What It Does | Key Tools |
|--------|-------------|-----------|
| **Sentry** | Error monitoring & root cause analysis | Search errors, AI-powered root cause (Seer), release health, performance |
| **Slack** | Team communication | Search messages, send updates, retrieve thread context |

**Example workflow:**
```
"What errors are happening in production right now?" → Sentry MCP returns top issues with stack traces
"Post the deployment summary to #releases" → Slack MCP sends formatted message
```

---

### Cross-Cutting: RESEARCH

| Server | What It Does | Key Tools |
|--------|-------------|-----------|
| **Brave Search** | Web search with freshness controls | General search, local search, pagination |
| **Context7** | Library documentation (also in Coding phase) | Always-current API docs |

---

## Summary: Full Lifecycle Coverage

```
PLAN          CODE          TEST          DEPLOY        MONITOR
────          ────          ────          ──────        ───────
Jira          Context7      Playwright    Terraform     Sentry
Confluence    GitHub        SonarQube     AWS (65+)     Slack
Linear        shadcn/ui     Puppeteer     Azure (47+)
Figma         Clangd                      Docker
              PlatformIO                  Kubernetes
              PostgreSQL                  Cloudflare
              Supabase                    Vercel
              Prisma
              Upstash
              Neon
```

> **30+ MCP servers. Every phase covered. One AI agent orchestrates them all.**
