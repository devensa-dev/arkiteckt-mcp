/**
 * Codebase Scanner
 *
 * Scans existing codebases to auto-detect services, dependencies, deployment
 * patterns, CI/CD, and observability configuration. Returns structured results
 * for user review before optionally writing to architecture YAML files.
 */

import { join, relative, basename, dirname } from 'path';
import { readdir, readFile, stat, access } from 'fs/promises';
import { constants } from 'fs';
import type {
  ScanResult,
  DetectedService,
  DetectedDependency,
  DetectedCICD,
  DetectedObservability,
  DetectedSystem,
} from '../schemas/scan-result.schema.js';
import type { DeploymentPattern, ServiceType } from '../../shared/types/index.js';

/**
 * Options for codebase scanning
 */
export interface ScanOptions {
  rootPath: string;
  maxDepth?: number; // Maximum directory depth to scan (default: 5)
  excludeDirs?: string[]; // Directories to exclude (default: node_modules, .git, dist, build)
}

/**
 * Service directory detection result
 */
interface ServiceDirectory {
  path: string;
  name: string;
  buildFile: string | null;
  buildFileType: string | null;
}

/**
 * Deployment pattern detection result
 */
interface DeploymentDetection {
  pattern: DeploymentPattern | null;
  evidence: string[];
  confidence: number;
}

/**
 * Runtime detection result
 */
interface RuntimeDetection {
  language: string;
  version?: string;
  framework?: string;
}

/**
 * Main codebase scanner class
 */
export class CodebaseScanner {
  private readonly rootPath: string;
  private readonly maxDepth: number;
  private readonly excludeDirs: Set<string>;

