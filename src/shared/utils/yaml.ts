/**
 * YAML Parser Utility
 *
 * Safe YAML parsing with error handling.
 * Provides line-number specific errors for malformed YAML (FR-006).
 */

import { parse, stringify, YAMLParseError } from 'yaml';
import { readFile } from 'fs/promises';
import type { ZodSchema, ZodError } from 'zod';
import type { Result, YamlParseError, FileError, FormattedError, ValidationResult } from '../types/index.js';

export const YAML_UTILS_VERSION = '0.1.0';

/**
 * Extract context snippet around the error location
 */
function getErrorSnippet(content: string, line: number, contextLines = 2): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - contextLines - 1);
  const end = Math.min(lines.length, line + contextLines);

  return lines
    .slice(start, end)
    .map((l, i) => {
      const lineNum = start + i + 1;
      const marker = lineNum === line ? '>>> ' : '    ';
      return `${marker}${lineNum}: ${l}`;
    })
    .join('\n');
}

/**
 * Parse YAML string to object
 *
 * @param content - YAML string to parse
 * @returns Result with parsed object or YamlParseError
 */
export function parseYaml<T = unknown>(content: string): Result<T, YamlParseError> {
  try {
    const data = parse(content) as T;
    return { success: true, data };
  } catch (err) {
    if (err instanceof YAMLParseError) {
      const line = err.linePos?.[0]?.line;
      const column = err.linePos?.[0]?.col;

      const error: YamlParseError = {
        type: 'parse',
        message: err.message,
      };

      if (line !== undefined) {
        error.line = line;
        error.snippet = getErrorSnippet(content, line);
      }
      if (column !== undefined) {
        error.column = column;
      }

      return { success: false, error };
    }

    return {
      success: false,
      error: {
        type: 'parse',
        message: err instanceof Error ? err.message : 'Unknown YAML parse error',
      },
    };
  }
}

/**
 * Parse YAML file from disk
 *
 * @param filePath - Path to YAML file
 * @returns Result with parsed object or error
 */
export async function parseYamlFile<T = unknown>(
  filePath: string
): Promise<Result<T, YamlParseError | FileError>> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const result = parseYaml<T>(content);

    if (!result.success) {
      // Add file path to error context
      const error: YamlParseError = {
        ...result.error,
        filePath,
      };
      return { success: false, error };
    }

    return result;
  } catch (err) {
    const nodeError = err as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return {
        success: false,
        error: {
          type: 'file',
          message: `File not found: ${filePath}`,
          filePath,
          code: 'ENOENT',
        },
      };
    }

    if (nodeError.code === 'EACCES') {
      return {
        success: false,
        error: {
          type: 'file',
          message: `Permission denied: ${filePath}`,
          filePath,
          code: 'EACCES',
        },
      };
    }

    const error: FileError = {
      type: 'file',
      message: err instanceof Error ? err.message : 'Unknown file error',
      filePath,
    };

    if (nodeError.code !== undefined) {
      error.code = nodeError.code;
    }

    return { success: false, error };
  }
}

/**
 * Format Zod errors into user-friendly format
 * Note: Zod v4 uses different issue codes than v3
 */
function formatZodErrors(zodError: ZodError): FormattedError[] {
  return zodError.issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';
    const issueAny = issue as unknown as Record<string, unknown>;
    const code = issue.code as string;

    const result: FormattedError = {
      path,
      message: issue.message,
    };

    // Handle expected/received for applicable issue types
    if ('expected' in issueAny && issueAny.expected !== undefined) {
      result.expected = String(issueAny.expected);
    }
    if ('received' in issueAny && issueAny.received !== undefined) {
      result.received = String(issueAny.received);
    }

    // Generate suggestions based on issue type
    if (code === 'invalid_type' && 'expected' in issueAny) {
      result.suggestion = `Expected ${String(issueAny.expected)}`;
    } else if (code === 'invalid_value') {
      // Zod v4: enum validation errors
      const values = issueAny.values as unknown[] | undefined;
      if (values !== undefined && Array.isArray(values)) {
        result.suggestion = `Valid values: ${values.map((v) => String(v)).join(', ')}`;
      }
    }

    return result;
  });
}

/**
 * Parse YAML and validate against a Zod schema
 *
 * @param content - YAML string to parse
 * @param schema - Zod schema to validate against
 * @returns ValidationResult with validated data or errors
 */
export function parseAndValidate<T>(
  content: string,
  schema: ZodSchema<T>
): ValidationResult<T> {
  // First, parse the YAML
  const parseResult = parseYaml(content);

  if (!parseResult.success) {
    const error: FormattedError = {
      path: '(yaml)',
      message: parseResult.error.message,
      suggestion:
        parseResult.error.line !== undefined
          ? `Check line ${parseResult.error.line}`
          : 'Check YAML syntax',
    };

    return {
      valid: false,
      errors: [error],
    };
  }

  // Then, validate against schema
  const validationResult = schema.safeParse(parseResult.data);

  if (!validationResult.success) {
    return {
      valid: false,
      errors: formatZodErrors(validationResult.error),
    };
  }

  return {
    valid: true,
    data: validationResult.data,
  };
}

/**
 * Parse YAML file and validate against a Zod schema
 *
 * @param filePath - Path to YAML file
 * @param schema - Zod schema to validate against
 * @returns ValidationResult with validated data or errors
 */
export async function parseFileAndValidate<T>(
  filePath: string,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  const parseResult = await parseYamlFile(filePath);

  if (!parseResult.success) {
    const error = parseResult.error;
    const formattedError: FormattedError = {
      path: error.type === 'file' ? '(file)' : '(yaml)',
      message: error.message,
      suggestion:
        error.type === 'file'
          ? 'Check that the file exists and is readable'
          : 'line' in error && error.line
            ? `Check line ${error.line}`
            : 'Check YAML syntax',
    };

    return {
      valid: false,
      errors: [formattedError],
    };
  }

  const validationResult = schema.safeParse(parseResult.data);

  if (!validationResult.success) {
    return {
      valid: false,
      errors: formatZodErrors(validationResult.error),
    };
  }

  return {
    valid: true,
    data: validationResult.data,
  };
}

/**
 * Convert object to YAML string
 *
 * @param data - Object to stringify
 * @param options - YAML stringify options
 * @returns YAML string
 */
export function stringifyYaml(
  data: unknown,
  options?: { indent?: number; lineWidth?: number }
): string {
  return stringify(data, {
    indent: options?.indent ?? 2,
    lineWidth: options?.lineWidth ?? 120,
  });
}
