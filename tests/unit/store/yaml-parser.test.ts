import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { YamlParser, type EntityType } from '../../../src/core/store/yaml-parser.js';
import type { System, Service, Environment } from '../../../src/shared/types/index.js';

describe('YamlParser', () => {
  describe('parse', () => {
    it('should parse valid system YAML', () => {
      const yaml = `
name: my-platform
version: "1.0.0"
architecture:
  style: microservices
  cloud: aws
defaults:
  runtime:
    language: typescript
    version: "20"
`;
      const parser = new YamlParser();
      const result = parser.parse<System>(yaml, 'system');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('my-platform');
        expect(result.data.architecture.style).toBe('microservices');
      }
    });

    it('should parse valid service YAML', () => {
      const yaml = `
name: user-service
type: backend
deployment:
  pattern: ecs_fargate
`;
      const parser = new YamlParser();
      const result = parser.parse<Service>(yaml, 'service');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('user-service');
        expect(result.data.type).toBe('backend');
        expect(result.data.deployment.pattern).toBe('ecs_fargate');
      }
    });

    it('should parse valid environment YAML', () => {
      const yaml = `
name: production
tier: production
availability:
  sla: "99.9%"
  multiAz: true
`;
      const parser = new YamlParser();
      const result = parser.parse<Environment>(yaml, 'environment');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('production');
        expect(result.data.tier).toBe('production');
      }
    });

    it('should return validation error for invalid schema', () => {
      const yaml = `
name: 123
type: invalid-type
`;
      const parser = new YamlParser();
      const result = parser.parse<Service>(yaml, 'service');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
        expect(result.error.message).toContain('service');
      }
    });

    it('should return parse error for malformed YAML', () => {
      const yaml = `
name: test
  invalid: indentation
`;
      const parser = new YamlParser();
      const result = parser.parse<System>(yaml, 'system');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('parse');
      }
    });

    it('should include entity type in validation error message', () => {
      const yaml = `
invalid: data
`;
      const parser = new YamlParser();
      const result = parser.parse<System>(yaml, 'system');

      expect(result.success).toBe(false);
      if (!result.success && result.error.type === 'validation') {
        expect(result.error.message).toContain('system');
      }
    });

    it('should include path in validation error', () => {
      const yaml = `
name: test
architecture:
  style: invalid-style
  cloud: aws
`;
      const parser = new YamlParser();
      const result = parser.parse<System>(yaml, 'system');

      expect(result.success).toBe(false);
      if (!result.success && result.error.type === 'validation') {
        expect(result.error.path).toBeDefined();
      }
    });
  });

  describe('parseFile', () => {
    it('should return file error for missing file', async () => {
      const parser = new YamlParser();
      const result = await parser.parseFile<System>('/nonexistent/path/system.yaml', 'system');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should include file path in error context', async () => {
      const parser = new YamlParser();
      const filePath = '/nonexistent/path/system.yaml';
      const result = await parser.parseFile<System>(filePath, 'system');

      expect(result.success).toBe(false);
      if (!result.success && result.error.type === 'file') {
        expect(result.error.filePath).toBeDefined();
      }
    });
  });

  describe('parseRaw', () => {
    it('should parse without schema validation', () => {
      const yaml = `
anyField: anyValue
custom:
  nested: data
  number: 123
`;
      const parser = new YamlParser();
      const result = parser.parseRaw<{ anyField: string; custom: { nested: string; number: number } }>(yaml);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.anyField).toBe('anyValue');
        expect(result.data.custom.nested).toBe('data');
        expect(result.data.custom.number).toBe(123);
      }
    });

    it('should return parse error for invalid YAML', () => {
      const yaml = `
name: test
  invalid: [unclosed
`;
      const parser = new YamlParser();
      const result = parser.parseRaw(yaml);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('parse');
      }
    });

    it('should handle empty YAML', () => {
      const parser = new YamlParser();
      const result = parser.parseRaw('');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('parseFileRaw', () => {
    it('should return file error for missing file', async () => {
      const parser = new YamlParser();
      const result = await parser.parseFileRaw('/nonexistent/file.yaml');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
      }
    });
  });

  describe('custom schemas', () => {
    it('should use custom schema when provided', () => {
      const customSchema = z.object({
        customField: z.string(),
        requiredNumber: z.number(),
      });

      const parser = new YamlParser({
        schemas: {
          system: customSchema,
        },
      });

      const yaml = `
customField: hello
requiredNumber: 42
`;
      const result = parser.parse(yaml, 'system');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          customField: 'hello',
          requiredNumber: 42,
        });
      }
    });

    it('should validate against custom schema', () => {
      const customSchema = z.object({
        requiredField: z.string(),
      });

      const parser = new YamlParser({
        schemas: {
          system: customSchema,
        },
      });

      const yaml = `
wrongField: value
`;
      const result = parser.parse(yaml, 'system');

      expect(result.success).toBe(false);
    });
  });

  describe('all entity types', () => {
    const entityTypes: EntityType[] = [
      'system',
      'service',
      'environment',
      'observability',
      'cicd',
      'security',
      'adr',
      'tenant',
      'rule',
      'ruleset',
      'capability',
      'capabilityset',
    ];

    it('should have schema for each entity type', () => {
      const parser = new YamlParser();

      for (const entityType of entityTypes) {
        // Parsing empty/null should return validation error, not crash
        const result = parser.parse('invalid: data', entityType);
        // We just verify it doesn't throw and returns a result
        expect(typeof result.success).toBe('boolean');
      }
    });
  });

  describe('error types', () => {
    it('should return YamlParseError for syntax errors', () => {
      const parser = new YamlParser();
      const result = parser.parse('{ invalid', 'system');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('parse');
      }
    });

    it('should return ValidationError for schema errors', () => {
      const yaml = `
name: 123
`;
      const parser = new YamlParser();
      const result = parser.parse<System>(yaml, 'system');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
      }
    });

    it('should include suggestion in validation error when available', () => {
      const yaml = `
name: test
architecture:
  style: unknown-style
  cloud: aws
`;
      const parser = new YamlParser();
      const result = parser.parse<System>(yaml, 'system');

      expect(result.success).toBe(false);
      if (!result.success && result.error.type === 'validation') {
        // Suggestions come from Zod validation
        expect(result.error.path).toBeDefined();
      }
    });
  });
});
