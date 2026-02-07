# arkiteckt-mcp

Architecture MCP Server — AI-queryable architecture context for production-ready service generation.

Arkiteckt provides a [Model Context Protocol](https://modelcontextprotocol.io/) server that lets AI coding tools (Claude Code, Cursor, etc.) query your project's architecture decisions, service configurations, environment profiles, and deployment patterns. The same MCP API powers both the CLI and AI tool integrations.

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Initialize architecture in your project
npx arch init

# Query a service
npx arch context service order-service --env prod

# Validate all configuration files
npx arch validate
```

## Architecture Directory

After running `arch init`, your project will have:

```
architecture/
  system.yaml              # Global config: cloud provider, defaults, team
  services/
    order-service.yaml     # Per-service: deployment, dependencies, runtime
    user-service.yaml
  environments/
    dev.yaml               # Environment profiles: scaling, security, resources
    staging.yaml
    prod.yaml
  cicd.yaml                # CI/CD pipeline configuration
  observability.yaml       # Logging, metrics, tracing, alerting
  capabilities/            # Artifact checklists for AI generation
```

## CLI Commands

### `arch init`

Scaffold the `architecture/` directory with template YAML files.

```bash
arch init                    # Initialize in current directory
arch init --dir /path/to/project
```

### `arch context service <name>`

Query resolved service configuration through the MCP protocol.

```bash
arch context service order-service
arch context service order-service --env prod
arch context service order-service --env prod --tenant enterprise
arch context service order-service --output yaml
```

### `arch context env <name>`

Query resolved environment configuration.

```bash
arch context env prod
arch context env staging --tenant enterprise
arch context env dev --output table
```

### `arch validate`

Validate all architecture files against schemas.

```bash
arch validate
arch validate --dir /path/to/project
```

## MCP Tools

The server exposes 6 tools via the Model Context Protocol:

| Tool | Description |
|------|-------------|
| `get_system_context` | Global architecture config, cloud provider, defaults |
| `get_service_context` | Service config with environment/tenant resolution |
| `get_environment_context` | Environment profiles with tenant overrides |
| `get_ci_requirements` | CI/CD pipeline steps and quality gates |
| `get_observability_requirements` | Logging, metrics, tracing configuration |
| `get_capability_requirements` | Artifact checklists for code generation |

## Configuring with Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "arkiteckt": {
      "command": "node",
      "args": ["./node_modules/arkiteckt-mcp/dist/server/index.js"],
      "env": {
        "ARKITECKT_BASE_DIR": "."
      }
    }
  }
}
```

## Resolution Engine

When querying a service with environment and tenant parameters, the resolution engine merges configuration from multiple sources in priority order (later overrides earlier):

1. `system.yaml` — global defaults (runtime, region, tags)
2. `services/{name}.yaml` — base service config
3. `services/{name}.yaml#environments.{env}` — service-specific env overrides
4. `environments/{env}.yaml` — environment-level config (scaling, security)
5. `tenants/{tenant}.yaml` — tenant global overrides
6. `tenants/{tenant}.yaml#environments.{env}` — tenant env-specific overrides
7. `tenants/{tenant}.yaml#services.{name}` — tenant service-specific overrides (highest priority)

## Development

```bash
npm run build        # Compile TypeScript
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run typecheck    # Type check without emit
npm run lint         # ESLint
npm run format       # Prettier
```

## Tech Stack

- TypeScript 5.9+, Node.js 20
- MCP SDK v1.26.0
- Zod v4 (schema validation)
- Commander.js (CLI)
- Vitest (testing)
