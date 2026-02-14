/**
 * YAML Serializer
 *
 * Thin wrapper around stringifyYaml() providing consistent formatting,
 * directory creation, and file write/delete operations for write tools.
 */

import { mkdir, writeFile, unlink } from 'fs/promises';
import { dirname } from 'path';
import { stringifyYaml } from '../../shared/utils/yaml.js';
import type { Result, FileError } from '../../shared/types/index.js';

/**
 * Serialize data to a YAML string with consistent formatting.
 *
 * @param data - Object to serialize
 * @returns YAML string with 2-space indent, block style, 120 char line width
 */
export function serializeYaml(data: unknown): string {
  return stringifyYaml(data, { indent: 2, lineWidth: 120 });
}

/**
 * Write data as a YAML file, creating parent directories as needed.
 *
 * @param filePath - Absolute path for the output file
 * @param data - Object to serialize and write
 * @returns Result indicating success or FileError
 */
export async function writeYamlFile(
  filePath: string,
  data: unknown
): Promise<Result<void, FileError>> {
  try {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    const yaml = serializeYaml(data);
    await writeFile(filePath, yaml, 'utf-8');

    return { success: true, data: undefined };
  } catch (err) {
    const nodeError = err as NodeJS.ErrnoException;
    const error: FileError = {
      type: 'file',
      message: nodeError.message ?? 'Failed to write YAML file',
      filePath,
    };
    if (nodeError.code !== undefined) {
      error.code = nodeError.code;
    }
    return { success: false, error };
  }
}

/**
 * Delete a YAML file from disk.
 *
 * @param filePath - Absolute path to the file to delete
 * @returns Result indicating success or FileError
 */
export async function deleteYamlFile(
  filePath: string
): Promise<Result<void, FileError>> {
  try {
    await unlink(filePath);
    return { success: true, data: undefined };
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

    const error: FileError = {
      type: 'file',
      message: nodeError.message ?? 'Failed to delete YAML file',
      filePath,
    };
    if (nodeError.code !== undefined) {
      error.code = nodeError.code;
    }
    return { success: false, error };
  }
}
