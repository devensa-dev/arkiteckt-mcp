import { describe, it, expect } from 'vitest';
import {
  SystemSchema,
  ArchitectureStyleSchema,
  RuntimeDefaultsSchema,
  GlobalDefaultsSchema,
  RepositorySchema,
} from '../../../src/core/schemas/system.schema.js';

describe('SystemSchema', () => {
  describe('valid inputs', () => {
    it('should validate a minimal system configuration', () => {
      const input = {
        name: 'my-system',
        architecture: {
          style: 'microservices',
        },
      };

      const result = SystemSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('my-system');
        expect(result.data.architecture.style).toBe('microservices');
        expect(result.data.schemaVersion).toBe('1.0.0');
      }
    });

    it('should validate a full system configuration', () => {
      const input = {
        schemaVersion: '1.0.0',
        name: 'enterprise-platform',
        description: 'Enterprise microservices platform',
        architecture: {
          style: 'microservices',
          cloud: 'aws',
          region: 'us-east-1',
        },
        defaults: {
          region: 'us-east-1',
          account: '123456789012',
          tags: {
            environment: 'production',
            team: 'platform',
          },
          runtime: {
            language: 'typescript',
            version: '5.0',
            framework: 'express',
            packageManager: 'npm',
          },
        },
        repository: {
          type: 'monorepo',
          provider: 'github',
          defaultBranch: 'main',
        },
        team: {
          name: 'Platform Team',
          email: 'platform@example.com',
          slack: '#platform-team',
        },
        metadata: {
          createdAt: '2026-01-01',
        },
      };

      const result = SystemSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.architecture.cloud).toBe('aws');
        expect(result.data.defaults?.runtime?.language).toBe('typescript');
        expect(result.data.team?.email).toBe('platform@example.com');
      }
    });

    it('should allow extra fields (passthrough)', () => {
      const input = {
        name: 'my-system',
        architecture: {
          style: 'serverless',
          customField: 'custom-value',
        },
        customTopLevel: 'allowed',
      };

      const result = SystemSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data.architecture as Record<string, unknown>).customField).toBe('custom-value');
        expect((result.data as Record<string, unknown>).customTopLevel).toBe('allowed');
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing name', () => {
      const input = {
        architecture: {
          style: 'microservices',
        },
      };

      const result = SystemSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
        architecture: {
          style: 'microservices',
        },
      };

      const result = SystemSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid architecture style', () => {
      const input = {
        name: 'my-system',
        architecture: {
          style: 'invalid-style',
        },
      };

      const result = SystemSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email in team', () => {
      const input = {
        name: 'my-system',
        architecture: { style: 'microservices' },
        team: {
          email: 'not-an-email',
        },
      };

      const result = SystemSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('ArchitectureStyleSchema', () => {
  it('should validate all architecture styles', () => {
    const styles = ['microservices', 'modular-monolith', 'serverless', 'event-driven', 'layered', 'hexagonal'];
    styles.forEach((style) => {
      const result = ArchitectureStyleSchema.safeParse(style);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid styles', () => {
    const result = ArchitectureStyleSchema.safeParse('invalid');
    expect(result.success).toBe(false);
  });
});

describe('RuntimeDefaultsSchema', () => {
  it('should validate runtime defaults', () => {
    const input = {
      language: 'typescript',
      version: '5.0',
      framework: 'express',
      packageManager: 'npm',
    };

    const result = RuntimeDefaultsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should require language field', () => {
    const input = {
      version: '5.0',
    };

    const result = RuntimeDefaultsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('RepositorySchema', () => {
  it('should apply defaults', () => {
    const result = RepositorySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('monorepo');
      expect(result.data.defaultBranch).toBe('main');
    }
  });

  it('should validate repository types', () => {
    const validInput = { type: 'polyrepo' };
    const result = RepositorySchema.safeParse(validInput);
    expect(result.success).toBe(true);

    const invalidInput = { type: 'invalid' };
    const invalidResult = RepositorySchema.safeParse(invalidInput);
    expect(invalidResult.success).toBe(false);
  });
});
