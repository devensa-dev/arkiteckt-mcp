/**
 * Logging Middleware
 *
 * Provides structured logging to stderr for the MCP server.
 * stdout is reserved for the MCP JSON-RPC transport.
 */

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  toolCall(toolName: string, args?: Record<string, unknown>): void;
  toolResult(toolName: string, durationMs: number, isError: boolean): void;
}

/**
 * Creates a logger that writes structured output to stderr.
 */
export function createLogger(prefix = 'arkiteckt-mcp'): Logger {
  const log = (level: string, message: string, data?: Record<string, unknown>) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      prefix,
      message,
      ...data,
    };
    process.stderr.write(JSON.stringify(entry) + '\n');
  };

  return {
    info(message: string, data?: Record<string, unknown>) {
      log('info', message, data);
    },

    error(message: string, data?: Record<string, unknown>) {
      log('error', message, data);
    },

    toolCall(toolName: string, args?: Record<string, unknown>) {
      log('info', `Tool call: ${toolName}`, { tool: toolName, args });
    },

    toolResult(toolName: string, durationMs: number, isError: boolean) {
      log(isError ? 'error' : 'info', `Tool result: ${toolName}`, {
        tool: toolName,
        durationMs,
        isError,
      });
    },
  };
}
