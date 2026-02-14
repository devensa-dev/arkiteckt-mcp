/**
 * scan_codebase MCP Tool
 *
 * Scans an existing codebase to auto-detect services, dependencies, deployment patterns,
 * CI/CD configuration, and observability tools. Returns structured results for user
 * review and can optionally write them to architecture YAML files.
 *
 * User Story 8: Auto-populate architecture from existing codebase
 */

import { z } from 'zod';
import { resolve } from 'path';
import { CodebaseScanner } from '../../../core/engines/codebase-scanner.js';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import type {
  ScanResult,
  ScanWrittenFiles,
} from '../../../core/schemas/scan-result.schema.js';
import type {
  ToolResponse,
  ResponseMetadata,
  Service,
  Environment,
  CICD,
  Observability,
  System,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const scanCodebaseTool = {
  name: 'scan_codebase',
  config: {
    title: 'Scan Codebase',
    description:
      'Auto-detect services, dependencies, deployment patterns, CI/CD, and observability from an existing codebase. ' +
      'Preview mode (write=false) returns results for review. Commit mode (write=true) writes architecture YAML files.',
    inputSchema: z.object({
      root_path: z
        .string()
        .optional()
        .describe('Project root to scan (defaults to current working directory)'),
      write: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, write detected architecture to YAML files after presenting results'),
    }),
  },
};

/**
 * Input parameters for scan_codebase
 */
export interface ScanCodebaseInput {
  root_path?: string;
  write?: boolean;
}

/**
 * Options for the scanCodebase handler
 */
export interface ScanCodebaseOptions {
  baseDir: string; // Architecture directory (typically baseDir/architecture)
  cwd?: string; // Current working directory for default root_path
}

/**
 * Handler function for scan_codebase tool
 *
 * @param input - Scan parameters
 * @param options - Configuration options
 * @returns ToolResponse with ScanResult
 */
export async function scanCodebase(
  input: ScanCodebaseInput,
  options: ScanCodebaseOptions
): Promise<ToolResponse<ScanResult>> {
  const rootPath = input.root_path
    ? resolve(input.root_path)
    : options.cwd || process.cwd();

  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [`scanned: ${rootPath}`],
  };

  try {
    // Create scanner and run scan
    const scanner = new CodebaseScanner({
      rootPath,
      maxDepth: 5,
    });

    const scanResult = await scanner.scan();

    // If write mode is disabled, return results immediately for preview
    if (!input.write) {
      return {
        success: true,
        data: scanResult,
        metadata,
      };
    }

    // Write mode: persist detected architecture to YAML files
    const store = new ArchitectureStore({ baseDir: options.baseDir });
    const written: ScanWrittenFiles = {
      files: [],
      skipped: [],
      errors: [],
    };

    // Write system config if detected
    if (scanResult.system) {
      try {
        const systemConfig: Partial<System> = {
          name: scanResult.system.name,
        };

        if (scanResult.system.cloud) {
          systemConfig.defaults = {
            cloud: scanResult.system.cloud as any,
            ...(scanResult.system.region && { region: scanResult.system.region }),
          };
        }

        const updateResult = await store.updateSystem(systemConfig);
        if (updateResult.success) {
          written.files.push(`${options.baseDir}/architecture/system.yaml`);
          metadata.sources?.push('architecture/system.yaml');
        } else {
          written.errors.push(`system.yaml: ${updateResult.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        written.errors.push(
          `system.yaml: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Write services
    for (const detectedService of scanResult.services) {
      try {
        const serviceConfig: Partial<Service> = {
          name: detectedService.name,
          ...(detectedService.type && { type: detectedService.type }),
          description: `Auto-detected from ${detectedService.path}`,
        };

        if (detectedService.deploymentPattern) {
          serviceConfig.deployment = {
            pattern: detectedService.deploymentPattern,
          };
        }

        if (detectedService.runtime) {
          serviceConfig.runtime = {
            language: detectedService.runtime.language,
            ...(detectedService.runtime.version && { version: detectedService.runtime.version }),
            ...(detectedService.runtime.framework && { framework: detectedService.runtime.framework }),
          };
        }

        if (detectedService.dependencies && detectedService.dependencies.length > 0) {
          serviceConfig.dependencies = detectedService.dependencies.map((dep) => ({
            name: dep.targetService,
            type: dep.type === 'sync' ? 'sync' : dep.type === 'async' ? 'async' : 'sync',
            ...(dep.protocol && { protocol: dep.protocol }),
          }));
        }

        const createResult = await store.createService(detectedService.name, serviceConfig);
        if (createResult.success) {
          written.files.push(`${options.baseDir}/architecture/services/${detectedService.name}.yaml`);
          metadata.sources?.push(`architecture/services/${detectedService.name}.yaml`);
        } else {
          // If service already exists, skip it
          if (createResult.error?.code === 'ENTITY_EXISTS') {
            written.skipped.push(
              `services/${detectedService.name}.yaml (already exists)`
            );
          } else {
            written.errors.push(
              `services/${detectedService.name}.yaml: ${createResult.error?.message || 'Unknown error'}`
            );
          }
        }
      } catch (error) {
        written.errors.push(
          `services/${detectedService.name}.yaml: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Write CI/CD config if detected
    if (scanResult.cicd) {
      try {
        const cicdConfig: Partial<CICD> = {
          provider: scanResult.cicd.provider,
        };

        if (scanResult.cicd.steps && scanResult.cicd.steps.length > 0) {
          cicdConfig.steps = scanResult.cicd.steps.map((step, index) => ({
            name: step,
            type: 'build', // Default type
            order: index + 1,
          }));
        }

        const setCicdResult = await store.setCICD(cicdConfig);
        if (setCicdResult.success) {
          written.files.push(`${options.baseDir}/architecture/cicd.yaml`);
          metadata.sources?.push('architecture/cicd.yaml');
        } else {
          written.errors.push(`cicd.yaml: ${setCicdResult.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        written.errors.push(
          `cicd.yaml: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Write observability config if detected
    if (scanResult.observability) {
      try {
        const observabilityConfig: Partial<Observability> = {};

        // Map tools to observability configuration
        for (const tool of scanResult.observability.tools) {
          if (tool.toLowerCase().includes('datadog')) {
            observabilityConfig.logging = observabilityConfig.logging || {};
            observabilityConfig.logging.provider = 'datadog';
            observabilityConfig.metrics = observabilityConfig.metrics || {};
            observabilityConfig.metrics.provider = 'datadog';
            observabilityConfig.tracing = observabilityConfig.tracing || {};
            observabilityConfig.tracing.provider = 'datadog';
          } else if (tool.toLowerCase().includes('prometheus')) {
            observabilityConfig.metrics = observabilityConfig.metrics || {};
            observabilityConfig.metrics.provider = 'prometheus';
          } else if (tool.toLowerCase().includes('opentelemetry')) {
            observabilityConfig.tracing = observabilityConfig.tracing || {};
            observabilityConfig.tracing.provider = 'opentelemetry';
          }
        }

        if (Object.keys(observabilityConfig).length > 0) {
          const setObservabilityResult = await store.setObservability(observabilityConfig);
          if (setObservabilityResult.success) {
            written.files.push(`${options.baseDir}/architecture/observability.yaml`);
            metadata.sources?.push('architecture/observability.yaml');
          } else {
            written.errors.push(
              `observability.yaml: ${setObservabilityResult.error?.message || 'Unknown error'}`
            );
          }
        }
      } catch (error) {
        written.errors.push(
          `observability.yaml: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Add written files info to scan result
    const resultWithWritten: ScanResult = {
      ...scanResult,
      written,
    };

    return {
      success: true,
      data: resultWithWritten,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'system',
        code: 'SCAN_FAILED',
        message: error instanceof Error ? error.message : String(error),
      } as const,
      metadata,
    };
  }
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatScanCodebaseResult(response: ToolResponse<ScanResult>) {
  if (response.success && response.data) {
    const { services, cicd, observability, system, scanDuration, warnings, written } = response.data;

    const textParts = [
      `🔍 Codebase scan completed in ${scanDuration}ms`,
      '',
      `📦 Detected ${services.length} service${services.length !== 1 ? 's' : ''}:`,
    ];

    // List services with confidence scores
    for (const service of services) {
      const confidence = (service.confidence * 100).toFixed(0);
      const pattern = service.deploymentPattern || 'unknown';
      textParts.push(
        `  • ${service.name} (${service.type || 'unknown'}, ${pattern}) - ${confidence}% confidence`
      );
    }

    // CI/CD info
    if (cicd) {
      textParts.push('', `⚙️  CI/CD: ${cicd.provider}`);
    }

    // Observability info
    if (observability && observability.tools.length > 0) {
      textParts.push('', `📊 Observability: ${observability.tools.join(', ')}`);
    }

    // System info
    if (system?.name) {
      textParts.push('', `🏗️  System: ${system.name}${system.cloud ? ` (${system.cloud})` : ''}`);
    }

    // Warnings
    if (warnings && warnings.length > 0) {
      textParts.push('', '⚠️  Warnings:');
      for (const warning of warnings) {
        textParts.push(`  • ${warning}`);
      }
    }

    // Written files info (if write mode was enabled)
    if (written) {
      textParts.push('', '📝 Write Results:');
      textParts.push(`  ✅ Written: ${written.files.length} file${written.files.length !== 1 ? 's' : ''}`);
      if (written.skipped.length > 0) {
        textParts.push(`  ⏭️  Skipped: ${written.skipped.length} file${written.skipped.length !== 1 ? 's' : ''}`);
      }
      if (written.errors.length > 0) {
        textParts.push(`  ❌ Errors: ${written.errors.length}`);
        for (const error of written.errors) {
          textParts.push(`     • ${error}`);
        }
      }
    } else {
      textParts.push('', '💡 Preview mode - run with write=true to create architecture files');
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: textParts.join('\n'),
        },
      ],
      structuredContent: {
        success: true,
        data: response.data,
        metadata: response.metadata,
      },
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `❌ Error: ${response.error?.message || 'Unknown error'}`,
      },
    ],
    structuredContent: {
      success: false,
      error: response.error,
      metadata: response.metadata,
    },
    isError: true,
  };
}