  constructor(options: ScanOptions) {
    this.rootPath = options.rootPath;
    this.maxDepth = options.maxDepth ?? 5;
    this.excludeDirs = new Set(
      options.excludeDirs ?? ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'target', 'bin', 'obj']
    );
  }

  /**
   * Main scan method - orchestrates all detectors
   */
  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Detect repository structure
      const isMonorepo = await this.detectMonorepo();

      // Detect service directories
      const serviceDirs = await this.detectServiceDirectories();

      // Detect each service's details
      const services: DetectedService[] = [];
      for (const serviceDir of serviceDirs) {
        try {
          const service = await this.detectServiceDetails(serviceDir);

          // Filter out low-confidence detections
          if (service.confidence < 0.3) {
            warnings.push(
              `Service "${service.name}" at ${service.path} has low confidence (${service.confidence.toFixed(2)}) - may be a library or incomplete service`
            );
          } else {
            services.push(service);
          }
        } catch (error) {
          warnings.push(`Failed to analyze service at ${serviceDir.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Detect dependencies between services
      await this.detectDependencies(services);

      // Detect CI/CD configuration
      const cicd = await this.detectCICD();

      // Detect observability setup
      const observability = await this.detectObservability();

      // Detect system-level metadata
      const system = await this.detectSystem();

      const scanDuration = Date.now() - startTime;

      return {
        services,
        cicd,
        observability,
        system,
        scanDuration,
        warnings,
      };
    } catch (error) {
      throw new Error(`Scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect if this is a monorepo or polyrepo
   */
  private async detectMonorepo(): Promise<boolean> {
    try {
      // Check for monorepo indicators
      const packageJsonPath = join(this.rootPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const content = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);

        // Check for workspaces (npm, yarn, pnpm)
        if (packageJson.workspaces || packageJson.private === true) {
          return true;
        }
      }

      // Check for lerna.json
      if (await this.fileExists(join(this.rootPath, 'lerna.json'))) {
        return true;
      }

      // Check for nx.json
      if (await this.fileExists(join(this.rootPath, 'nx.json'))) {
        return true;
      }

      // Check for pnpm-workspace.yaml
      if (await this.fileExists(join(this.rootPath, 'pnpm-workspace.yaml'))) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detect service directories by finding build files
   */
  private async detectServiceDirectories(): Promise<ServiceDirectory[]> {
    const serviceDirs: ServiceDirectory[] = [];

    await this.walkDirectories(this.rootPath, 0, async (dirPath, depth) => {
      const relativePath = relative(this.rootPath, dirPath);
      const dirName = basename(dirPath);

      // Check for build files that indicate a service
      const buildFiles = [
        { file: 'package.json', type: 'node' },
        { file: 'pom.xml', type: 'java' },
        { file: 'build.gradle', type: 'java' },
        { file: 'go.mod', type: 'go' },
        { file: 'requirements.txt', type: 'python' },
        { file: 'pyproject.toml', type: 'python' },
        { file: 'Cargo.toml', type: 'rust' },
        { file: 'pubspec.yaml', type: 'dart' },
        { file: 'composer.json', type: 'php' },
      ];

      for (const { file, type } of buildFiles) {
        if (await this.fileExists(join(dirPath, file))) {
          serviceDirs.push({
            path: relativePath,
            name: this.inferServiceName(relativePath, dirName),
            buildFile: file,
            buildFileType: type,
          });
          break; // Only detect one build file per directory
        }
      }
    });

    return serviceDirs;
  }

  /**
   * Detect detailed service information
   */
  private async detectServiceDetails(serviceDir: ServiceDirectory): Promise<DetectedService> {
    const servicePath = join(this.rootPath, serviceDir.path);

    // Detect runtime
    const runtime = await this.detectRuntime(servicePath, serviceDir.buildFileType);

    // Detect deployment pattern
    const deployment = await this.detectDeployment(servicePath);

    // Detect service type
    const type = await this.detectServiceType(servicePath, serviceDir.buildFileType, runtime.framework);

    // Calculate confidence score
    const confidence = this.calculateConfidence(serviceDir, deployment, runtime, type);

    return {
      name: serviceDir.name,
      path: serviceDir.path,
      type,
      runtime,
      deploymentPattern: deployment.pattern ?? undefined,
      deploymentEvidence: deployment.evidence,
      dependencies: [], // Will be populated by detectDependencies
      confidence,
    };
  }

  /**
   * Detect runtime information from build files and config
   */
  private async detectRuntime(
    servicePath: string,
    buildFileType: string | null
  ): Promise<RuntimeDetection | undefined> {
    if (!buildFileType) return undefined;

    try {
      switch (buildFileType) {
        case 'node':
          return await this.detectNodeRuntime(servicePath);
        case 'java':
          return await this.detectJavaRuntime(servicePath);
        case 'go':
          return await this.detectGoRuntime(servicePath);
        case 'python':
          return await this.detectPythonRuntime(servicePath);
        case 'rust':
          return await this.detectRustRuntime(servicePath);
        default:
          return { language: buildFileType };
      }
    } catch {
      return { language: buildFileType };
    }
  }

  /**
   * Detect Node.js runtime details
   */
  private async detectNodeRuntime(servicePath: string): Promise<RuntimeDetection> {
    const runtime: RuntimeDetection = { language: 'typescript' };

    // Check for .nvmrc
    const nvmrcPath = join(servicePath, '.nvmrc');
    if (await this.fileExists(nvmrcPath)) {
      const version = (await readFile(nvmrcPath, 'utf-8')).trim();
      runtime.version = version.replace(/^v/, '');
    }

    // Check package.json for framework
    const packageJsonPath = join(servicePath, 'package.json');
    if (await this.fileExists(packageJsonPath)) {
      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      // Detect framework from dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (allDeps['express']) runtime.framework = 'express';
      else if (allDeps['@nestjs/core']) runtime.framework = 'nestjs';
      else if (allDeps['next']) runtime.framework = 'nextjs';
      else if (allDeps['react']) runtime.framework = 'react';
      else if (allDeps['vue']) runtime.framework = 'vue';
      else if (allDeps['@angular/core']) runtime.framework = 'angular';
      else if (allDeps['fastify']) runtime.framework = 'fastify';
      else if (allDeps['koa']) runtime.framework = 'koa';

      // Check for TypeScript vs JavaScript
      if (allDeps['typescript']) {
        runtime.language = 'typescript';
      } else {
        runtime.language = 'javascript';
      }

      // Get Node version from engines
      if (packageJson.engines?.node) {
        runtime.version = packageJson.engines.node;
      }
    }

    return runtime;
  }

  /**
   * Detect Java runtime details
   */
  private async detectJavaRuntime(servicePath: string): Promise<RuntimeDetection> {
    const runtime: RuntimeDetection = { language: 'java' };

    // Check pom.xml
    const pomPath = join(servicePath, 'pom.xml');
    if (await this.fileExists(pomPath)) {
      const content = await readFile(pomPath, 'utf-8');

      if (content.includes('spring-boot-starter')) {
        runtime.framework = 'spring-boot';
      } else if (content.includes('quarkus')) {
        runtime.framework = 'quarkus';
      } else if (content.includes('micronaut')) {
        runtime.framework = 'micronaut';
      }

      // Try to extract Java version
      const versionMatch = content.match(/<java\.version>(\d+)<\/java\.version>/);
      if (versionMatch) {
        runtime.version = versionMatch[1];
      }
    }

    // Check build.gradle
    const gradlePath = join(servicePath, 'build.gradle');
    if (await this.fileExists(gradlePath)) {
      const content = await readFile(gradlePath, 'utf-8');

      if (content.includes('org.springframework.boot')) {
        runtime.framework = 'spring-boot';
      }
    }

    return runtime;
  }

  /**
   * Detect Go runtime details
   */
  private async detectGoRuntime(servicePath: string): Promise<RuntimeDetection> {
    const runtime: RuntimeDetection = { language: 'go' };

    const goModPath = join(servicePath, 'go.mod');
    if (await this.fileExists(goModPath)) {
      const content = await readFile(goModPath, 'utf-8');

      // Extract Go version
      const versionMatch = content.match(/^go\s+(\d+\.\d+)/m);
      if (versionMatch) {
        runtime.version = versionMatch[1];
      }

      // Detect frameworks
      if (content.includes('github.com/gin-gonic/gin')) {
        runtime.framework = 'gin';
      } else if (content.includes('github.com/labstack/echo')) {
        runtime.framework = 'echo';
      } else if (content.includes('github.com/gofiber/fiber')) {
        runtime.framework = 'fiber';
      }
    }

    return runtime;
  }

  /**
   * Detect Python runtime details
   */
  private async detectPythonRuntime(servicePath: string): Promise<RuntimeDetection> {
    const runtime: RuntimeDetection = { language: 'python' };

    // Check for runtime.txt (Heroku, etc.)
    const runtimePath = join(servicePath, 'runtime.txt');
    if (await this.fileExists(runtimePath)) {
      const content = (await readFile(runtimePath, 'utf-8')).trim();
      const versionMatch = content.match(/python-(\d+\.\d+)/);
      if (versionMatch) {
        runtime.version = versionMatch[1];
      }
    }

    // Check requirements.txt for frameworks
    const requirementsPath = join(servicePath, 'requirements.txt');
    if (await this.fileExists(requirementsPath)) {
      const content = await readFile(requirementsPath, 'utf-8');

      if (content.includes('django')) runtime.framework = 'django';
      else if (content.includes('flask')) runtime.framework = 'flask';
      else if (content.includes('fastapi')) runtime.framework = 'fastapi';
    }

    return runtime;
  }

  /**
   * Detect Rust runtime details
   */
  private async detectRustRuntime(servicePath: string): Promise<RuntimeDetection> {
    const runtime: RuntimeDetection = { language: 'rust' };

    const cargoPath = join(servicePath, 'Cargo.toml');
    if (await this.fileExists(cargoPath)) {
      const content = await readFile(cargoPath, 'utf-8');

      if (content.includes('actix-web')) runtime.framework = 'actix-web';
      else if (content.includes('rocket')) runtime.framework = 'rocket';
      else if (content.includes('axum')) runtime.framework = 'axum';
    }

    return runtime;
  }

  /**
   * Detect deployment pattern from infrastructure files
   */
  private async detectDeployment(servicePath: string): Promise<DeploymentDetection> {
    const evidence: string[] = [];
    let pattern: DeploymentPattern | null = null;
    let confidence = 0;

    // Check for Dockerfile
    if (await this.fileExists(join(servicePath, 'Dockerfile'))) {
      evidence.push(`Dockerfile found at ${relative(this.rootPath, join(servicePath, 'Dockerfile'))}`);
      confidence += 0.3;
    }

    // Check for Kubernetes manifests
    const k8sDir = join(servicePath, 'k8s');
    if (await this.directoryExists(k8sDir)) {
      evidence.push(`Kubernetes manifests found at ${relative(this.rootPath, k8sDir)}`);
      pattern = 'kubernetes';
      confidence += 0.4;
    }

    // Check for serverless.yml (Serverless Framework)
    if (await this.fileExists(join(servicePath, 'serverless.yml'))) {
      evidence.push(`serverless.yml found at ${relative(this.rootPath, join(servicePath, 'serverless.yml'))}`);
      pattern = 'lambda';
      confidence += 0.5;
    }

    // Check for ECS task definition
    const infraDir = join(servicePath, 'infra');
    if (await this.directoryExists(infraDir)) {
      const files = await readdir(infraDir);
      if (files.some((f) => f.includes('task-def') || f.includes('task-definition'))) {
        evidence.push(`ECS task definition found in ${relative(this.rootPath, infraDir)}`);
        pattern = 'ecs_fargate';
        confidence += 0.4;
      }
    }

    // Check for docker-compose.yml
    if (await this.fileExists(join(servicePath, 'docker-compose.yml'))) {
      evidence.push(`docker-compose.yml found at ${relative(this.rootPath, join(servicePath, 'docker-compose.yml'))}`);
      if (!pattern) {
        pattern = 'container';
        confidence += 0.3;
      }
    }

    // If Dockerfile exists but no specific pattern detected, assume container
    if (evidence.some((e) => e.includes('Dockerfile')) && !pattern) {
      pattern = 'container';
    }

    return { pattern, evidence, confidence };
  }

  /**
   * Detect service type based on build file and framework
   */
  private async detectServiceType(
    servicePath: string,
    buildFileType: string | null,
    framework?: string
  ): Promise<ServiceType | undefined> {
    // Check for API frameworks
    const apiFrameworks = ['express', 'nestjs', 'fastify', 'koa', 'spring-boot', 'gin', 'flask', 'fastapi', 'django'];
    if (framework && apiFrameworks.includes(framework)) {
      return 'api';
    }

    // Check for frontend frameworks
    const frontendFrameworks = ['react', 'vue', 'angular', 'nextjs'];
    if (framework && frontendFrameworks.includes(framework)) {
      return 'frontend';
    }

    // Check for package.json type
    if (buildFileType === 'node') {
      const packageJsonPath = join(servicePath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const content = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);

        if (packageJson.name?.includes('worker') || packageJson.name?.includes('consumer')) {
          return 'worker';
        }
      }
    }

    // Default to backend for API-like services
    if (buildFileType && !framework) {
      return 'backend';
    }

    return undefined;
  }

  /**
   * Detect inter-service dependencies by scanning source code
   */
  private async detectDependencies(services: DetectedService[]): Promise<void> {
    const serviceNames = services.map((s) => s.name);

    for (const service of services) {
      const servicePath = join(this.rootPath, service.path);
      const dependencies: DetectedDependency[] = [];

      try {
        // Scan source files for references to other services
        const sourceFiles = await this.findSourceFiles(servicePath);

        for (const sourceFile of sourceFiles) {
          const content = await readFile(sourceFile, 'utf-8');

          // Look for HTTP client patterns
          for (const targetService of serviceNames) {
            if (targetService === service.name) continue;

            // Pattern: http://service-name or https://service-name
            const urlPattern = new RegExp(`https?://[\\w.-]*${targetService}[\\w.-]*`, 'i');
            if (urlPattern.test(content)) {
              const evidence = `HTTP URL reference to ${targetService} in ${relative(this.rootPath, sourceFile)}`;
              dependencies.push({
                targetService,
                type: 'sync',
                protocol: 'http',
                evidence,
              });
              continue;
            }

            // Pattern: import/require with service name
            const importPattern = new RegExp(`['"\`].*${targetService}.*['"\`]`, 'i');
            if (importPattern.test(content)) {
              const evidence = `Import reference to ${targetService} in ${relative(this.rootPath, sourceFile)}`;
              dependencies.push({
                targetService,
                type: 'unknown',
                evidence,
              });
              continue;
            }
          }

          // Look for message queue patterns (async dependencies)
          if (content.includes('amqp') || content.includes('rabbitmq')) {
            // Try to identify which service this queue might connect to
            for (const targetService of serviceNames) {
              if (targetService === service.name) continue;
              if (content.toLowerCase().includes(targetService.toLowerCase())) {
                const evidence = `RabbitMQ reference to ${targetService} in ${relative(this.rootPath, sourceFile)}`;
                dependencies.push({
                  targetService,
                  type: 'async',
                  protocol: 'amqp',
                  evidence,
                });
              }
            }
          }
        }

        // Deduplicate dependencies
        service.dependencies = this.deduplicateDependencies(dependencies);
      } catch (error) {
        // Skip dependency detection for this service if it fails
        continue;
      }
    }
  }

  /**
   * Detect CI/CD configuration
   */
  private async detectCICD(): Promise<DetectedCICD | undefined> {
    // Check for GitHub Actions
    const githubWorkflowsDir = join(this.rootPath, '.github', 'workflows');
    if (await this.directoryExists(githubWorkflowsDir)) {
      const files = await readdir(githubWorkflowsDir);
      const yamlFiles = files.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

      if (yamlFiles.length > 0) {
        const steps: string[] = [];
        // Try to extract step names from first workflow file
        try {
          const workflowContent = await readFile(join(githubWorkflowsDir, yamlFiles[0]), 'utf-8');
          const stepMatches = workflowContent.matchAll(/name:\s*(.+)/g);
          for (const match of stepMatches) {
            steps.push(match[1].trim());
          }
        } catch {
          // Use generic steps if parsing fails
          steps.push('build', 'test', 'deploy');
        }

        return {
          provider: 'github-actions',
          configFile: `.github/workflows/${yamlFiles[0]}`,
          steps: steps.slice(0, 10), // Limit to 10 steps
        };
      }
    }

    // Check for GitLab CI
    if (await this.fileExists(join(this.rootPath, '.gitlab-ci.yml'))) {
      return {
        provider: 'gitlab-ci',
        configFile: '.gitlab-ci.yml',
        steps: ['build', 'test', 'deploy'],
      };
    }

    // Check for Jenkins
    if (await this.fileExists(join(this.rootPath, 'Jenkinsfile'))) {
      return {
        provider: 'jenkins',
        configFile: 'Jenkinsfile',
        steps: ['build', 'test', 'deploy'],
      };
    }

    // Check for Bitbucket Pipelines
    if (await this.fileExists(join(this.rootPath, 'bitbucket-pipelines.yml'))) {
      return {
        provider: 'bitbucket-pipelines',
        configFile: 'bitbucket-pipelines.yml',
        steps: ['build', 'test', 'deploy'],
      };
    }

    return undefined;
  }

  /**
   * Detect observability tools and configuration
   */
  private async detectObservability(): Promise<DetectedObservability | undefined> {
    const tools: string[] = [];
    const evidence: string[] = [];

    // Check for Datadog
    if (await this.fileExists(join(this.rootPath, 'datadog.yaml'))) {
      tools.push('datadog');
      evidence.push('datadog.yaml found at root');
    }

    // Check for Prometheus
    if (await this.fileExists(join(this.rootPath, 'prometheus.yml'))) {
      tools.push('prometheus');
      evidence.push('prometheus.yml found at root');
    }

    // Check for New Relic
    if (await this.fileExists(join(this.rootPath, 'newrelic.js'))) {
      tools.push('newrelic');
      evidence.push('newrelic.js found at root');
    }

    // Scan for observability imports in source files
    try {
      const sourceFiles = await this.findSourceFiles(this.rootPath);
      for (const sourceFile of sourceFiles.slice(0, 20)) {
        // Limit scanning
        const content = await readFile(sourceFile, 'utf-8');

        if (content.includes('dd-trace') || content.includes('datadog')) {
          if (!tools.includes('datadog')) {
            tools.push('datadog');
            evidence.push(`dd-trace import in ${relative(this.rootPath, sourceFile)}`);
          }
        }

        if (content.includes('@opentelemetry')) {
          if (!tools.includes('opentelemetry')) {
            tools.push('opentelemetry');
            evidence.push(`OpenTelemetry import in ${relative(this.rootPath, sourceFile)}`);
          }
        }

        if (content.includes('prom-client')) {
          if (!tools.includes('prometheus')) {
            tools.push('prometheus');
            evidence.push(`prom-client import in ${relative(this.rootPath, sourceFile)}`);
          }
        }
      }
    } catch {
      // Skip source scanning if it fails
    }

    if (tools.length === 0) {
      return undefined;
    }

    return { tools, evidence };
  }

  /**
   * Detect system-level metadata
   */
  private async detectSystem(): Promise<DetectedSystem | undefined> {
    const system: DetectedSystem = {};

    // Get system name from package.json
    const packageJsonPath = join(this.rootPath, 'package.json');
    if (await this.fileExists(packageJsonPath)) {
      try {
        const content = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);
        if (packageJson.name) {
          system.name = packageJson.name;
        }
      } catch {
        // Skip if parsing fails
      }
    }

    // Try to infer cloud provider from infrastructure files
    const terraformDir = join(this.rootPath, 'terraform');
    if (await this.directoryExists(terraformDir)) {
      try {
        const files = await readdir(terraformDir);
        for (const file of files) {
          if (file.endsWith('.tf')) {
            const content = await readFile(join(terraformDir, file), 'utf-8');
            if (content.includes('provider "aws"')) {
              system.cloud = 'aws';
            } else if (content.includes('provider "google"')) {
              system.cloud = 'gcp';
            } else if (content.includes('provider "azurerm"')) {
              system.cloud = 'azure';
            }

            // Try to extract region
            const regionMatch = content.match(/region\s*=\s*"([^"]+)"/);
            if (regionMatch) {
              system.region = regionMatch[1];
            }
            break;
          }
        }
      } catch {
        // Skip if reading fails
      }
    }

    return Object.keys(system).length > 0 ? system : undefined;
  }

  /**
   * Calculate confidence score for a detected service
   */
  private calculateConfidence(
    serviceDir: ServiceDirectory,
    deployment: DeploymentDetection,
    runtime: RuntimeDetection | undefined,
    type: ServiceType | undefined
  ): number {
    let confidence = 0;

    // Build file presence: +0.4
    if (serviceDir.buildFile) {
      confidence += 0.4;
    }

    // Infrastructure files: +0.3
    if (deployment.pattern) {
      confidence += deployment.confidence;
    }

    // Runtime detection: +0.2
    if (runtime?.framework) {
      confidence += 0.2;
    } else if (runtime?.language) {
      confidence += 0.1;
    }

    // Service type detection: +0.1
    if (type) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Infer service name from directory path
   */
  private inferServiceName(relativePath: string, dirName: string): string {
    // Use directory name, converting to kebab-case
    return dirName
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Find source files in a directory
   */
  private async findSourceFiles(dirPath: string): Promise<string[]> {
    const sourceFiles: string[] = [];
    const sourceExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.php'];

    await this.walkDirectories(dirPath, 0, async (currentDir) => {
      try {
        const files = await readdir(currentDir);
        for (const file of files) {
          if (sourceExtensions.some((ext) => file.endsWith(ext))) {
            sourceFiles.push(join(currentDir, file));
          }
        }
      } catch {
        // Skip directories we can't read
      }
    });

    return sourceFiles.slice(0, 100); // Limit to 100 files for performance
  }

  /**
   * Deduplicate dependencies
   */
  private deduplicateDependencies(dependencies: DetectedDependency[]): DetectedDependency[] {
    const seen = new Map<string, DetectedDependency>();

    for (const dep of dependencies) {
      const key = `${dep.targetService}-${dep.type}-${dep.protocol ?? 'unknown'}`;
      if (!seen.has(key)) {
        seen.set(key, dep);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Walk directory tree recursively
   */
  private async walkDirectories(
    dirPath: string,
    depth: number,
    callback: (dirPath: string, depth: number) => Promise<void>
  ): Promise<void> {
    if (depth > this.maxDepth) return;

    try {
      await callback(dirPath, depth);

      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !this.excludeDirs.has(entry.name)) {
          await this.walkDirectories(join(dirPath, entry.name), depth + 1, callback);
        }
      }
    } catch {
      // Skip directories we can't access
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
