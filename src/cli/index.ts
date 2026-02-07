#!/usr/bin/env node
/**
 * CLI Entry Point
 *
 * This is the main entry point for the `arch` CLI tool.
 * It uses the same MCP API as AI tools to ensure consistency.
 */

import { Command } from 'commander';
import { init } from './commands/init.js';
import { context } from './commands/context.js';
import { validate } from './commands/validate.js';

export const CLI_VERSION = '0.1.0';

const program = new Command();

program
  .name('arch')
  .description(
    'Architecture MCP CLI - Query and manage architecture configuration.\n\n' +
    'Uses the same MCP protocol as AI tools (Claude Code, etc.) to ensure\n' +
    'consistency between human and AI access to architecture context.'
  )
  .version(CLI_VERSION);

program.addCommand(init);
program.addCommand(context);
program.addCommand(validate);

program.addHelpText('after', `
Examples:
  $ arch init                              Initialize architecture directory
  $ arch init --repair                     Add missing files without overwriting
  $ arch context service user-service      Query service configuration
  $ arch context service api-gw --env prod Query service resolved for production
  $ arch context env staging               Query environment profile
  $ arch context env prod --output yaml    Output in YAML format
  $ arch validate                          Validate all architecture files
`);

program.parse();
