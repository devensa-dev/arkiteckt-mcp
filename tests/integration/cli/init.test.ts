/**
 * Integration Tests: arch init
 *
 * User Story 3: Architecture Store Initialization (Priority: P1)
 *
 * Acceptance Scenarios:
 * 1. Given an empty directory, When I run arch init,
 *    Then the canonical /architecture directory structure is created with template files.
 * 2. Given an existing architecture directory, When I run arch init,
 *    Then the command fails with a message preventing accidental overwrite.
 * 3. Given a partial architecture directory, When I run arch init --repair,
 *    Then missing directories and files are added without modifying existing content.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { constants } from 'fs';
import { ArchitectureStore } from '../../../src/core/store/architecture-store.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe('arch init', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `arch-init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // AC1: Empty directory → canonical structure created
  // ==========================================================================

  describe('AC1: Initialize empty directory', () => {
    it('should create the architecture directory', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.init();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(await pathExists(join(testDir, 'architecture'))).toBe(true);
      expect(result.data.created).toContain('architecture/');
    });

    it('should create all canonical subdirectories', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      await store.init();

      const subdirs = ['services', 'environments', 'adrs', 'tenants', 'rules', 'capabilities'];
      for (const subdir of subdirs) {
        expect(await pathExists(join(testDir, 'architecture', subdir))).toBe(true);
      }
    });

    it('should create system.yaml', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      await store.init();

      const systemPath = join(testDir, 'architecture', 'system.yaml');
      expect(await pathExists(systemPath)).toBe(true);

      const content = await readFile(systemPath, 'utf-8');
      expect(content).toContain('name:');
      expect(content).toContain('architecture:');
      expect(content).toContain('style: microservices');
    });

    it('should create system.yaml that passes schema validation', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      await store.init();

      const result = await store.getSystem();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.name).toBe('my-system');
      expect(result.data.architecture.style).toBe('microservices');
    });

    it('should return summary with all created items', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.init();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.message).toContain('initialized');
      // 1 root + 6 subdirs + 1 system.yaml = 8 items
      expect(result.data.created.length).toBe(8);
      expect(result.data.skipped.length).toBe(0);
    });
  });

  // ==========================================================================
  // AC2: Existing directory → error prevents overwrite
  // ==========================================================================

  describe('AC2: Prevent accidental overwrite', () => {
    it('should fail when architecture directory already exists', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });

      const first = await store.init();
      expect(first.success).toBe(true);

      const second = await store.init();
      expect(second.success).toBe(false);
      if (second.success) return;

      expect(second.error.type).toBe('file');
      expect(second.error.code).toBe('EEXIST');
    });

    it('should suggest --repair in the error message', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });
      await store.init();

      const result = await store.init();
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.message).toContain('--repair');
    });
  });

  // ==========================================================================
  // AC3: Partial directory + --repair → missing items added, existing preserved
  // ==========================================================================

  describe('AC3: Repair partial architecture', () => {
    it('should create missing directories without affecting existing ones', async () => {
      const archDir = join(testDir, 'architecture');
      await mkdir(join(archDir, 'services'), { recursive: true });

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.init({ repair: true });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // services/ was preserved
      expect(result.data.skipped).toContain('architecture/services/');
      // other dirs were created
      expect(result.data.created).toContain('architecture/environments/');
      expect(result.data.created).toContain('architecture/adrs/');

      // all dirs exist
      const subdirs = ['services', 'environments', 'adrs', 'tenants', 'rules', 'capabilities'];
      for (const subdir of subdirs) {
        expect(await pathExists(join(archDir, subdir))).toBe(true);
      }
    });

    it('should not overwrite existing system.yaml', async () => {
      const archDir = join(testDir, 'architecture');
      await mkdir(archDir, { recursive: true });

      const customContent = 'name: custom-system\narchitecture:\n  style: serverless\n';
      await writeFile(join(archDir, 'system.yaml'), customContent, 'utf-8');

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.init({ repair: true });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.skipped).toContain('architecture/system.yaml');

      const content = await readFile(join(archDir, 'system.yaml'), 'utf-8');
      expect(content).toBe(customContent);
    });

    it('should create system.yaml if missing during repair', async () => {
      const archDir = join(testDir, 'architecture');
      await mkdir(join(archDir, 'services'), { recursive: true });

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.init({ repair: true });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.created).toContain('architecture/system.yaml');
      expect(await pathExists(join(archDir, 'system.yaml'))).toBe(true);
    });

    it('should return repair summary', async () => {
      const archDir = join(testDir, 'architecture');
      await mkdir(join(archDir, 'services'), { recursive: true });
      await mkdir(join(archDir, 'environments'), { recursive: true });

      const store = new ArchitectureStore({ baseDir: testDir });
      const result = await store.init({ repair: true });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.message).toContain('Repair complete');
      expect(result.data.skipped.length).toBeGreaterThan(0);
      expect(result.data.created.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Performance
  // ==========================================================================

  describe('Performance', () => {
    it('should complete in less than 500ms', async () => {
      const store = new ArchitectureStore({ baseDir: testDir });

      const start = performance.now();
      await store.init();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
