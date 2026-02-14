/**
 * explain_architecture MCP Tool
 *
 * Provides full architecture context in a single MCP call for efficient agent task planning.
 * Supports two modes: overview (system summary) and service focus (detailed service context).
 *
 * User Story 9: Coding agents can load full architecture context efficiently
 */

import { z } from 'zod';
import { ArchitectureStore } from '../../../core/store/architecture-store.js';
import { ResolutionEngine } from '../../../core/engines/resolution-engine.js';
import { buildDependencyGraph } from '../../../core/engines/cycle-detector.js';
import { expandCapability } from '../../tools/read/get-capability-requirements.js';
import type {
  ToolResponse,
  ResponseMetadata,
  Service,
  ArtifactRequirement,
  ADR,
} from '../../../shared/types/index.js';

/**
 * Tool definition for MCP server registration
 */
export const explainArchitectureTool = {
  name: 'explain_architecture',
  config: {
    title: 'Explain Architecture',
    description:
      'Load full architecture context for efficient task planning. Overview mode returns system summary, service inventory, dependency graph, and tech stack. Service focus mode returns resolved config, dependencies, environment variations, and capability checklist.',
    inputSchema: z.object({
      focus: z
        .enum(['overview', 'services', 'environments', 'deployment', 'security', 'observability'])
        .optional()
        .default('overview')
        .describe('Focus area for the explanation'),
      service_name: z.string().optional().describe('Focus on a specific service (detailed view)'),
    }),
  },
};

/**
 * Input parameters for explain_architecture
 */
export interface ExplainArchitectureInput {
  focus?: 'overview' | 'services' | 'environments' | 'deployment' | 'security' | 'observability';
  service_name?: string;
}

/**
 * Options for the explainArchitecture handler
 */
export interface ExplainArchitectureOptions {
  baseDir: string;
}

/**
 * Overview mode response - complete system summary
 */
export interface OverviewResponse {
  system: {
    name: string;
    style?: string;
    cloud?: string;
    region?: string;
  };
  services: Array<{
    name: string;
    type: string;
    pattern: string;
    dependencyCount: number;
    owner?: string;
  }>;
  environments: Array<{
    name: string;
    tier?: string;
    securityLevel?: string;
  }>;
  dependencyGraph: {
    nodes: string[];
    edges: Array<{
      from: string;
      to: string;
      type?: string;
      protocol?: string;
    }>;
  };
  techStack: {
    languages?: string[];
    frameworks?: string[];
    cloud?: string;
    ciProvider?: string;
    observabilityProviders?: string[];
  };
  statistics: {
    serviceCount: number;
    environmentCount: number;
    totalDependencies: number;
  };
}

/**
 * Service focus mode response - detailed service context
 */
export interface ServiceFocusResponse {
  service: Service;
  dependencies: {
    direct: Service[];
    transitive: Service[];
  };
  environmentVariations: Record<string, Partial<Service>>;
  capabilityChecklist: ArtifactRequirement[];
  relatedADRs: ADR[];
}

/**
 * Compute transitive dependencies using BFS
 */
function computeTransitiveDependencies(
  serviceName: string,
  allServices: Service[]
): string[] {
  const visited = new Set<string>();
  const queue: string[] = [];
  const transitive: string[] = [];

  // Start with direct dependencies
  const service = allServices.find((s) => s.name === serviceName);
  if (!service?.dependencies) {
    return [];
  }

  // Add direct dependencies to queue
  for (const dep of service.dependencies) {
    queue.push(dep.name);
  }

  // BFS to find all transitive dependencies
  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    transitive.push(current);

    // Add this service's dependencies to queue
    const currentService = allServices.find((s) => s.name === current);
    if (currentService?.dependencies) {
      for (const dep of currentService.dependencies) {
        if (!visited.has(dep.name)) {
          queue.push(dep.name);
        }
      }
    }
  }

  return transitive;
}

/**
 * Handler function for explain_architecture tool (overview mode)
 *
 * @param input - Focus area and optional service name
 * @param options - Configuration options including baseDir
 * @returns ToolResponse with architecture overview or service focus
 */
