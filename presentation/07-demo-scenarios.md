# Live Demo Scenarios

---

## Demo 1: Spec to Code in 10 Minutes (Next.js + shadcn)

**Goal:** Show the full Spec Kit → Implement flow for a simple feature.

```bash
# 1. Create the spec
/speckit.specify
> "User profile page: avatar upload, name editing,
>  email display, password change, dark mode toggle"

# 2. Clarify gaps
/speckit.clarify

# 3. Generate plan + tasks
/speckit.plan
/speckit.tasks

# 4. Start implementing
/speckit.implement

# Claude Code:
# - Queries Context7 for Next.js 15 App Router docs
# - Queries shadcn MCP for Avatar, Input, Button, Switch components
# - Writes the page component with all sub-components
# - Writes unit tests
# - Marks each task [x] as it completes
```

**Audience takeaway:** Structured workflow → less rework → production-quality output.

---

## Demo 2: Create Jira Tickets from a Spec (Atlassian MCP)

**Goal:** Show AI creating real Jira tickets from spec.md.

```bash
# After /speckit.tasks generates tasks.md:
"Read my tasks.md and create Jira tickets in the ECOM project:
 - One epic for the feature
 - Child stories for each user story
 - Sub-tasks for implementation tasks
 - Set priority based on [P1], [P2] markers
 - Link dependencies between tickets"

# Atlassian MCP creates:
#   ECOM-101: [Epic] User Profile Feature
#   ECOM-102: [Story] Avatar Upload (P1)
#   ECOM-103: [Story] Profile Editing (P1)
#   ECOM-104: [Story] Password Change (P2)
#   ...with all sub-tasks and links
```

**Audience takeaway:** Spec → Jira in seconds. No manual ticket creation.

---

## Demo 3: E2E Testing with Playwright MCP

**Goal:** Show AI writing and running E2E tests against a live app.

```bash
"Write Playwright E2E tests for the login flow:
 1. Go to /login
 2. Enter email: test@example.com
 3. Enter password: TestPass123!
 4. Click Sign In
 5. Verify redirect to /dashboard
 6. Verify welcome message shows user name

 Also test:
 - Invalid credentials show error
 - Empty form shows validation messages
 - Forgot password link works"

# Playwright MCP:
# - Navigates to the page (accessibility tree mode)
# - Identifies form elements
# - Generates test file with all scenarios
# - Runs tests and reports results
```

**Audience takeaway:** AI writes tests from natural language. No manual selectors.

---

## Demo 4: Infrastructure with Terraform + AWS MCP

**Goal:** Show AI writing and validating Terraform.

```bash
"Create Terraform for a .NET Core API deployment:
 - ECS Fargate cluster with 2 tasks
 - Application Load Balancer with HTTPS
 - RDS PostgreSQL (db.t3.micro, multi-AZ)
 - ElastiCache Redis (cache.t3.micro)
 - VPC with public/private subnets
 - Security groups (only ALB is public)
 - CloudWatch log groups
 - Use Terraform modules where possible"

# Claude:
# 1. Queries Terraform MCP for latest AWS provider docs
# 2. Writes main.tf, variables.tf, outputs.tf, vpc.tf
# 3. Queries AWS IaC MCP to validate the template
# 4. AWS IaC returns: "2 warnings: missing encryption at rest for RDS"
# 5. Claude fixes and re-validates: "PASS - all compliance checks"
```

**Audience takeaway:** AI writes + validates IaC. Catches security issues before deploy.

---

## Demo 5: SonarQube Quality Gates

**Goal:** Show AI checking code quality during development.

```bash
# After writing a module:
"Run SonarQube analysis on src/services/payment/"

# SonarQube MCP returns:
# Quality Gate: PASSED
# - Coverage: 87% (threshold: 80%)
# - Duplications: 2.1% (threshold: 3%)
# - Code Smells: 3 (all minor)
# - Vulnerabilities: 0
# - Security Hotspots: 1 (SQL query in PaymentService.cs line 42)

"Fix the SQL injection hotspot in PaymentService.cs"
# Claude reads line 42, switches to parameterized query
# Re-runs analysis: "0 hotspots, quality gate PASSED"
```

**Audience takeaway:** Quality enforcement during coding, not after.

---

## Demo 6: C++ IoT — Build + Flash + Monitor

**Goal:** Show AI managing embedded firmware development.

```bash
# Initialize ESP32 project
"Create a PlatformIO project for ESP32-S3 with WiFi + MQTT"
→ PlatformIO MCP initializes with board config

# Write sensor driver
"Write a C++ class to read BME280 temperature/humidity via I2C"
→ Clangd MCP provides semantic code intelligence
→ Claude writes the driver with proper error handling

# Build and flash
"Build and upload to the connected ESP32"
→ PlatformIO MCP: compile → flash → success

# Monitor
"Start serial monitor"
→ PlatformIO MCP streams serial output
→ "Temperature: 23.5C, Humidity: 45.2%, Pressure: 1013.25hPa"
```

**Audience takeaway:** Full embedded workflow without leaving Claude Code.

---

## Demo 7: Confluence Documentation from Code

**Goal:** Show AI auto-generating documentation.

```bash
"Create a Confluence page under the 'Architecture' space that documents:
 - The product catalog service architecture
 - API endpoints (from my controllers)
 - Database schema (from my migrations)
 - Deployment diagram (text-based)
 - Environment differences (from my architecture/ YAML files)
 - Include a decision log from our ADR files"

# Confluence MCP creates a rich documentation page
# with tables, code blocks, and structured content
```

**Audience takeaway:** Documentation stays in sync with code automatically.

---

## Recommended Demo Order for Presentation

| # | Demo | Duration | Impact |
|---|------|----------|--------|
| 1 | Spec to Code (Spec Kit + shadcn) | 8 min | Shows the full workflow |
| 2 | Jira Tickets from Spec | 3 min | Wow factor — instant ticket creation |
| 3 | Playwright E2E Tests | 5 min | Testing without manual effort |
| 4 | SonarQube Quality Check | 3 min | Quality enforcement in real-time |
| 5 | Terraform + AWS Validation | 5 min | IaC with security compliance |
| 6 | C++ IoT (if audience relevant) | 5 min | Shows breadth beyond web |
| 7 | Confluence Docs | 3 min | Documentation that writes itself |

---

## Questions to Prepare For

1. **"Is this just fancy autocomplete?"**
   → No. It plans, reasons, executes multi-step workflows, validates, and deploys. Autocomplete suggests the next line. Claude Code builds the feature.

2. **"What about code quality? Does AI write bad code?"**
   → SonarQube MCP + Playwright MCP + hooks (auto-lint, auto-test) catch issues in real-time. The quality gates are the same ones humans use.

3. **"How much does it cost?"**
   → Claude Pro $20/mo. For a team of 5, that's $100/mo vs saving 20+ hours/week of manual spec writing, ticket creation, boilerplate coding, and documentation.

4. **"Can it work with our existing tools?"**
   → MCP is an open standard. If your tool has an API, it can have an MCP server. 270+ servers already exist in the Docker MCP catalog.

5. **"What about security? Is our code leaving our machine?"**
   → Claude Code runs locally in your terminal. MCP servers run locally. Code stays on your machine. Only prompts go to the API (with enterprise data controls available).
