import { describe, it, expect } from 'vitest';
import {
  ADRSchema,
  ADRStatusSchema,
  StakeholderSchema,
  OptionSchema,
  TradeOffSchema,
  ReconsiderationConditionSchema,
  ReferenceSchema,
} from '../../../src/core/schemas/adr.schema.js';

describe('ADRSchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal ADR', () => {
      const input = {
        id: 'ADR-001',
        title: 'Use TypeScript',
        date: '2026-01-01',
        context: 'We need to choose a language',
        decision: 'Use TypeScript',
      };

      const result = ADRSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('ADR-001');
        expect(result.data.status).toBe('proposed');
      }
    });

    it('should validate a full ADR', () => {
      const input = {
        schemaVersion: '1.0.0',
        id: 'ADR-001',
        title: 'Use TypeScript for Backend Services',
        status: 'accepted',
        date: '2026-01-01',
        lastUpdated: '2026-01-15',
        context: 'We need a type-safe language for our microservices',
        decision: 'Use TypeScript with strict mode',
        rationale: 'TypeScript provides static typing and excellent tooling',
        options: [
          {
            name: 'TypeScript',
            description: 'Typed superset of JavaScript',
            pros: ['Type safety', 'IDE support'],
            cons: ['Compilation step'],
            selected: true,
          },
          {
            name: 'JavaScript',
            description: 'Dynamic language',
            pros: ['No compilation'],
            cons: ['No types'],
            selected: false,
          },
        ],
        consequences: {
          positive: ['Better maintainability', 'Fewer runtime errors'],
          negative: ['Learning curve for team'],
          neutral: ['Migration effort required'],
        },
        tradeOffs: [
          {
            description: 'Development speed vs type safety',
            gained: 'Type safety',
            lost: 'Initial development speed',
            mitigation: 'Team training',
          },
        ],
        reconsiderWhen: [
          {
            trigger: 'If compilation times exceed 5 minutes',
            likelihood: 'low',
            impact: 'medium',
          },
        ],
        scope: {
          services: ['order-service', 'user-service'],
          environments: ['all'],
          teams: ['platform-team'],
        },
        stakeholders: [
          { name: 'John Doe', role: 'Tech Lead', opinion: 'for' },
          { name: 'Jane Smith', role: 'Developer', opinion: 'for' },
        ],
        deciders: ['CTO'],
        references: [
          {
            type: 'url',
            id: 'ts-docs',
            title: 'TypeScript Documentation',
            url: 'https://typescriptlang.org',
          },
        ],
        tags: ['language', 'typescript', 'backend'],
      };

      const result = ADRSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('accepted');
        expect(result.data.options?.length).toBe(2);
        expect(result.data.stakeholders?.length).toBe(2);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing required fields', () => {
      const input = {
        id: 'ADR-001',
      };

      const result = ADRSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty title', () => {
      const input = {
        id: 'ADR-001',
        title: '',
        date: '2026-01-01',
        context: 'Test',
        decision: 'Test',
      };

      const result = ADRSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('ADRStatusSchema', () => {
  it('should validate all statuses', () => {
    const statuses = ['proposed', 'accepted', 'deprecated', 'superseded', 'rejected'];
    statuses.forEach((status) => {
      const result = ADRStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });
  });
});

describe('StakeholderSchema', () => {
  it('should validate stakeholder opinions', () => {
    const opinions = ['for', 'against', 'neutral'];
    opinions.forEach((opinion) => {
      const result = StakeholderSchema.safeParse({ name: 'Test', opinion });
      expect(result.success).toBe(true);
    });
  });
});

describe('OptionSchema', () => {
  it('should validate an option with defaults', () => {
    const result = OptionSchema.safeParse({ name: 'Option A' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selected).toBe(false);
    }
  });
});

describe('TradeOffSchema', () => {
  it('should validate a trade-off', () => {
    const input = {
      description: 'Speed vs quality',
      gained: 'Quality',
      lost: 'Speed',
      mitigation: 'Automation',
    };

    const result = TradeOffSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('ReconsiderationConditionSchema', () => {
  it('should validate likelihood and impact levels', () => {
    const levels = ['low', 'medium', 'high'];
    levels.forEach((level) => {
      const result = ReconsiderationConditionSchema.safeParse({
        trigger: 'Test',
        likelihood: level,
        impact: level,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('ReferenceSchema', () => {
  it('should validate all reference types', () => {
    const types = ['adr', 'document', 'url', 'ticket'];
    types.forEach((type) => {
      const result = ReferenceSchema.safeParse({ type, id: 'ref-1' });
      expect(result.success).toBe(true);
    });
  });

  it('should validate relationship types', () => {
    const relationships = ['supersedes', 'superseded-by', 'related', 'implements', 'conflicts'];
    relationships.forEach((relationship) => {
      const result = ReferenceSchema.safeParse({ type: 'adr', id: 'ADR-001', relationship });
      expect(result.success).toBe(true);
    });
  });
});
