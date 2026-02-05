import { describe, it, expect } from 'vitest';
import {
  CapabilitySchema,
  CapabilitySetSchema,
  ArtifactTypeSchema,
  ArtifactRequirementSchema,
  PatternArtifactsSchema,
  CapabilityInputSchema,
  ValidationStepSchema,
} from '../../../src/core/schemas/capability.schema.js';

describe('CapabilitySchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal capability', () => {
      const input = {
        id: 'create_service',
        name: 'Create Service',
      };

      const result = CapabilitySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('create_service');
        expect(result.data.schemaVersion).toBe('1.0.0');
      }
    });

    it('should validate a full capability', () => {
      const input = {
        schemaVersion: '1.0.0',
        id: 'create_service',
        name: 'Create Service',
        description: 'Creates a new microservice with all required artifacts',
        category: 'service',
        inputs: [
          {
            name: 'serviceName',
            type: 'string',
            description: 'Name of the service',
            required: true,
          },
          {
            name: 'pattern',
            type: 'string',
            description: 'Deployment pattern',
            required: true,
            options: ['lambda', 'ecs_fargate', 'kubernetes'],
          },
        ],
        baseArtifacts: [
          { type: 'source-code', name: 'src/index.ts', required: true },
          { type: 'unit-test', name: 'tests/index.test.ts', required: true },
          { type: 'readme', name: 'README.md', required: true },
        ],
        patternArtifacts: [
          {
            pattern: 'lambda',
            artifacts: [
              { type: 'sam-template', name: 'template.yaml', required: true },
              { type: 'iam-role', name: 'iam/role.yaml', required: true },
            ],
            excludes: ['dockerfile', 'helm-chart'],
          },
          {
            pattern: 'ecs_fargate',
            artifacts: [
              { type: 'dockerfile', name: 'Dockerfile', required: true },
              { type: 'task-definition', name: 'ecs/task.json', required: true },
            ],
            excludes: ['sam-template'],
          },
        ],
        validations: [
          { name: 'lint', type: 'lint', command: 'npm run lint', required: true },
          { name: 'test', type: 'test', command: 'npm test', required: true },
        ],
        workflow: [
          { step: 1, action: 'generate_structure', artifacts: ['source-code'] },
          { step: 2, action: 'generate_tests', artifacts: ['unit-test'] },
          { step: 3, action: 'generate_infra', artifacts: ['sam-template', 'dockerfile'] },
        ],
        postActions: [
          { name: 'validate', type: 'validation' },
          { name: 'notify', type: 'notification' },
        ],
        related: ['add_endpoint', 'update_service'],
        tags: ['service', 'creation'],
        examples: [
          {
            name: 'Lambda API',
            description: 'Create a Lambda-based API service',
            inputs: { serviceName: 'order-api', pattern: 'lambda' },
          },
        ],
      };

      const result = CapabilitySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.inputs?.length).toBe(2);
        expect(result.data.patternArtifacts?.length).toBe(2);
        expect(result.data.workflow?.length).toBe(3);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing id', () => {
      const input = {
        name: 'Create Service',
      };

      const result = CapabilitySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const input = {
        id: 'create_service',
        name: '',
      };

      const result = CapabilitySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('CapabilitySetSchema', () => {
  it('should validate a capability set', () => {
    const input = {
      name: 'Service Capabilities',
      description: 'Capabilities for service management',
      capabilities: [
        {
          id: 'create_service',
          name: 'Create Service',
        },
        {
          id: 'delete_service',
          name: 'Delete Service',
        },
      ],
    };

    const result = CapabilitySetSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capabilities.length).toBe(2);
    }
  });
});

describe('ArtifactTypeSchema', () => {
  it('should validate code artifacts', () => {
    const types = ['source-code', 'handler', 'controller', 'service-layer', 'repository', 'model', 'dto'];
    types.forEach((type) => {
      const result = ArtifactTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  });

  it('should validate test artifacts', () => {
    const types = ['unit-test', 'integration-test', 'e2e-test', 'contract-test', 'load-test'];
    types.forEach((type) => {
      const result = ArtifactTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  });

  it('should validate infrastructure artifacts', () => {
    const types = ['sam-template', 'cloudformation', 'terraform', 'pulumi', 'cdk', 'dockerfile', 'docker-compose', 'helm-chart', 'k8s-manifest', 'task-definition', 'service-definition'];
    types.forEach((type) => {
      const result = ArtifactTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  });

  it('should validate CI/CD artifacts', () => {
    const types = ['pipeline', 'github-action', 'gitlab-ci', 'jenkinsfile', 'buildspec'];
    types.forEach((type) => {
      const result = ArtifactTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  });
});

describe('ArtifactRequirementSchema', () => {
  it('should validate an artifact requirement', () => {
    const input = {
      type: 'dockerfile',
      name: 'Dockerfile',
      description: 'Container image definition',
      required: true,
      template: 'templates/Dockerfile.hbs',
      conditions: {
        deploymentPatterns: ['ecs_fargate', 'kubernetes'],
      },
      dependsOn: ['source-code'],
    };

    const result = ArtifactRequirementSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('PatternArtifactsSchema', () => {
  it('should validate pattern-specific artifacts', () => {
    const input = {
      pattern: 'lambda',
      artifacts: [
        { type: 'sam-template', name: 'template.yaml' },
        { type: 'iam-role', name: 'role.yaml' },
      ],
      notes: 'Lambda-specific configuration',
      excludes: ['dockerfile', 'helm-chart'],
    };

    const result = PatternArtifactsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('CapabilityInputSchema', () => {
  it('should validate input types', () => {
    const types = ['string', 'number', 'boolean', 'array', 'object'];
    types.forEach((type) => {
      const result = CapabilityInputSchema.safeParse({ name: 'test', type });
      expect(result.success).toBe(true);
    });
  });

  it('should validate input with options', () => {
    const input = {
      name: 'pattern',
      type: 'string',
      options: ['lambda', 'ecs', 'k8s'],
      default: 'lambda',
    };

    const result = CapabilityInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('ValidationStepSchema', () => {
  it('should validate all validation types', () => {
    const types = ['schema', 'lint', 'test', 'security', 'custom'];
    types.forEach((type) => {
      const result = ValidationStepSchema.safeParse({ name: 'test', type });
      expect(result.success).toBe(true);
    });
  });
});
