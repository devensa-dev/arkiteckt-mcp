/**
 * YAML Parser Service
 *
 * Architecture-specific YAML parsing with schema validation.
 * Wraps shared YAML utilities with entity type awareness and schema registry.
 */

import type { ZodSchema } from 'zod';
import {
  parseYaml,
  parseYamlFile,
  parseAndValidate,
  parseFileAndValidate,
} from '../../shared/utils/yaml.js';
import type {
  Result,
  YamlParseError,
  ValidationError,
  FileError,
  ValidationResult,
} from '../../shared/types/index.js';
import {
  SystemSchema,
  ServiceSchema,
  EnvironmentSchema,
  ObservabilitySchema,
  CICDSchema,
  SecuritySchema,
  ADRSchema,
  TenantSchema,
  RuleSchema,
  RuleSetSchema,
  CapabilitySchema,
  CapabilitySetSchema,
} from '../schemas/index.js';

/**
 * Supported architecture entity types
 */
export type EntityType =
  | 'system'
  | 'service'
  | 'environment'
  | 'observability'
  | 'cicd'
  | 'security'
  | 'adr'
  | 'tenant'
  | 'rule'
  | 'ruleset'
  | 'capability'
  | 'capabilityset';

/**
 * Union of all YAML parser error types
 */
export type YamlParserError = YamlParseError | ValidationError | FileError;

/**
 * YamlParser configuration options
 */
export interface YamlParserOptions {
  schemas?: Partial<Record<EntityType, ZodSchema>>;
}

/**
 * Default schema registry mapping entity types to Zod schemas
 */
const DEFAULT_SCHEMAS: Record<EntityType, ZodSchema> = {
  system: SystemSchema,
  service: ServiceSchema,
  environment: EnvironmentSchema,
  observability: ObservabilitySchema,
  cicd: CICDSchema,
  security: SecuritySchema,
  adr: ADRSchema,
  tenant: TenantSchema,
  rule: RuleSchema,
  ruleset: RuleSetSchema,
  capability: CapabilitySchema,
  capabilityset: CapabilitySetSchema,
};

/**
 * YAML Parser for architecture files
 *
 * Provides type-safe YAML parsing with automatic schema validation
 * based on entity type.
 *
 * @example
 * ```typescript
 * const parser = new YamlParser();
 * const result = await parser.parseFile<System>('architecture/system.yaml', 'system');
 * if (result.success) {
 *   console.log(result.data.name);
 * }
 * ```
 */
export class YamlParser {
  private readonly schemas: Record<EntityType, ZodSchema>;

  constructor(options?: YamlParserOptions) {
    this.schemas = { ...DEFAULT_SCHEMAS, ...options?.schemas };
  }

  /**
   * Parse and validate a YAML string for a specific entity type
   *
   * @param content - YAML string to parse
   * @param entityType - Type of architecture entity
   * @returns Result with validated data or error
   */
  parse<T>(content: string, entityType: EntityType): Result<T, YamlParserError> {
    const schema = this.schemas[entityType];
    const result = parseAndValidate(content, schema);
    return this.toResult<T>(result, entityType);
  }

  /**
   * Parse and validate a YAML file for a specific entity type
   *
   * @param filePath - Path to YAML file
   * @param entityType - Type of architecture entity
   * @returns Result with validated data or error
   */
  async parseFile<T>(
    filePath: string,
    entityType: EntityType
  ): Promise<Result<T, YamlParserError>> {
    const schema = this.schemas[entityType];
    const result = await parseFileAndValidate(filePath, schema);
    return this.toResult<T>(result, entityType, filePath);
  }

  /**
   * Parse YAML without schema validation
   *
   * @param content - YAML string to parse
   * @returns Result with parsed data or parse error
   */
  parseRaw<T>(content: string): Result<T, YamlParseError> {
    return parseYaml<T>(content);
  }

  /**
   * Parse YAML file without schema validation
   *
   * @param filePath - Path to YAML file
   * @returns Result with parsed data or error
   */
  async parseFileRaw<T>(filePath: string): Promise<Result<T, YamlParseError | FileError>> {
    return parseYamlFile<T>(filePath);
  }

  /**
   * Convert ValidationResult to Result type
   */
  private toResult<T>(
    result: ValidationResult,
    entityType: EntityType,
    filePath?: string
  ): Result<T, YamlParserError> {
    if (result.valid && result.data !== undefined) {
      return { success: true, data: result.data as T };
    }

    const error = result.errors?.[0];
    if (!error) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: `Unknown validation error for ${entityType}`,
          path: '(unknown)',
        },
      };
    }

    // Determine error type based on path
    if (error.path === '(file)') {
      return {
        success: false,
        error: {
          type: 'file',
          message: error.message,
          filePath: filePath ?? '(unknown)',
          code: 'ENOENT',
        },
      };
    }

    if (error.path === '(yaml)') {
      const parseError: YamlParseError = {
        type: 'parse',
        message: error.message,
      };
      if (filePath) {
        parseError.filePath = filePath;
      }
      return { success: false, error: parseError };
    }

    // Schema validation error
    const validationError: ValidationError = {
      type: 'validation',
      message: `Invalid ${entityType}: ${error.message}`,
      path: error.path,
    };
    if (error.expected) {
      validationError.expected = error.expected;
    }
    if (error.received !== undefined) {
      validationError.received = error.received;
    }
    if (error.suggestion) {
      validationError.suggestion = error.suggestion;
    }
    return { success: false, error: validationError };
  }
}
