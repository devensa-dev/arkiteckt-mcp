/**
 * Shared Types
 *
 * Common TypeScript types used across the application.
 */

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
