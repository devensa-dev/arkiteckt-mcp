/**
 * CLI Output Formatters
 *
 * Formats tool response data for CLI display in JSON, YAML, or table format.
 */

import { stringify } from 'yaml';

export type OutputFormat = 'json' | 'yaml' | 'table';

/**
 * Format data for CLI output.
 */
export function formatOutput(data: unknown, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return stringify(data, { indent: 2, lineWidth: 120 });
    case 'table':
      return formatTable(data);
  }
}

function formatTable(data: unknown): string {
  if (Array.isArray(data)) {
    return formatArrayTable(data);
  }

  if (typeof data === 'object' && data !== null) {
    return formatKeyValueTable(data as Record<string, unknown>);
  }

  return String(data);
}

function formatKeyValueTable(obj: Record<string, unknown>): string {
  const rows: Array<[string, string]> = [];
  flattenObject(obj, '', rows);

  if (rows.length === 0) return '(empty)';

  const maxKeyLen = Math.max(...rows.map(([k]) => k.length));

  return rows
    .map(([key, value]) => `  ${key.padEnd(maxKeyLen)}  ${value}`)
    .join('\n');
}

function formatArrayTable(arr: unknown[]): string {
  if (arr.length === 0) return '(empty)';

  // If array of objects, format as columnar table
  if (typeof arr[0] === 'object' && arr[0] !== null) {
    const objects = arr as Record<string, unknown>[];
    const keys = [...new Set(objects.flatMap((o) => Object.keys(o)))];

    const widths = keys.map((key) =>
      Math.max(key.length, ...objects.map((o) => String(o[key] ?? '').length))
    );

    const header = keys.map((key, i) => key.padEnd(widths[i] as number)).join('  ');
    const separator = widths.map((w) => '-'.repeat(w as number)).join('  ');
    const dataRows = objects.map((obj) =>
      keys.map((key, i) => String(obj[key] ?? '').padEnd(widths[i] as number)).join('  ')
    );

    return [header, separator, ...dataRows].join('\n');
  }

  // Simple array of primitives
  return arr.map((item) => `  - ${String(item)}`).join('\n');
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix: string,
  rows: Array<[string, string]>
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      flattenObject(value as Record<string, unknown>, fullKey, rows);
    } else if (Array.isArray(value)) {
      rows.push([fullKey, value.map(String).join(', ')]);
    } else {
      rows.push([fullKey, String(value ?? '')]);
    }
  }
}
