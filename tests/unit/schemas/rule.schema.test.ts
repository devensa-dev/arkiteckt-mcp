import { describe, it, expect } from 'vitest';
import {
  RuleSchema,
  RuleSetSchema,
  RuleSeveritySchema,
  RuleScopeSchema,
  RuleConditionSchema,
  RemediationSchema,
  RuleCategorySchema,
} from '../../../src/core/schemas/rule.schema.js';

describe('RuleSchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal rule', () => {
      const input = {
        id: 'RULE-001',
        name: 'Require HTTPS',
        scope: { all: true },
        condition: { property: 'security.encryption.inTransit.enforceHTTPS', operator: 'equals', value: true },
        requirement: 'All services must use HTTPS',
      };

      const result = RuleSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('RULE-001');
        expect(result.data.severity).toBe('error');
        expect(result.data.enabled).toBe(true);
      }
    });

    it('should validate a full rule', () => {
      const input = {
        schemaVersion: '1.0.0',
        id: 'RULE-001',
        name: 'Production Multi-AZ Required',
        description: 'Production services must be deployed across multiple AZs',
        category: 'reliability',
        severity: 'critical',
        enabled: true,
        scope: {
          environments: ['prod', 'production'],
          serviceTypes: ['api', 'worker'],
        },
        condition: {
          property: 'availability.multiAZ',
          operator: 'equals',
          value: true,
        },
        requirement: 'Services in production must have multiAZ enabled',
        explanation: 'Multi-AZ deployment ensures high availability during zone failures',
        remediation: {
          description: 'Set availability.multiAZ to true in the environment config',
          automated: false,
          documentation: 'https://docs.example.com/multi-az',
          example: 'availability:\n  multiAZ: true',
        },
        exceptions: [
          {
            scope: { services: ['legacy-service'] },
            reason: 'Legacy service pending migration',
            approvedBy: 'CTO',
            expiresAt: '2026-12-31',
          },
        ],
        relatedRules: ['RULE-002'],
        compliance: [
          {
            framework: 'SOC2',
            control: 'A1.1',
            requirement: 'Availability controls',
          },
        ],
        tags: ['availability', 'production', 'critical'],
      };

      const result = RuleSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('reliability');
        expect(result.data.severity).toBe('critical');
        expect(result.data.exceptions?.length).toBe(1);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing required fields', () => {
      const input = {
        id: 'RULE-001',
      };

      const result = RuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const input = {
        id: 'RULE-001',
        name: '',
        scope: {},
        condition: {},
        requirement: 'Test',
      };

      const result = RuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('RuleSetSchema', () => {
  it('should validate a rule set', () => {
    const input = {
      name: 'Production Rules',
      description: 'Rules for production environments',
      rules: [
        {
          id: 'RULE-001',
          name: 'Test Rule',
          scope: { all: true },
          condition: { property: 'test' },
          requirement: 'Test requirement',
        },
      ],
    };

    const result = RuleSetSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rules.length).toBe(1);
    }
  });
});

describe('RuleSeveritySchema', () => {
  it('should validate all severity levels', () => {
    const levels = ['info', 'warning', 'error', 'critical'];
    levels.forEach((level) => {
      const result = RuleSeveritySchema.safeParse(level);
      expect(result.success).toBe(true);
    });
  });
});

describe('RuleCategorySchema', () => {
  it('should validate all categories', () => {
    const categories = [
      'security',
      'compliance',
      'reliability',
      'performance',
      'cost',
      'operational',
      'naming',
      'documentation',
      'testing',
      'custom',
    ];
    categories.forEach((category) => {
      const result = RuleCategorySchema.safeParse(category);
      expect(result.success).toBe(true);
    });
  });
});

describe('RuleScopeSchema', () => {
  it('should validate scope with services', () => {
    const input = {
      services: ['service-a', 'service-b'],
      environments: ['prod'],
    };

    const result = RuleScopeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate scope with patterns', () => {
    const input = {
      servicePattern: '^api-.*',
      deploymentPatterns: ['lambda', 'ecs_fargate'],
    };

    const result = RuleScopeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('RuleConditionSchema', () => {
  it('should validate property-based condition', () => {
    const input = {
      property: 'deployment.replicas',
      operator: 'gte',
      value: 2,
    };

    const result = RuleConditionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate expression-based condition', () => {
    const input = {
      expression: 'service.deployment.replicas >= 2',
      expressionLanguage: 'cel',
    };

    const result = RuleConditionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate all operators', () => {
    const operators = ['exists', 'not-exists', 'equals', 'not-equals', 'contains', 'matches', 'gt', 'gte', 'lt', 'lte', 'in', 'not-in'];
    operators.forEach((operator) => {
      const result = RuleConditionSchema.safeParse({ property: 'test', operator });
      expect(result.success).toBe(true);
    });
  });
});

describe('RemediationSchema', () => {
  it('should validate remediation guidance', () => {
    const input = {
      description: 'Fix the issue by updating config',
      automated: true,
      command: 'arch fix RULE-001',
      documentation: 'https://docs.example.com',
      example: 'config:\n  value: true',
    };

    const result = RemediationSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.automated).toBe(true);
    }
  });
});
