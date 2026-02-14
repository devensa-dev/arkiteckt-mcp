# Quickstart: MCP Write Tools

## Prerequisites

- Node.js 20+
- Existing Arkiteckt MCP project (`npm install` completed)
- Architecture directory initialized (`arch init`) OR first write tool will guide initialization

## Development Setup

```bash
# Build the project
npm run build

# Run tests
npm test

# Run in dev mode (watch)
npm run dev
```

## Key Files to Understand First

| File | Purpose | Why It Matters |
|------|---------|----------------|
| `src/core/store/architecture-store.ts` | Data access layer | Add write methods here (Phase 2A) |
| `src/shared/utils/yaml.ts` | YAML parse + serialize | `stringifyYaml()` already exists — reuse it |
| `src/core/engines/deep-merge.ts` | Deep merge with source tracking | Reuse for update operations with `arrayStrategy: 'replace'` |
| `src/core/engines/cycle-detector.ts` | DFS cycle detection | Reuse `wouldCreateCycle()` for dependency validation |
| `src/server/tools/read/get-service-context.ts` | Example read tool | Follow this pattern for write tools |
| `src/server/index.ts` | Tool registration | Register new tools here |
| `src/server/middleware/error-handling.ts` | Error wrapper | Wrap all new tool handlers |

## Implementation Order

### Step 1: Store Write Layer (Phase 2A)

Start with `architecture-store.ts`. Add these methods:

```typescript
// Pattern for each write method:
async createService(name: string, config: Partial<Service>): Promise<Result<Service, ArchitectureError>> {
  // 1. Check name doesn't already exist
  // 2. Validate config against ServiceSchema
  // 3. Serialize to YAML using stringifyYaml()
  // 4. Write to architecture/services/{name}.yaml
  // 5. Invalidate cache: this.invalidateCacheKey('service:' + name)
  // 6. Return Result with created service
}
```

### Step 2: First Write Tool (Phase 2B)

Create `src/server/tools/write/create-service.ts` following the existing pattern:

```typescript
// 1. Define tool config (name, title, description, inputSchema)
export const createServiceTool = {
  name: 'create_service',
  config: {
    title: 'Create Service',
    description: '...',
    inputSchema: z.object({ name: z.string(), type: ServiceTypeSchema, ... })
  }
};

// 2. Define handler
export async function createService(input, options): Promise<ToolResponse<WriteResponse<Service>>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  // Call store.createService(), format response
}

// 3. Define MCP result formatter
export function formatMcpResult(response) { ... }
```

### Step 3: Register in Server

```typescript
// src/server/index.ts
server.registerTool(
  createServiceTool.name,
  createServiceTool.config,
  withErrorHandling(createServiceTool.name, async (args) => {
    const response = await createService(args, options);
    return formatCreateServiceResult(response);
  }, logger)
);
```

## Testing Strategy

```bash
# Unit tests only
npx vitest run tests/unit/store/write-operations.test.ts

# Integration tests for write tools
npx vitest run tests/integration/tools/write/

# E2E test with InMemoryTransport
npx vitest run tests/e2e/write-tools.test.ts

# All tests
npm test
```

### Test Pattern (integration)

```typescript
describe('create_service', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-${Date.now()}`);
    // Write fixture system.yaml
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create service with minimal overrides', async () => {
    const result = await createService(
      { name: 'payment-service', type: 'backend', deployment_pattern: 'ecs_fargate' },
      { baseDir: testDir }
    );
    expect(result.success).toBe(true);
    expect(result.data.entity.name).toBe('payment-service');
    // Verify YAML file exists
    // Verify no system defaults baked in
  });
});
```

## Important Conventions

1. **ESM imports**: Always use `.js` extension (`import { x } from './file.js'`)
2. **Result type**: Return `Result<T, ArchitectureError>` from store, `ToolResponse<T>` from tools
3. **Cache keys**: `{entityType}:{name}` for single, `{entityType}:__all__` for collections
4. **Error handling**: Never throw — always return error Results
5. **Zod v4**: Use `z.looseObject()` for cloud-agnostic extensibility
6. **exactOptionalPropertyTypes**: Cast args at bridge layer if Zod output conflicts
