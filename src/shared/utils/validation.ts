/**
 * Validation Utilities
 *
 * Common validation functions for architecture entities.
 * Provides user-friendly error messages with actionable guidance (FR-006).
 */

import type { ZodSchema, ZodError, ZodIssue } from 'zod';
import type { FormattedError, ValidationResult } from '../types/index.js';

export const VALIDATION_UTILS_VERSION = '0.1.0';

/**
 * Generate a suggestion based on the Zod issue type
 * Note: Zod v4 uses different issue codes than v3
 */
function generateSuggestion(issue: ZodIssue): string | undefined {
  // Use string comparison for issue codes to handle Zod v4 differences
  const code = issue.code as string;

  switch (code) {
    case 'invalid_type': {
      const typeIssue = issue as ZodIssue & { expected?: unknown };
      return `Expected ${String(typeIssue.expected)}`;
    }

    case 'invalid_value': {
      // Zod v4: enum validation errors
      const valueIssue = issue as ZodIssue & { values?: unknown[] };
      if (valueIssue.values && Array.isArray(valueIssue.values)) {
        const options = valueIssue.values.map((o) => `'${String(o)}'`).join(', ');
        return `Valid values: ${options}`;
      }
      return undefined;
    }

    case 'too_small': {
      const sizeIssue = issue as ZodIssue & { minimum?: number; origin?: string };
      const origin = sizeIssue.origin ?? 'value';
      if (origin === 'string') {
        return `Minimum length is ${String(sizeIssue.minimum)} characters`;
      }
      if (origin === 'number') {
        return `Minimum value is ${String(sizeIssue.minimum)}`;
      }
      if (origin === 'array') {
        return `Minimum ${String(sizeIssue.minimum)} items required`;
      }
      return undefined;
    }

    case 'too_big': {
      const sizeIssue = issue as ZodIssue & { maximum?: number; origin?: string };
      const origin = sizeIssue.origin ?? 'value';
      if (origin === 'string') {
        return `Maximum length is ${String(sizeIssue.maximum)} characters`;
      }
      if (origin === 'number') {
        return `Maximum value is ${String(sizeIssue.maximum)}`;
      }
      if (origin === 'array') {
        return `Maximum ${String(sizeIssue.maximum)} items allowed`;
      }
      return undefined;
    }

    case 'invalid_format': {
      // Zod v4: string format validation errors
      const formatIssue = issue as ZodIssue & { format?: string };
      if (formatIssue.format === 'email') {
        return 'Must be a valid email address (e.g., user@example.com)';
      }
      if (formatIssue.format === 'url') {
        return 'Must be a valid URL (e.g., https://example.com)';
      }
      if (formatIssue.format === 'uuid') {
        return 'Must be a valid UUID';
      }
      return undefined;
    }

    case 'unrecognized_keys': {
      const keysIssue = issue as ZodIssue & { keys?: string[] };
      if (keysIssue.keys && keysIssue.keys.length > 0) {
        return `Remove unexpected fields: ${keysIssue.keys.join(', ')}`;
      }
      return undefined;
    }

    case 'invalid_union':
      return 'Value does not match any of the expected types';

    default:
      return undefined;
  }
}

/**
 * Format Zod errors into user-friendly FormattedError array
 */
export function formatValidationErrors(error: ZodError): FormattedError[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';
    const issueAny = issue as unknown as Record<string, unknown>;

    const result: FormattedError = {
      path,
      message: issue.message,
    };

    if ('expected' in issueAny && issueAny.expected !== undefined) {
      result.expected = String(issueAny.expected);
    }
    if ('received' in issueAny && issueAny.received !== undefined) {
      result.received = String(issueAny.received);
    }

    const suggestion = generateSuggestion(issue);
    if (suggestion) {
      result.suggestion = suggestion;
    }

    return result;
  });
}

/**
 * Validate data against a Zod schema
 *
 * @param data - Data to validate
 * @param schema - Zod schema to validate against
 * @returns ValidationResult with validated data or formatted errors
 */
export function validateEntity<T>(
  data: unknown,
  schema: ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      valid: true,
      data: result.data,
    };
  }

  return {
    valid: false,
    errors: formatValidationErrors(result.error),
  };
}

