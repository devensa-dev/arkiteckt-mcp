/**
 * Environment Templates
 *
 * Smart default templates keyed by tier (dev, staging, prod).
 * Used by scaffold_environment tool to provide tier-specific defaults.
 *
 * Templates are partial Environment configs that get deep-merged with user input.
 */

import type { Environment } from '../schemas/environment.schema.js';

/**
 * Template for development environment
 * - Single replica
 * - No multi-AZ
 * - Relaxed security
 * - No DR
 */
const devTemplate: Partial<Environment> = {
  stage: 'dev',
  isProduction: false,
  availability: {
    replicas: 1,
    multiAZ: false,
    multiRegion: false,
  },
  scaling: {
    enabled: false,
    minReplicas: 1,
    maxReplicas: 2,
    targetCPU: 80,
  },
  security: {
    level: 'relaxed',
    encryption: {
      atRest: false,
      inTransit: false,
    },
    network: {
      privateOnly: false,
    },
    authentication: {
      required: true,
      mfaRequired: false,
    },
  },
  database: {
    multiAZ: false,
    replicas: 0,
    backup: {
      enabled: true,
      retentionDays: 3,
    },
  },
  resources: {
    cpu: {
      min: '128m',
      max: '500m',
      default: '256m',
    },
    memory: {
      min: '256Mi',
      max: '1Gi',
      default: '512Mi',
    },
  },
  disasterRecovery: {
    enabled: false,
  },
};

/**
 * Template for staging environment
 * - 2 replicas
 * - Multi-AZ enabled
 * - Standard security
 * - Basic DR
 */
const stagingTemplate: Partial<Environment> = {
  stage: 'staging',
  isProduction: false,
  availability: {
    replicas: 2,
    multiAZ: true,
    multiRegion: false,
  },
  scaling: {
    enabled: true,
    minReplicas: 2,
    maxReplicas: 5,
    targetCPU: 70,
    targetMemory: 80,
    cooldownPeriod: 300,
  },
  security: {
    level: 'standard',
    encryption: {
      atRest: true,
      inTransit: true,
    },
    network: {
      privateOnly: false,
    },
    authentication: {
      required: true,
      mfaRequired: false,
      sessionTimeout: 3600,
    },
  },
  database: {
    multiAZ: true,
    replicas: 1,
    backup: {
      enabled: true,
      retentionDays: 7,
      window: '03:00-04:00',
    },
  },
  resources: {
    cpu: {
      min: '256m',
      max: '1000m',
      default: '500m',
    },
    memory: {
      min: '512Mi',
      max: '2Gi',
      default: '1Gi',
    },
  },
  disasterRecovery: {
    enabled: true,
    rto: 240,
    rpo: 60,
    strategy: 'pilot-light',
  },
};

/**
 * Template for production environment
 * - 3+ replicas
 * - Multi-AZ and multi-region
 * - Strict security
 * - Full DR enabled
 */
const prodTemplate: Partial<Environment> = {
  stage: 'prod',
  isProduction: true,
  availability: {
    replicas: 3,
    multiAZ: true,
    multiRegion: false,
  },
  scaling: {
    enabled: true,
    minReplicas: 3,
    maxReplicas: 20,
    targetCPU: 70,
    targetMemory: 80,
    cooldownPeriod: 300,
  },
  security: {
    level: 'strict',
    encryption: {
      atRest: true,
      inTransit: true,
    },
    network: {
      privateOnly: true,
      vpcEndpoints: true,
    },
    authentication: {
      required: true,
      mfaRequired: true,
      sessionTimeout: 1800,
    },
  },
  database: {
    multiAZ: true,
    replicas: 2,
    backup: {
      enabled: true,
      retentionDays: 30,
      window: '03:00-04:00',
    },
  },
  resources: {
    cpu: {
      min: '500m',
      max: '4000m',
      default: '1000m',
    },
    memory: {
      min: '1Gi',
      max: '8Gi',
      default: '2Gi',
    },
  },
  disasterRecovery: {
    enabled: true,
    rto: 60,
    rpo: 15,
    strategy: 'warm-standby',
  },
};

/**
 * Environment template registry
 * Maps tier to template
 */
export const environmentTemplates: Record<string, Partial<Environment>> = {
  dev: devTemplate,
  development: devTemplate,
  local: devTemplate,
  staging: stagingTemplate,
  prod: prodTemplate,
  production: prodTemplate,
};

/**
 * Get environment template for a tier
 */
export function getEnvironmentTemplate(tier: string): Partial<Environment> {
  return environmentTemplates[tier] || devTemplate;
}

/**
 * Get security checklist for environment tier
 */
export function getSecurityChecklist(tier: string): string[] {
  if (tier === 'prod' || tier === 'production') {
    return [
      'Enable encryption at rest for all data stores',
      'Enable encryption in transit (TLS 1.2+) for all communication',
      'Configure private-only networking with VPC endpoints',
      'Enable MFA for all administrative access',
      'Set up security group rules with least-privilege access',
      'Configure automated security scanning in CI/CD',
      'Enable audit logging and centralized log aggregation',
      'Set up automated backup verification',
      'Configure disaster recovery with RTO < 60min',
      'Enable WAF for public-facing services',
      'Set up DDoS protection',
      'Configure secrets management with rotation',
    ];
  } else if (tier === 'staging') {
    return [
      'Enable encryption at rest for all data stores',
      'Enable encryption in transit (TLS 1.2+) for all communication',
      'Configure security group rules with least-privilege access',
      'Enable audit logging',
      'Set up automated backup verification',
      'Configure basic disaster recovery',
      'Configure secrets management',
    ];
  } else {
    return [
      'Enable basic authentication',
      'Configure security group rules',
      'Set up basic logging',
      'Configure secrets management (development mode)',
    ];
  }
}

/**
 * Get infrastructure steps for environment
 */
export function getInfrastructureSteps(tier: string): string[] {
  const baseSteps = [
    'Create VPC and subnets',
    'Set up security groups and network ACLs',
    'Configure IAM roles and policies',
    'Set up secrets management',
    'Configure logging and monitoring',
  ];

  if (tier === 'prod' || tier === 'production') {
    return [
      ...baseSteps,
      'Configure multi-AZ deployment',
      'Set up auto-scaling groups',
      'Configure load balancers with health checks',
      'Set up disaster recovery in secondary region',
      'Configure backup automation and verification',
      'Set up WAF and DDoS protection',
      'Configure CDN if needed',
      'Set up certificate management',
    ];
  } else if (tier === 'staging') {
    return [
      ...baseSteps,
      'Configure multi-AZ deployment',
      'Set up auto-scaling groups',
      'Configure load balancers with health checks',
      'Set up basic disaster recovery',
      'Configure backup automation',
    ];
  } else {
    return [...baseSteps, 'Configure basic compute resources'];
  }
}
