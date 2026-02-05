import { describe, it, expect } from 'vitest';
import type {
  Result,
  YamlParseError,
  ValidationError,
  FileError,
  ArchitectureError,
  FormattedError,
  ValidationResult,
  DeepPartial,
  CacheEntry,
  ResolutionContext,
  ToolResponse,
  System,
  Service,
  Environment,
} from '../../../src/shared/types/index.js';

describe('Shared Types', () => {
  describe('Result type', () => {
    it('should discriminate success case', () => {
      const success: Result<number> = { success: true, data: 42 };

      expect(success.success).toBe(true);
      expect(success.data).toBe(42);
    });

    it('should discriminate failure case', () => {
      const failure: Result<number, string> = { success: false, error: 'error message' };

      expect(failure.success).toBe(false);
      expect(failure.error).toBe('error message');
    });
  });

  describe('Error types', () => {
    it('should create YamlParseError', () => {
      const error: YamlParseError = {
        type: 'parse',
        message: 'Invalid YAML',
        line: 10,
        column: 5,
      };

      expect(error.type).toBe('parse');
      expect(error.line).toBe(10);
    });

    it('should create ValidationError', () => {
      const error: ValidationError = {
        type: 'validation',
        message: 'Invalid value',
        path: 'config.port',
        expected: 'number',
      };

      expect(error.type).toBe('validation');
      expect(error.path).toBe('config.port');
    });

    it('should create FileError', () => {
      const error: FileError = {
        type: 'file',
        message: 'File not found',
        filePath: '/path/to/file.yaml',
        code: 'ENOENT',
      };

      expect(error.type).toBe('file');
      expect(error.code).toBe('ENOENT');
    });

    it('should discriminate ArchitectureError union', () => {
      const errors: ArchitectureError[] = [
        { type: 'parse', message: 'parse error' },
        { type: 'validation', message: 'validation error', path: 'a.b' },
        { type: 'file', message: 'file error', filePath: '/path' },
      ];

      errors.forEach((error) => {
        switch (error.type) {
          case 'parse':
            expect(error.message).toContain('parse');
            break;
          case 'validation':
            expect(error.path).toBeDefined();
            break;
          case 'file':
            expect(error.filePath).toBeDefined();
            break;
        }
      });
    });
  });

  describe('FormattedError type', () => {
    it('should create FormattedError with required fields', () => {
      const error: FormattedError = {
        path: 'config.name',
        message: 'Name is required',
      };

      expect(error.path).toBe('config.name');
    });

    it('should create FormattedError with optional fields', () => {
      const error: FormattedError = {
        path: 'config.port',
        message: 'Invalid port',
        expected: 'number',
        received: 'string',
        suggestion: 'Use a number like 8080',
      };

      expect(error.suggestion).toContain('8080');
    });
  });

  describe('ValidationResult type', () => {
    it('should create valid result', () => {
      const result: ValidationResult<{ name: string }> = {
        valid: true,
        data: { name: 'test' },
      };

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data?.name).toBe('test');
      }
    });

    it('should create invalid result', () => {
      const result: ValidationResult = {
        valid: false,
        errors: [{ path: 'name', message: 'required' }],
      };

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors?.[0].message).toBe('required');
      }
    });
  });

  describe('DeepPartial type', () => {
    it('should make nested properties optional', () => {
      interface Config {
        server: {
          host: string;
          port: number;
        };
        database: {
          url: string;
        };
      }

      const partial: DeepPartial<Config> = {
        server: {
          port: 8080,
        },
      };

      expect(partial.server?.port).toBe(8080);
      expect(partial.server?.host).toBeUndefined();
      expect(partial.database).toBeUndefined();
    });
  });

  describe('CacheEntry type', () => {
    it('should create cache entry', () => {
      const entry: CacheEntry<string> = {
        data: 'cached value',
        timestamp: Date.now(),
        ttl: 60000,
      };

      expect(entry.data).toBe('cached value');
      expect(entry.ttl).toBe(60000);
    });
  });

  describe('ResolutionContext type', () => {
    it('should create resolution context', () => {
      const context: ResolutionContext = {
        service: 'order-service',
        environment: 'prod',
        tenant: 'acme',
      };

      expect(context.service).toBe('order-service');
    });

    it('should allow partial context', () => {
      const context: ResolutionContext = {
        environment: 'dev',
      };

      expect(context.environment).toBe('dev');
      expect(context.service).toBeUndefined();
    });
  });

  describe('ToolResponse type', () => {
    it('should create success response', () => {
      const response: ToolResponse<{ name: string }> = {
        success: true,
        data: { name: 'test' },
        metadata: {
          cached: false,
          resolvedAt: new Date().toISOString(),
        },
      };

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('test');
    });

    it('should create error response', () => {
      const response: ToolResponse<string> = {
        success: false,
        error: {
          type: 'validation',
          message: 'Invalid input',
          path: 'config',
        },
      };

      expect(response.success).toBe(false);
      expect(response.error?.type).toBe('validation');
    });
  });

  describe('Re-exported schema types', () => {
    it('should have System type available', () => {
      // This is a compile-time check - if it compiles, the type is exported
      const system: Partial<System> = {
        name: 'my-system',
      };
      expect(system.name).toBe('my-system');
    });

    it('should have Service type available', () => {
      const service: Partial<Service> = {
        name: 'my-service',
      };
      expect(service.name).toBe('my-service');
    });

    it('should have Environment type available', () => {
      const env: Partial<Environment> = {
        name: 'production',
      };
      expect(env.name).toBe('production');
    });
  });
});