export async function explainArchitecture(
  input: ExplainArchitectureInput,
  options: ExplainArchitectureOptions
): Promise<ToolResponse<OverviewResponse | ServiceFocusResponse>> {
  const store = new ArchitectureStore({ baseDir: options.baseDir });
  const metadata: ResponseMetadata = {
    cached: false,
    resolvedAt: new Date().toISOString(),
    sources: [],
  };

  // Service focus mode
  if (input.service_name) {
    return await handleServiceFocusMode(input.service_name, store, metadata);
  }

  // Overview mode
  return await handleOverviewMode(store, metadata);
}

/**
 * Handle overview mode - return system summary
 */
async function handleOverviewMode(
  store: ArchitectureStore,
  metadata: ResponseMetadata
): Promise<ToolResponse<OverviewResponse>> {
  // Load all required data
  const [systemResult, servicesResult, environmentsResult, cicdResult, observabilityResult] =
    await Promise.all([
      store.getSystem(),
      store.getServices(),
      store.getEnvironments(),
      store.getCICD(),
      store.getObservability(),
    ]);

  if (!systemResult.success) {
    return {
      success: false,
      error: systemResult.error,
      metadata,
    };
  }

  if (!servicesResult.success) {
    return {
      success: false,
      error: servicesResult.error,
      metadata,
    };
  }

  const system = systemResult.data;
  const services = servicesResult.data;
  const environments = environmentsResult.success ? environmentsResult.data : [];

  metadata.sources?.push('architecture/system.yaml');
  metadata.sources?.push('architecture/services/');
  if (environments.length > 0) {
    metadata.sources?.push('architecture/environments/');
  }

  // Build dependency graph
  const depGraph = await buildDependencyGraph(store);
  const edges: Array<{ from: string; to: string; type?: string; protocol?: string }> = [];

  for (const [from, toList] of depGraph.entries()) {
    for (const to of toList) {
      // Find the dependency details
      const service = services.find((s) => s.name === from);
      const dep = service?.dependencies?.find((d) => d.name === to);

      edges.push({
        from,
        to,
        ...(dep?.type && { type: dep.type }),
        ...(dep?.protocol && { protocol: dep.protocol }),
      });
    }
  }

  // Extract tech stack information
  const languages = new Set<string>();
  const frameworks = new Set<string>();

  for (const service of services) {
    if (service.runtime?.language) {
      languages.add(service.runtime.language);
    }
    if (service.runtime?.framework) {
      frameworks.add(service.runtime.framework);
    }
  }

  const observabilityProviders: string[] = [];
  if (observabilityResult.success) {
    if (typeof observabilityResult.data.logging?.provider === 'string') {
      observabilityProviders.push(observabilityResult.data.logging.provider);
    }
    if (typeof observabilityResult.data.metrics?.provider === 'string') {
      observabilityProviders.push(observabilityResult.data.metrics.provider);
    }
    if (typeof observabilityResult.data.tracing?.provider === 'string') {
      observabilityProviders.push(observabilityResult.data.tracing.provider);
    }
  }

  // Build tech stack conditionally
  const techStack: OverviewResponse['techStack'] = {};
  if (languages.size > 0) techStack.languages = Array.from(languages);
  if (frameworks.size > 0) techStack.frameworks = Array.from(frameworks);
  if (typeof system.architecture?.cloud === 'string') techStack.cloud = system.architecture.cloud;
  if (cicdResult.success && typeof cicdResult.data.provider === 'string') techStack.ciProvider = cicdResult.data.provider;
  if (observabilityProviders.length > 0) techStack.observabilityProviders = observabilityProviders;

  // Build system response
  const systemResponse: OverviewResponse['system'] = {
    name: system.name,
  };
  if (typeof system.architecture?.style === 'string') systemResponse.style = system.architecture.style;
  if (typeof system.architecture?.cloud === 'string') systemResponse.cloud = system.architecture.cloud;
  if (typeof system.architecture?.region === 'string') systemResponse.region = system.architecture.region;

  // Build response
  const response: OverviewResponse = {
    system: systemResponse,
    services: services.map((s) => {
      const svc: OverviewResponse['services'][number] = {
        name: s.name,
        type: String(s.type),
        pattern: String(s.deployment?.pattern || 'unknown'),
        dependencyCount: s.dependencies?.length || 0,
      };
      if (s.owner) svc.owner = s.owner;
      return svc;
    }),
    environments: environments.map((e) => {
      const env: OverviewResponse['environments'][number] = {
        name: e.name,
      };
      if (typeof e.tier === 'string') env.tier = e.tier;
      if (typeof e.security?.level === 'string') env.securityLevel = e.security.level;
      return env;
    }),
    dependencyGraph: {
      nodes: services.map((s) => s.name),
      edges,
    },
    techStack,
    statistics: {
      serviceCount: services.length,
      environmentCount: environments.length,
      totalDependencies: edges.length,
    },
  };

  return {
    success: true,
    data: response,
    metadata,
  };
}

