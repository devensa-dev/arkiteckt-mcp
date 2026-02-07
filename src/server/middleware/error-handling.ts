/**
 * Error Handling Middleware
 *
 * Wraps tool handlers in try/catch to prevent server crashes
 * from unexpected errors, returning proper MCP error responses.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Logger } from './logging.js';

/**
 * Wraps a tool handler function with error handling.
 * Catches unhandled exceptions and returns a proper MCP error response
 * instead of crashing the server.
 */
export function withErrorHandling<TArgs>(
  toolName: string,
  handler: (args: TArgs) => Promise<CallToolResult>,
  logger: Logger
): (args: TArgs) => Promise<CallToolResult> {
  return async (args: TArgs): Promise<CallToolResult> => {
    const start = Date.now();
    try {
      logger.toolCall(toolName, args as Record<string, unknown>);
      const result = await handler(args);
      logger.toolResult(toolName, Date.now() - start, !!result.isError);
      return result;
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Unhandled error in tool ${toolName}: ${message}`, {
        tool: toolName,
        durationMs,
        stack: error instanceof Error ? error.stack : undefined,
      });
      logger.toolResult(toolName, durationMs, true);

      return {
        content: [
          {
            type: 'text',
            text: `Internal error in ${toolName}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  };
}
