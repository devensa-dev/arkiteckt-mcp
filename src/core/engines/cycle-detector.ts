/**
 * Cycle Detector
 *
 * Detects circular dependencies in service dependency graphs.
 * Uses depth-first search (DFS) with coloring algorithm for O(V+E) detection.
 */

import type { ArchitectureStore } from '../store/architecture-store.js';

/**
 * Result of cycle detection
 */
export interface CycleDetectionResult {
  /** Whether a cycle was detected */
  hasCycle: boolean;
  /** The cycle path if found (e.g., ['A', 'B', 'C', 'A']) */
  cycle?: string[];
  /** Human-readable error message */
  message?: string;
}

/**
 * Node colors for DFS algorithm
 */
enum NodeColor {
  WHITE = 0, // Not visited
  GRAY = 1, // Currently visiting (in current path)
  BLACK = 2, // Fully processed
}

/**
 * Detect circular dependencies in service graph
 *
 * Uses DFS with coloring:
 * - WHITE: Not visited yet
 * - GRAY: Currently visiting (in current DFS path)
 * - BLACK: Fully processed
 *
 * If we encounter a GRAY node during traversal, we've found a cycle.
 *
 * @param startService - Service name to check for cycles
 * @param dependencies - Adjacency list: service -> array of dependencies
 * @returns Cycle detection result
 */
export function detectServiceDependencyCycle(
  startService: string,
  dependencies: Map<string, string[]>
): CycleDetectionResult {
  const colors = new Map<string, NodeColor>();
  const parent = new Map<string, string>();

  // Initialize all nodes as WHITE
  for (const service of dependencies.keys()) {
    colors.set(service, NodeColor.WHITE);
  }

  /**
   * DFS traversal to detect cycles
   */
  function dfs(node: string, path: string[]): CycleDetectionResult {
    colors.set(node, NodeColor.GRAY);
    const currentPath = [...path, node];

    const deps = dependencies.get(node) ?? [];
    for (const neighbor of deps) {
      const neighborColor = colors.get(neighbor) ?? NodeColor.WHITE;

      if (neighborColor === NodeColor.GRAY) {
        // Found a cycle! Reconstruct the cycle path
        const cycleStart = currentPath.indexOf(neighbor);
        const cycle = [...currentPath.slice(cycleStart), neighbor];

        return {
          hasCycle: true,
          cycle,
          message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        };
      }

      if (neighborColor === NodeColor.WHITE) {
        parent.set(neighbor, node);
        const result = dfs(neighbor, currentPath);
        if (result.hasCycle) {
          return result;
        }
      }
    }

    colors.set(node, NodeColor.BLACK);
    return { hasCycle: false };
  }

  return dfs(startService, []);
}

/**
 * Build dependency graph from architecture store
 *
 * Reads all services and constructs an adjacency list of dependencies.
 *
 * @param store - Architecture store
 * @returns Map of service name to array of dependency names
 */
export async function buildDependencyGraph(
  store: ArchitectureStore
): Promise<Map<string, string[]>> {
  const servicesResult = await store.getServices();

  if (!servicesResult.success) {
    return new Map();
  }

  const graph = new Map<string, string[]>();

  for (const service of servicesResult.data) {
    const deps = service.dependencies?.map((d) => d.name) ?? [];
    graph.set(service.name, deps);
  }

  return graph;
}

/**
 * Check if adding a dependency would create a cycle
 *
 * This is useful for validating new service configurations before they're committed.
 *
 * @param fromService - Service that would have the new dependency
 * @param toService - Service being depended on
 * @param existingGraph - Current dependency graph
 * @returns Cycle detection result
 */
export function wouldCreateCycle(
  fromService: string,
  toService: string,
  existingGraph: Map<string, string[]>
): CycleDetectionResult {
  // Create a copy of the graph with the new dependency
  const testGraph = new Map(existingGraph);
  const existingDeps = testGraph.get(fromService) ?? [];
  testGraph.set(fromService, [...existingDeps, toService]);

  return detectServiceDependencyCycle(fromService, testGraph);
}