/**
 * Handle service focus mode - return detailed service context
 */
async function handleServiceFocusMode(
  serviceName: string,
  store: ArchitectureStore,
  metadata: ResponseMetadata
): Promise<ToolResponse<ServiceFocusResponse>> {
  // Load service and related data
  const [serviceResult, allServicesResult, environmentsResult, capabilitiesResult, adrsResult] =
    await Promise.all([
      store.getService(serviceName),
      store.getServices(),
      store.getEnvironments(),
      store.getCapabilities(),
      store.getADRs(),
    ]);

  if (!serviceResult.success) {
    return {
      success: false,
      error: serviceResult.error,
      metadata,
    };
  }

  if (!allServicesResult.success) {
    return {
      success: false,
      error: allServicesResult.error,
      metadata,
    };
  }

  const service = serviceResult.data;
  const allServices = allServicesResult.data;
  const environments = environmentsResult.success ? environmentsResult.data : [];
  const capabilities = capabilitiesResult.success ? capabilitiesResult.data : [];
  const adrs = adrsResult.success ? adrsResult.data : [];

  metadata.sources?.push(`architecture/services/${serviceName}.yaml`);
  metadata.sources?.push('architecture/services/');

  // Find direct dependencies
  const directDepNames = service.dependencies?.map((d) => d.name) || [];
  const directDeps = allServices.filter((s) => directDepNames.includes(s.name));

  // Find transitive dependencies
  const transitiveDepNames = computeTransitiveDependencies(serviceName, allServices);
  const transitiveDeps = allServices.filter(
    (s) => transitiveDepNames.includes(s.name) && !directDepNames.includes(s.name)
  );

  // Compute environment variations
  const environmentVariations: Record<string, Partial<Service>> = {};

  for (const env of environments) {
    const engine = new ResolutionEngine(store);
    const resolved = await engine.resolveServiceContext(serviceName, env.name);

    if (resolved.success) {
      // Compute the diff between base service and resolved
      const variation: Partial<Service> = {};

      if (resolved.data.service.runtime?.version !== service.runtime?.version) {
        variation.runtime = {
          language: resolved.data.service.runtime?.language || service.runtime?.language || '',
          ...(resolved.data.service.runtime?.version && { version: resolved.data.service.runtime.version }),
        };
      }

      if (resolved.data.service.deployment?.replicas !== service.deployment?.replicas) {
        variation.deployment = {
          pattern: resolved.data.service.deployment?.pattern || service.deployment?.pattern || 'container',
          ...(resolved.data.service.deployment?.replicas && { replicas: resolved.data.service.deployment.replicas }),
        };
      }

      const baseResources = service.resources as { cpu?: string; memory?: string } | undefined;
      const resolvedResources = resolved.data.service.resources as { cpu?: string; memory?: string } | undefined;

      if (
        (typeof resolvedResources?.cpu === 'string' && resolvedResources.cpu !== baseResources?.cpu) ||
        (typeof resolvedResources?.memory === 'string' && resolvedResources.memory !== baseResources?.memory)
      ) {
        const resourceVariation: { cpu?: string; memory?: string } = {};
        if (typeof resolvedResources.cpu === 'string') resourceVariation.cpu = resolvedResources.cpu;
        if (typeof resolvedResources.memory === 'string') resourceVariation.memory = resolvedResources.memory;
        variation.resources = resourceVariation;
      }

      if (Object.keys(variation).length > 0) {
        environmentVariations[env.name] = variation;
      }
    }
  }

  // Get capability checklist
  let capabilityChecklist: ArtifactRequirement[] = [];

  if (service.deployment?.pattern) {
    const createServiceCap = capabilities.find((c) => c.id === 'create_service');
    if (createServiceCap) {
      const expanded = expandCapability(createServiceCap, service.deployment.pattern);
      capabilityChecklist = expanded.artifacts;
      metadata.sources?.push('architecture/capabilities/');
    }
  }

  // Find related ADRs (ADRs that mention this service)
  const relatedADRs = adrs.filter((adr) => {
    // Check if service is mentioned in context or decision
    if (adr.context?.includes(serviceName) || adr.decision?.includes(serviceName)) {
      return true;
    }

    // Check if service is mentioned in consequences
    if (adr.consequences) {
      const allConsequences = [
        ...(adr.consequences.positive || []),
        ...(adr.consequences.negative || []),
        ...(adr.consequences.neutral || []),
      ];
      if (allConsequences.some((c) => c.includes(serviceName))) {
        return true;
      }
    }

    // Check if service is in scope
    if (adr.scope?.services?.includes(serviceName)) {
      return true;
    }

    return false;
  });

  const response: ServiceFocusResponse = {
    service,
    dependencies: {
      direct: directDeps,
      transitive: transitiveDeps,
    },
    environmentVariations,
    capabilityChecklist,
    relatedADRs,
  };

  return {
    success: true,
    data: response,
    metadata,
  };
}

