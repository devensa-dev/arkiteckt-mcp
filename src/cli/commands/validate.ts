/**
 * arch validate command
 *
 * Validates architecture configuration files against schemas
 * by calling MCP tools and checking for errors.
 */

import { Command } from 'commander';
import { resolve, join, basename } from 'path';
import { readdir } from 'fs/promises';
import { createMcpClient, callTool } from '../utils/mcp-client.js';

export interface ValidationIssue {
  entity: string;
  error: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  checkedCount: number;
}

/**
 * Core validation logic, exported for testability.
 */
export async function validateArchitecture(baseDir: string): Promise<ValidationResult> {
  const connection = await createMcpClient(baseDir);
  const issues: ValidationIssue[] = [];
  let checkedCount = 0;

  try {
    // Validate system.yaml
    checkedCount++;
    const system = await callTool(connection.client, 'get_system_context', {});
    if (system.isError) {
      issues.push({ entity: 'system.yaml', error: system.errorMessage ?? 'Unknown error' });
    }

    // Discover and validate services
    const serviceFiles = await safeReaddir(join(baseDir, 'architecture', 'services'));
    for (const file of serviceFiles) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const name = basename(file, file.endsWith('.yaml') ? '.yaml' : '.yml');
      checkedCount++;
      const result = await callTool(connection.client, 'get_service_context', { service_name: name });
      if (result.isError) {
        issues.push({ entity: `services/${file}`, error: result.errorMessage ?? 'Unknown error' });
      }
    }

    // Discover and validate environments
    const envFiles = await safeReaddir(join(baseDir, 'architecture', 'environments'));
    for (const file of envFiles) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const name = basename(file, file.endsWith('.yaml') ? '.yaml' : '.yml');
      checkedCount++;
      const result = await callTool(connection.client, 'get_environment_context', { environment_name: name });
      if (result.isError) {
        issues.push({ entity: `environments/${file}`, error: result.errorMessage ?? 'Unknown error' });
      }
    }

    // Validate CI/CD (optional file)
    checkedCount++;
    const ci = await callTool(connection.client, 'get_ci_requirements', {});
    if (ci.isError) {
      if (!ci.errorMessage?.includes('not found')) {
        issues.push({ entity: 'cicd.yaml', error: ci.errorMessage ?? 'Unknown error' });
      } else {
        checkedCount--; // Don't count missing optional files
      }
    }

    // Validate observability (optional file)
    checkedCount++;
    const obs = await callTool(connection.client, 'get_observability_requirements', {});
    if (obs.isError) {
      if (!obs.errorMessage?.includes('not found')) {
        issues.push({ entity: 'observability.yaml', error: obs.errorMessage ?? 'Unknown error' });
      } else {
        checkedCount--; // Don't count missing optional files
      }
    }
  } finally {
    await connection.close();
  }

  return { issues, checkedCount };
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

export const validate = new Command('validate')
  .description('Validate architecture configuration files against schemas')
  .option('--dir <path>', 'Architecture directory', process.cwd())
  .addHelpText('after', `
Examples:
  $ arch validate
  $ arch validate --dir /path/to/project`)
  .action(async (options: { dir: string }) => {
    const baseDir = resolve(options.dir);
    const { issues, checkedCount } = await validateArchitecture(baseDir);

    if (issues.length === 0) {
      console.log(`Validation passed: ${checkedCount} file(s) checked, no issues found.`);
    } else {
      console.error(`Validation failed: ${issues.length} issue(s) found in ${checkedCount} file(s):\n`);
      for (const issue of issues) {
        console.error(`  ${issue.entity}: ${issue.error}`);
      }
      process.exit(1);
    }
  });
