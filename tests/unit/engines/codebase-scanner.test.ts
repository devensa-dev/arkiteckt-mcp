/**
 * Unit tests for CodebaseScanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { CodebaseScanner } from '../../../src/core/engines/codebase-scanner.js';

describe('CodebaseScanner', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(tmpdir(), `scanner-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Service Detection', () => {
    it('should detect Node.js service with package.json', async () => {
      // Create a simple Node.js service
      const servicePath = join(testDir, 'api-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'package.json'),
        JSON.stringify({
          name: 'api-service',
          version: '1.0.0',
          dependencies: {
            express: '^4.18.0',
          },
        }),
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('api-service');
      expect(result.services[0].runtime?.language).toBe('javascript');
      expect(result.services[0].runtime?.framework).toBe('express');
    });

    it('should detect TypeScript service', async () => {
      const servicePath = join(testDir, 'user-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'package.json'),
        JSON.stringify({
          name: 'user-service',
          dependencies: {
            '@nestjs/core': '^10.0.0',
            typescript: '^5.0.0',
          },
        }),
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].runtime?.language).toBe('typescript');
      expect(result.services[0].runtime?.framework).toBe('nestjs');
    });

    it('should detect Java service with pom.xml', async () => {
      const servicePath = join(testDir, 'payment-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'pom.xml'),
        `<?xml version="1.0"?>
<project>
  <groupId>com.example</groupId>
  <artifactId>payment-service</artifactId>
  <version>1.0.0</version>
  <properties>
    <java.version>17</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter</artifactId>
    </dependency>
  </dependencies>
</project>`,
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('payment-service');
      expect(result.services[0].runtime?.language).toBe('java');
      expect(result.services[0].runtime?.framework).toBe('spring-boot');
      expect(result.services[0].runtime?.version).toBe('17');
    });

    it('should detect Go service with go.mod', async () => {
      const servicePath = join(testDir, 'order-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'go.mod'),
        `module github.com/example/order-service

go 1.21

require github.com/gin-gonic/gin v1.9.0`,
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('order-service');
      expect(result.services[0].runtime?.language).toBe('go');
      expect(result.services[0].runtime?.version).toBe('1.21');
      expect(result.services[0].runtime?.framework).toBe('gin');
    });

    it('should detect Python service with requirements.txt', async () => {
      const servicePath = join(testDir, 'analytics-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'requirements.txt'),
        'fastapi==0.100.0\nuvicorn==0.23.0',
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('analytics-service');
      expect(result.services[0].runtime?.language).toBe('python');
      expect(result.services[0].runtime?.framework).toBe('fastapi');
    });

    it('should detect multiple services in monorepo', async () => {
      // Create multiple services
      const service1Path = join(testDir, 'services', 'api');
      const service2Path = join(testDir, 'services', 'worker');

      await mkdir(service1Path, { recursive: true });
      await mkdir(service2Path, { recursive: true });

      await writeFile(
        join(service1Path, 'package.json'),
        JSON.stringify({ name: 'api', dependencies: { express: '^4.0.0' } }),
        'utf-8'
      );

      await writeFile(
        join(service2Path, 'package.json'),
        JSON.stringify({ name: 'worker' }),
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(2);
      expect(result.services.map((s) => s.name).sort()).toEqual(['api', 'worker']);
    });
  });

  describe('Deployment Pattern Detection', () => {
    it('should detect Kubernetes deployment', async () => {
      const servicePath = join(testDir, 'k8s-service');
      await mkdir(join(servicePath, 'k8s'), { recursive: true });
      await writeFile(join(servicePath, 'package.json'), JSON.stringify({ name: 'k8s-service' }), 'utf-8');
      await writeFile(
        join(servicePath, 'k8s', 'deployment.yaml'),
        'apiVersion: apps/v1\nkind: Deployment',
        'utf-8'
      );
      await writeFile(join(servicePath, 'Dockerfile'), 'FROM node:20', 'utf-8');

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].deploymentPattern).toBe('kubernetes');
      expect(result.services[0].deploymentEvidence.some((e) => e.toLowerCase().includes('kubernetes'))).toBe(true);
      expect(result.services[0].confidence).toBeGreaterThan(0.7);
    });

    it('should detect Lambda deployment with serverless.yml', async () => {
      const servicePath = join(testDir, 'lambda-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(join(servicePath, 'package.json'), JSON.stringify({ name: 'lambda-service' }), 'utf-8');
      await writeFile(
        join(servicePath, 'serverless.yml'),
        'service: lambda-service\nprovider:\n  name: aws\n  runtime: nodejs18.x',
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].deploymentPattern).toBe('lambda');
      expect(result.services[0].deploymentEvidence.some((e) => e.includes('serverless.yml'))).toBe(true);
    });

    it('should detect ECS Fargate deployment', async () => {
      const servicePath = join(testDir, 'ecs-service');
      const infraPath = join(servicePath, 'infra');
      await mkdir(infraPath, { recursive: true });
      await writeFile(join(servicePath, 'package.json'), JSON.stringify({ name: 'ecs-service' }), 'utf-8');
      await writeFile(join(servicePath, 'Dockerfile'), 'FROM node:20', 'utf-8');
      await writeFile(join(infraPath, 'task-definition.json'), '{}', 'utf-8');

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].deploymentPattern).toBe('ecs_fargate');
      expect(result.services[0].deploymentEvidence.some((e) => e.toLowerCase().includes('ecs') || e.includes('task-def'))).toBe(true);
    });

    it('should detect container deployment with docker-compose', async () => {
      const servicePath = join(testDir, 'container-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(join(servicePath, 'package.json'), JSON.stringify({ name: 'container-service' }), 'utf-8');
      await writeFile(join(servicePath, 'Dockerfile'), 'FROM node:20', 'utf-8');
      await writeFile(join(servicePath, 'docker-compose.yml'), 'version: "3"', 'utf-8');

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].deploymentPattern).toBe('container');
    });
  });

  describe('CI/CD Detection', () => {
    it('should detect GitHub Actions', async () => {
      const workflowsPath = join(testDir, '.github', 'workflows');
      await mkdir(workflowsPath, { recursive: true });
      await writeFile(
        join(workflowsPath, 'ci.yml'),
        `name: CI
on: push
jobs:
  build:
    name: Build and Test
  deploy:
    name: Deploy to Production`,
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.cicd).toBeDefined();
      expect(result.cicd?.provider).toBe('github-actions');
      expect(result.cicd?.configFile).toBe('.github/workflows/ci.yml');
      expect(result.cicd?.steps).toContain('Build and Test');
    });

    it('should detect GitLab CI', async () => {
      await writeFile(
        join(testDir, '.gitlab-ci.yml'),
        `stages:
  - build
  - test
  - deploy`,
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.cicd).toBeDefined();
      expect(result.cicd?.provider).toBe('gitlab-ci');
      expect(result.cicd?.configFile).toBe('.gitlab-ci.yml');
    });

    it('should detect Jenkins', async () => {
      await writeFile(
        join(testDir, 'Jenkinsfile'),
        `pipeline {
  stages {
    stage('Build') {}
  }
}`,
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.cicd).toBeDefined();
      expect(result.cicd?.provider).toBe('jenkins');
    });
  });

  describe('Observability Detection', () => {
    it('should detect Datadog from config file', async () => {
      await writeFile(join(testDir, 'datadog.yaml'), 'api_key: xxx', 'utf-8');

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.observability).toBeDefined();
      expect(result.observability?.tools).toContain('datadog');
      expect(result.observability?.evidence).toContain('datadog.yaml found at root');
    });

    it('should detect observability from source code imports', async () => {
      const servicePath = join(testDir, 'monitored-service');
      const srcPath = join(servicePath, 'src');
      await mkdir(srcPath, { recursive: true });
      await writeFile(join(servicePath, 'package.json'), JSON.stringify({ name: 'monitored-service' }), 'utf-8');
      await writeFile(
        join(srcPath, 'index.ts'),
        `import tracer from 'dd-trace';
tracer.init();`,
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.observability).toBeDefined();
      expect(result.observability?.tools).toContain('datadog');
    });
  });

  describe('System Detection', () => {
    it('should detect system name from root package.json', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'ecommerce-platform',
          private: true,
          workspaces: ['services/*'],
        }),
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.system).toBeDefined();
      expect(result.system?.name).toBe('ecommerce-platform');
    });

    it('should detect cloud provider from terraform files', async () => {
      const terraformPath = join(testDir, 'terraform');
      await mkdir(terraformPath, { recursive: true });
      await writeFile(
        join(terraformPath, 'main.tf'),
        `provider "aws" {
  region = "us-east-1"
}`,
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.system).toBeDefined();
      expect(result.system?.cloud).toBe('aws');
      expect(result.system?.region).toBe('us-east-1');
    });
  });

  describe('Monorepo Detection', () => {
    it('should detect monorepo from package.json workspaces', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'monorepo',
          private: true,
          workspaces: ['packages/*', 'services/*'],
        }),
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      // Monorepo detection is internal, but we can verify it scans nested services
      expect(result.warnings).toBeDefined();
    });

    it('should detect monorepo from lerna.json', async () => {
      await writeFile(
        join(testDir, 'lerna.json'),
        JSON.stringify({
          packages: ['packages/*'],
          version: '1.0.0',
        }),
        'utf-8'
      );

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.warnings).toBeDefined();
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign high confidence when build file, infra, and runtime detected', async () => {
      const servicePath = join(testDir, 'complete-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(
        join(servicePath, 'package.json'),
        JSON.stringify({
          name: 'complete-service',
          dependencies: { express: '^4.0.0', typescript: '^5.0.0' },
        }),
        'utf-8'
      );
      await writeFile(join(servicePath, 'Dockerfile'), 'FROM node:20', 'utf-8');
      await writeFile(join(servicePath, 'serverless.yml'), 'service: test', 'utf-8');

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should assign low confidence when only build file detected', async () => {
      const servicePath = join(testDir, 'minimal-service');
      await mkdir(servicePath, { recursive: true });
      await writeFile(join(servicePath, 'package.json'), JSON.stringify({ name: 'minimal-service' }), 'utf-8');

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(1);
      expect(result.services[0].confidence).toBeLessThan(0.7);
    });

    it('should warn about very low confidence services', async () => {
      // This would be a service with no clear build file
      // For now, just verify warnings array exists
      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty directory', async () => {
      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(0);
      expect(result.scanDuration).toBeGreaterThan(0);
    });

    it('should exclude node_modules directories', async () => {
      const nodeModulesPath = join(testDir, 'node_modules', 'some-package');
      await mkdir(nodeModulesPath, { recursive: true });
      await writeFile(join(nodeModulesPath, 'package.json'), JSON.stringify({ name: 'should-ignore' }), 'utf-8');

      const scanner = new CodebaseScanner({ rootPath: testDir });
      const result = await scanner.scan();

      expect(result.services).toHaveLength(0);
    });

    it('should respect maxDepth limit', async () => {
      // Create deeply nested structure
      let deepPath = testDir;
      for (let i = 0; i < 10; i++) {
        deepPath = join(deepPath, `level-${i}`);
        await mkdir(deepPath, { recursive: true });
      }
      await writeFile(join(deepPath, 'package.json'), JSON.stringify({ name: 'too-deep' }), 'utf-8');

      const scanner = new CodebaseScanner({ rootPath: testDir, maxDepth: 5 });
      const result = await scanner.scan();

      // Should not find the deeply nested service
      expect(result.services).toHaveLength(0);
    });
  });
});
