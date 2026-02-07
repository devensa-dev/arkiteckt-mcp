/**
 * arch context commands
 *
 * Query architecture context via MCP protocol.
 * Uses the same MCP API as AI tools (FR-009).
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { createMcpClient, callTool } from '../utils/mcp-client.js';
import { formatOutput, type OutputFormat } from '../utils/formatters.js';

export const context = new Command('context')
  .description('Query architecture context via MCP protocol');

// arch context service <name> [options]
context
  .command('service <name>')
  .description('Get service configuration, optionally resolved for an environment')
  .option('--env <environment>', 'Target environment for resolution (e.g., dev, staging, prod)')
  .option('--tenant <tenant>', 'Tenant for multi-tenant resolution')
  .option('--output <format>', 'Output format: json, yaml, or table', 'json')
  .option('--dir <path>', 'Architecture directory', process.cwd())
  .addHelpText('after', `
Examples:
  $ arch context service user-service
  $ arch context service user-service --env prod
  $ arch context service user-service --env prod --tenant enterprise
  $ arch context service user-service --output yaml`)
  .action(async (name: string, options: {
    env: string | undefined;
    tenant: string | undefined;
    output: string;
    dir: string;
  }) => {
    const baseDir = resolve(options.dir);
    const connection = await createMcpClient(baseDir);

    try {
      const args: Record<string, unknown> = { service_name: name };
      if (options.env !== undefined) args.environment = options.env;
      if (options.tenant !== undefined) args.tenant = options.tenant;

      const result = await callTool(connection.client, 'get_service_context', args);

      if (result.isError) {
        console.error(`Error: ${result.errorMessage}`);
        process.exit(1);
      }

      console.log(formatOutput(result.data, options.output as OutputFormat));
    } finally {
      await connection.close();
    }
  });

// arch context env <name> [options]
context
  .command('env <name>')
  .description('Get environment configuration with availability, scaling, and security settings')
  .option('--tenant <tenant>', 'Tenant for tenant-specific overrides')
  .option('--output <format>', 'Output format: json, yaml, or table', 'json')
  .option('--dir <path>', 'Architecture directory', process.cwd())
  .addHelpText('after', `
Examples:
  $ arch context env dev
  $ arch context env prod --tenant enterprise
  $ arch context env staging --output table`)
  .action(async (name: string, options: {
    tenant: string | undefined;
    output: string;
    dir: string;
  }) => {
    const baseDir = resolve(options.dir);
    const connection = await createMcpClient(baseDir);

    try {
      const args: Record<string, unknown> = { environment_name: name };
      if (options.tenant !== undefined) args.tenant = options.tenant;

      const result = await callTool(connection.client, 'get_environment_context', args);

      if (result.isError) {
        console.error(`Error: ${result.errorMessage}`);
        process.exit(1);
      }

      console.log(formatOutput(result.data, options.output as OutputFormat));
    } finally {
      await connection.close();
    }
  });