/**
 * Validate multiple entities against a schema
 *
 * @param entities - Array of entities to validate
 * @param schema - Zod schema to validate against
 * @returns Array of ValidationResults
 */
export function validateEntities<T>(
  entities: unknown[],
  schema: ZodSchema<T>
): ValidationResult<T>[] {
  return entities.map((entity) => validateEntity(entity, schema));
}

/**
 * Check that required fields exist and are non-empty
 *
 * @param obj - Object to check
 * @param fields - Array of required field names
 * @returns ValidationResult indicating if all required fields are present
 */
export function validateRequired(
  obj: Record<string, unknown>,
  fields: string[]
): ValidationResult {
  const errors: FormattedError[] = [];

  for (const field of fields) {
    const value = obj[field];

    if (value === undefined || value === null) {
      errors.push({
        path: field,
        message: `Required field '${field}' is missing`,
        suggestion: `Add the '${field}' field to your configuration`,
      });
    } else if (typeof value === 'string' && value.trim() === '') {
      errors.push({
        path: field,
        message: `Required field '${field}' cannot be empty`,
        suggestion: `Provide a value for '${field}'`,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}

/**
 * Validate that a value is one of the allowed values
 *
 * @param value - Value to check
 * @param validValues - Array of allowed values
 * @param fieldName - Name of the field (for error messages)
 * @returns ValidationResult
 */
export function validateReference(
  value: string,
  validValues: string[],
  fieldName: string
): ValidationResult {
  if (validValues.includes(value)) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: [
      {
        path: fieldName,
        message: `Invalid reference '${value}'`,
        received: value,
        suggestion: `Valid values: ${validValues.map((v) => `'${v}'`).join(', ')}`,
      },
    ],
  };
}

/**
 * Validate multiple references against allowed values
 *
 * @param values - Values to check
 * @param validValues - Array of allowed values
 * @param fieldName - Name of the field (for error messages)
 * @returns ValidationResult
 */
export function validateReferences(
  values: string[],
  validValues: string[],
  fieldName: string
): ValidationResult {
  const invalidValues = values.filter((v) => !validValues.includes(v));

  if (invalidValues.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: invalidValues.map((value) => ({
      path: fieldName,
      message: `Invalid reference '${value}'`,
      received: value,
      suggestion: `Valid values: ${validValues.map((v) => `'${v}'`).join(', ')}`,
    })),
  };
}

/**
 * Combine multiple validation results into one
 *
 * @param results - Array of ValidationResults to combine
 * @returns Combined ValidationResult
 */
export function combineValidationResults<T>(
  results: ValidationResult<T>[]
): ValidationResult<T> {
  const allErrors: FormattedError[] = [];
  let allValid = true;

  for (const result of results) {
    if (!result.valid) {
      allValid = false;
      if (result.errors) {
        allErrors.push(...result.errors);
      }
    }
  }

  if (allErrors.length > 0) {
    return { valid: allValid, errors: allErrors };
  }
  return { valid: allValid };
}

/**
 * Format validation errors for CLI display
 *
 * @param errors - Array of FormattedErrors
 * @returns Formatted string for CLI output
 */
export function formatErrorsForDisplay(errors: FormattedError[]): string {
  return errors
    .map((err) => {
      const lines = [`  - ${err.path}: ${err.message}`];

      if (err.expected) {
        lines.push(`    Expected: ${err.expected}`);
      }
      if (err.received) {
        lines.push(`    Received: ${err.received}`);
      }
      if (err.suggestion) {
        lines.push(`    Suggestion: ${err.suggestion}`);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * Create a validation error summary
 *
 * @param entityName - Name of the entity being validated
 * @param errors - Array of FormattedErrors
 * @returns Summary string
 */
export function createErrorSummary(
  entityName: string,
  errors: FormattedError[]
): string {
  const errorCount = errors.length;
  const plural = errorCount === 1 ? 'error' : 'errors';

  return `Validation failed for '${entityName}' with ${errorCount} ${plural}:\n\n${formatErrorsForDisplay(errors)}`;
}
