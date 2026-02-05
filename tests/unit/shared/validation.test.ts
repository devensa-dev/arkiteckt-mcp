import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateEntity,
  validateEntities,
  validateRequired,
  validateReference,
  validateReferences,
  combineValidationResults,
  formatValidationErrors,
  formatErrorsForDisplay,
  createErrorSummary,
  VALIDATION_UTILS_VERSION,
} from '../../../src/shared/utils/validation.js';

describe('Validation Utils', () => {
  describe('VALIDATION_UTILS_VERSION', () => {
    it('should export a version string', () => {
      expect(VALIDATION_UTILS_VERSION).toBe('0.1.0');
    });
  });

  describe('validateEntity', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    });

    it('should validate valid data', () => {
      const result = validateEntity({ name: 'John', age: 30 }, testSchema);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({ name: 'John', age: 30 });
      }
    });

    it('should return errors for invalid data', () => {
      const result = validateEntity({ name: '', age: -5 }, testSchema);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should return errors for missing fields', () => {
      const result = validateEntity({ name: 'John' }, testSchema);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors.some((e) => e.path === 'age')).toBe(true);
      }
    });

    it('should return errors for wrong types', () => {
      const result = validateEntity({ name: 123, age: 'thirty' }, testSchema);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors.length).toBe(2);
      }
    });
  });

  describe('validateEntities', () => {
    const testSchema = z.object({
      id: z.string(),
    });

    it('should validate multiple valid entities', () => {
      const entities = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const results = validateEntities(entities, testSchema);

      expect(results.length).toBe(3);
      expect(results.every((r) => r.valid)).toBe(true);
    });

    it('should return errors for invalid entities', () => {
      const entities = [{ id: 'valid' }, { id: 123 }, { other: 'field' }];
      const results = validateEntities(entities, testSchema);

      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should pass when all required fields exist', () => {
      const obj = { name: 'John', email: 'john@example.com' };
      const result = validateRequired(obj, ['name', 'email']);

      expect(result.valid).toBe(true);
    });

    it('should fail when required field is missing', () => {
      const obj = { name: 'John' };
      const result = validateRequired(obj, ['name', 'email']);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors[0].path).toBe('email');
        expect(result.errors[0].message).toContain('missing');
      }
    });

    it('should fail when required field is null', () => {
      const obj = { name: 'John', email: null };
      const result = validateRequired(obj, ['name', 'email']);

      expect(result.valid).toBe(false);
    });

    it('should fail when required string field is empty', () => {
      const obj = { name: '', email: 'john@example.com' };
      const result = validateRequired(obj, ['name', 'email']);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors[0].message).toContain('empty');
      }
    });

    it('should fail when required string field is whitespace only', () => {
      const obj = { name: '   ', email: 'john@example.com' };
      const result = validateRequired(obj, ['name', 'email']);

      expect(result.valid).toBe(false);
    });

    it('should include suggestion in error', () => {
      const obj = {};
      const result = validateRequired(obj, ['name']);

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors[0].suggestion).toContain('name');
      }
    });
  });

  describe('validateReference', () => {
    const validValues = ['dev', 'staging', 'prod'];

    it('should pass for valid reference', () => {
      const result = validateReference('dev', validValues, 'environment');

      expect(result.valid).toBe(true);
    });

    it('should fail for invalid reference', () => {
      const result = validateReference('invalid', validValues, 'environment');

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors[0].path).toBe('environment');
        expect(result.errors[0].received).toBe('invalid');
        expect(result.errors[0].suggestion).toContain('dev');
        expect(result.errors[0].suggestion).toContain('staging');
        expect(result.errors[0].suggestion).toContain('prod');
      }
    });
  });

  describe('validateReferences', () => {
    const validValues = ['a', 'b', 'c'];

    it('should pass for all valid references', () => {
      const result = validateReferences(['a', 'b'], validValues, 'items');

      expect(result.valid).toBe(true);
    });

    it('should fail for invalid references', () => {
      const result = validateReferences(['a', 'x', 'y'], validValues, 'items');

      expect(result.valid).toBe(false);
      if (!result.valid && result.errors) {
        expect(result.errors.length).toBe(2);
        expect(result.errors.some((e) => e.received === 'x')).toBe(true);
        expect(result.errors.some((e) => e.received === 'y')).toBe(true);
      }
    });

    it('should pass for empty array', () => {
      const result = validateReferences([], validValues, 'items');

      expect(result.valid).toBe(true);
    });
  });

  describe('combineValidationResults', () => {
    it('should return valid when all results are valid', () => {
      const results = [{ valid: true }, { valid: true }, { valid: true }];
      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(true);
    });

    it('should return invalid when any result is invalid', () => {
      const results = [
        { valid: true },
        { valid: false, errors: [{ path: 'a', message: 'error' }] },
        { valid: true },
      ];
      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(false);
    });

    it('should combine all errors', () => {
      const results = [
        { valid: false, errors: [{ path: 'a', message: 'error 1' }] },
        { valid: false, errors: [{ path: 'b', message: 'error 2' }] },
      ];
      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(false);
      if (!combined.valid && combined.errors) {
        expect(combined.errors.length).toBe(2);
      }
    });

    it('should handle empty results array', () => {
      const combined = combineValidationResults([]);

      expect(combined.valid).toBe(true);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format Zod errors', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = schema.safeParse({ name: 123, age: 'not a number' });

      if (!result.success) {
        const formatted = formatValidationErrors(result.error);

        expect(formatted.length).toBe(2);
        expect(formatted.some((e) => e.path === 'name')).toBe(true);
        expect(formatted.some((e) => e.path === 'age')).toBe(true);
      }
    });

    it('should include expected type in error', () => {
      const schema = z.object({
        count: z.number(),
      });

      const result = schema.safeParse({ count: 'not a number' });

      if (!result.success) {
        const formatted = formatValidationErrors(result.error);

        expect(formatted[0].expected).toBeDefined();
      }
    });
  });

  describe('formatErrorsForDisplay', () => {
    it('should format errors as a string', () => {
      const errors = [
        { path: 'name', message: 'Required' },
        { path: 'age', message: 'Must be positive', suggestion: 'Use a positive number' },
      ];

      const output = formatErrorsForDisplay(errors);

      expect(output).toContain('name');
      expect(output).toContain('Required');
      expect(output).toContain('age');
      expect(output).toContain('Must be positive');
      expect(output).toContain('Suggestion');
    });

    it('should include expected and received values', () => {
      const errors = [{ path: 'type', message: 'Invalid', expected: 'string', received: 'number' }];

      const output = formatErrorsForDisplay(errors);

      expect(output).toContain('Expected: string');
      expect(output).toContain('Received: number');
    });
  });

  describe('createErrorSummary', () => {
    it('should create a summary with error count', () => {
      const errors = [
        { path: 'a', message: 'error 1' },
        { path: 'b', message: 'error 2' },
      ];

      const summary = createErrorSummary('MyEntity', errors);

      expect(summary).toContain('MyEntity');
      expect(summary).toContain('2 errors');
    });

    it('should use singular for one error', () => {
      const errors = [{ path: 'a', message: 'error 1' }];

      const summary = createErrorSummary('MyEntity', errors);

      expect(summary).toContain('1 error');
      expect(summary).not.toContain('1 errors');
    });
  });
});
