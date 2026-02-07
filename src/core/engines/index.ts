/**
 * Core Engines
 *
 * Resolution and merging engines for architecture configuration.
 */

export { ResolutionEngine, type ResolvedServiceContext, type ResolutionError } from './resolution-engine.js';
export {
  deepMerge,
  type DeepMergeOptions,
  type MergeResult,
  type SourceContribution,
} from './deep-merge.js';
export {
  detectServiceDependencyCycle,
  buildDependencyGraph,
  wouldCreateCycle,
  type CycleDetectionResult,
} from './cycle-detector.js';
