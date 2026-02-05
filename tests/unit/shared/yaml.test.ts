import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  parseYaml,
  parseYamlFile,
  parseAndValidate,
  parseFileAndValidate,
  stringifyYaml,
  YAML_UTILS_VERSION,
} from '../../../src/shared/utils/yaml.js';

describe('YAML Utils', () => {
  describe('YAML_UTILS_VERSION', () => {
    it('should export a version string', () => {
      expect(YAML_UTILS_VERSION).toBe('0.1.0');
    });
  });

  describe('parseYaml', () => {
    it('should parse valid YAML', () => {
      const yaml = `
name: test
value: 123
nested:
  key: value
`;
      const result = parseYaml(yaml);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          name: 'test',
          value: 123,
          nested: { key: 'value' },
        });
      }
    });

    it('should parse YAML with arrays', () => {
      const yaml = `
items:
  - one
  - two
  - three
`;
      const result = parseYaml(yaml);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          items: ['one', 'two', 'three'],
        });
      }
    });

    it('should return error for invalid YAML syntax', () => {
      const yaml = `
name: test
  invalid: indentation
`;
      const result = parseYaml(yaml);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('parse');
        // Error message varies by parser, just check it's not empty
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    });

    it('should include line number in error', () => {
      const yaml = `line1: ok
line2: ok
line3: [invalid`;

      const result = parseYaml(yaml);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.line).toBeDefined();
      }
    });

    it('should include snippet in error', () => {
      const yaml = `line1: ok
line2: ok
line3: [invalid`;

      const result = parseYaml(yaml);

      expect(result.success).toBe(false);
      if (!result.success && result.error.snippet) {
        expect(result.error.snippet).toContain('>>>');
      }
    });

    it('should handle empty YAML', () => {
      const result = parseYaml('');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('should parse YAML with type annotation', () => {
      interface Config {
        name: string;
        port: number;
      }

      const yaml = `
name: server
port: 8080
`;
      const result = parseYaml<Config>(yaml);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('server');
        expect(result.data.port).toBe(8080);
      }
    });
  });

  describe('parseYamlFile', () => {
    it('should return file not found error for missing file', async () => {
      const result = await parseYamlFile('/nonexistent/path/file.yaml');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('file');
        expect(result.error.message).toContain('File not found');
        if ('filePath' in result.error) {
          expect(result.error.filePath).toBe('/nonexistent/path/file.yaml');
        }
      }
    });
  });

  describe('parseAndValidate', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      port: z.number().int().positive(),
    });

    it('should parse and validate valid YAML', () => {
      const yaml = `
name: server
port: 8080
`;
      const result = parseAndValidate(yaml, testSchema);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({ name: 'server', port: 8080 });
      }
    });

    it('should return parse error for invalid YAML', () => {
      const yaml = `
name: server
port: [invalid
`;
      const result = parseAndValidate(yaml, testSchema);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors[0].path).toBe('(yaml)');
      }
    });

    it('should return validation errors for schema mismatch', () => {
      const yaml = `
name: ""
port: -1
`;
      const result = parseAndValidate(yaml, testSchema);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should return error for missing required fields', () => {
      const yaml = `
name: server
`;
      const result = parseAndValidate(yaml, testSchema);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors.some((e) => e.path === 'port')).toBe(true);
      }
    });
  });

  describe('parseFileAndValidate', () => {
    const testSchema = z.object({
      name: z.string(),
    });

    it('should return error for missing file', async () => {
      const result = await parseFileAndValidate('/nonexistent/file.yaml', testSchema);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors[0].path).toBe('(file)');
        expect(result.errors[0].suggestion).toContain('exists');
      }
    });
  });

  describe('stringifyYaml', () => {
    it('should convert object to YAML string', () => {
      const data = { name: 'test', value: 123 };
      const yaml = stringifyYaml(data);

      expect(yaml).toContain('name: test');
      expect(yaml).toContain('value: 123');
    });

    it('should handle nested objects', () => {
      const data = {
        outer: {
          inner: {
            value: 'deep',
          },
        },
      };
      const yaml = stringifyYaml(data);

      expect(yaml).toContain('outer:');
      expect(yaml).toContain('inner:');
      expect(yaml).toContain('value: deep');
    });

    it('should handle arrays', () => {
      const data = { items: ['a', 'b', 'c'] };
      const yaml = stringifyYaml(data);

      expect(yaml).toContain('items:');
      expect(yaml).toContain('- a');
      expect(yaml).toContain('- b');
      expect(yaml).toContain('- c');
    });

    it('should use custom indent', () => {
      const data = { outer: { inner: 'value' } };
      const yaml = stringifyYaml(data, { indent: 4 });

      // With 4-space indent, inner should be indented more
      expect(yaml).toContain('    inner');
    });

    it('should roundtrip parse/stringify', () => {
      const original = {
        name: 'test',
        count: 42,
        items: ['one', 'two'],
        nested: { key: 'value' },
      };

      const yaml = stringifyYaml(original);
      const result = parseYaml(yaml);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(original);
      }
    });
  });
});
