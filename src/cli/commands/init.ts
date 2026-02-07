/**
 * arch init command
 *
 * Initializes a new architecture repository with canonical directory structure.
 * User Story 3: Architecture Store Initialization (Priority: P1)
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { ArchitectureStore } from '../../core/store/architecture-store.js';

export const init = new Command('init')
  .description('Initialize architecture directory structure with templates')
  .option('--repair', 'Add missing files/directories without overwriting existing ones')
  .option('--dir <path>', 'Target directory (defaults to current directory)', process.cwd())
  .action(async (options: { repair?: boolean; dir: string }) => {
    const baseDir = resolve(options.dir);
    const store = new ArchitectureStore({ baseDir });

    const result = await store.init(options.repair ? { repair: true } : undefined);

    if (result.success) {
      console.log(result.data.message);

      if (result.data.created.length > 0) {
        console.log('\nCreated:');
        for (const path of result.data.created) {
          console.log(`  + ${path}`);
        }
      }

      if (result.data.skipped.length > 0 && options.repair) {
        console.log('\nPreserved:');
        for (const path of result.data.skipped) {
          console.log(`  ~ ${path}`);
        }
      }

      console.log('\nNext steps:');
      console.log('  1. Edit architecture/system.yaml with your system config');
      console.log('  2. Add services in architecture/services/');
      console.log('  3. Add environments in architecture/environments/');
    } else {
      console.error(`Error: ${result.error.message}`);

      if (result.error.type === 'file' && result.error.code === 'EEXIST') {
        console.error('\nUse --repair to add missing files without overwriting.');
      }

      process.exit(1);
    }
  });