/**
 * MCP tool result formatter
 *
 * Converts ToolResponse to MCP CallToolResult format
 */
export function formatMcpResult(
  response: ToolResponse<OverviewResponse | ServiceFocusResponse>
) {
  if (response.success && response.data) {
    // Detect which mode we're in
    const isOverview = 'system' in response.data;

    if (isOverview) {
      const data = response.data as OverviewResponse;
      const textParts = [
        `# Architecture Overview: ${data.system.name}`,
        '',
        `**Style**: ${data.system.style || 'Not specified'}`,
        `**Cloud**: ${data.system.cloud || 'Not specified'}`,
        `**Region**: ${data.system.region || 'Not specified'}`,
        '',
        `## Services (${data.statistics.serviceCount})`,
        ...data.services.map(
          (s) => `- **${s.name}** (${s.type}) - ${s.pattern} - ${s.dependencyCount} dependencies`
        ),
        '',
        `## Environments (${data.statistics.environmentCount})`,
        ...data.environments.map((e) => `- **${e.name}** (${e.tier || 'unknown tier'})`),
        '',
        `## Tech Stack`,
        `- Languages: ${data.techStack.languages?.join(', ') || 'None detected'}`,
        `- Frameworks: ${data.techStack.frameworks?.join(', ') || 'None detected'}`,
        `- CI Provider: ${data.techStack.ciProvider || 'Not configured'}`,
        '',
        `## Statistics`,
        `- Total Services: ${data.statistics.serviceCount}`,
        `- Total Environments: ${data.statistics.environmentCount}`,
        `- Total Dependencies: ${data.statistics.totalDependencies}`,
      ];

      return {
        content: [
          {
            type: 'text' as const,
            text: textParts.join('\n'),
          },
        ],
        structuredContent: {
          success: true,
          data: response.data,
          metadata: response.metadata,
        },
      };
    } else {
      const data = response.data as ServiceFocusResponse;
      const textParts = [
        `# Service: ${data.service.name}`,
        '',
        `**Type**: ${data.service.type}`,
        `**Pattern**: ${data.service.deployment?.pattern || 'unknown'}`,
        `**Owner**: ${data.service.owner || 'Not specified'}`,
        '',
        `## Direct Dependencies (${data.dependencies.direct.length})`,
        ...data.dependencies.direct.map((d) => `- ${d.name} (${d.type})`),
        '',
        `## Transitive Dependencies (${data.dependencies.transitive.length})`,
        ...data.dependencies.transitive.map((d) => `- ${d.name}`),
        '',
        `## Environment Variations`,
        ...Object.entries(data.environmentVariations).map(
          ([env, variation]) => `- **${env}**: ${JSON.stringify(variation)}`
        ),
        '',
        `## Capability Checklist (${data.capabilityChecklist.length} items)`,
        ...data.capabilityChecklist.map((c) => `- ${c.required ? '[REQUIRED]' : '[OPTIONAL]'} ${c.name}`),
        '',
        `## Related ADRs (${data.relatedADRs.length})`,
        ...data.relatedADRs.map((adr) => `- ADR-${adr.id}: ${adr.title}`),
      ];

      return {
        content: [
          {
            type: 'text' as const,
            text: textParts.join('\n'),
          },
        ],
        structuredContent: {
          success: true,
          data: response.data,
          metadata: response.metadata,
        },
      };
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `❌ Error: ${response.error?.message || 'Unknown error'}`,
      },
    ],
    structuredContent: {
      success: false,
      error: response.error,
      metadata: response.metadata,
    },
    isError: true,
  };
}
