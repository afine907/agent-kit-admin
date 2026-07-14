/**
 * ConfigManager 工具测试
 *
 * 测试场景:
 * - token 读写
 * - isLoggedIn 状态
 * - installed_packages 管理
 * - workspace scope 管理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ConfigManager, recoverConfig } from '../../src/config/manager';

describe('ConfigManager', () => {
  let tempDir: string;
  let configPath: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-config-test-'));
    configPath = path.resolve(tempDir, 'config.json');
    manager = new ConfigManager(configPath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('token management', () => {
    it('should get undefined token initially', () => {
      expect(manager.getToken()).toBeUndefined();
    });

    it('should set and get token', () => {
      manager.setToken('test-token-123');
      expect(manager.getToken()).toBe('test-token-123');
    });

    it('should set updated_at when setting token', () => {
      manager.setToken('test-token');
      expect(manager.get('updated_at')).toBeDefined();
    });

    it('should clear token on clearAuth', () => {
      manager.setToken('test-token');
      manager.setRefreshToken('refresh');
      manager.clearAuth();
      expect(manager.getToken()).toBeUndefined();
      expect(manager.getRefreshToken()).toBeUndefined();
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when no token', () => {
      expect(manager.isLoggedIn()).toBe(false);
    });

    it('should return true when token exists', () => {
      manager.setToken('valid-token');
      expect(manager.isLoggedIn()).toBe(true);
    });
  });

  describe('user management', () => {
    it('should get undefined user initially', () => {
      expect(manager.getUser()).toBeUndefined();
    });

    it('should set and get user', () => {
      const user = { id: '1', username: 'testuser', display_name: 'Test User' };
      manager.setUser(user);
      expect(manager.getUser()).toEqual(user);
    });

    it('should delete user when setUser(null)', () => {
      manager.setUser({ id: '1', username: 'test', display_name: 'T' });
      manager.setUser(null);
      expect(manager.getUser()).toBeUndefined();
    });
  });

  describe('registry management', () => {
    it('should get default registry', () => {
      expect(manager.getRegistry()).toBe('http://localhost');
    });

    it('should set custom registry', () => {
      manager.setRegistry('https://custom.registry.com');
      expect(manager.getRegistry()).toBe('https://custom.registry.com');
    });
  });

  describe('installed packages', () => {
    it('should return empty array initially', () => {
      expect(manager.getInstalledPackages()).toEqual([]);
    });

    it('should add a package', () => {
      const pkg = {
        name: 'test-pkg',
        full_name: '@test/test-pkg',
        scope: 'test',
        version: '1.0.0',
        type: 'mcp',
        agent: 'claude',
        installed_at: '2024-01-01',
      };
      manager.addInstalledPackage(pkg);
      expect(manager.getInstalledPackages()).toHaveLength(1);
      expect(manager.getInstalledPackages()[0].full_name).toBe('@test/test-pkg');
    });

    it('should update existing package', () => {
      const pkg = {
        name: 'test-pkg',
        full_name: '@test/test-pkg',
        scope: 'test',
        version: '1.0.0',
        type: 'mcp',
        agent: 'claude',
        installed_at: '2024-01-01',
      };
      manager.addInstalledPackage(pkg);
      manager.addInstalledPackage({ ...pkg, version: '2.0.0' });
      expect(manager.getInstalledPackages()).toHaveLength(1);
      expect(manager.getInstalledPackages()[0].version).toBe('2.0.0');
    });

    it('should remove a package', () => {
      const pkg = {
        name: 'test-pkg',
        full_name: '@test/test-pkg',
        scope: 'test',
        version: '1.0.0',
        type: 'mcp',
        agent: 'claude',
        installed_at: '2024-01-01',
      };
      manager.addInstalledPackage(pkg);
      manager.removeInstalledPackage('@test/test-pkg');
      expect(manager.getInstalledPackages()).toHaveLength(0);
    });

    it('should update a package', () => {
      const pkg = {
        name: 'test-pkg',
        full_name: '@test/test-pkg',
        scope: 'test',
        version: '1.0.0',
        type: 'mcp',
        agent: 'claude',
        installed_at: '2024-01-01',
      };
      manager.addInstalledPackage(pkg);
      manager.updateInstalledPackage('@test/test-pkg', { version: '1.1.0' });
      expect(manager.getInstalledPackages()[0].version).toBe('1.1.0');
    });
  });

  describe('workspace management', () => {
    it('should return null initially', () => {
      expect(manager.getWorkspace()).toBeNull();
    });

    it('should set and get workspace', () => {
      manager.setWorkspace('@test-team');
      expect(manager.getWorkspace()).toBe('@test-team');
    });

    it('should clear workspace', () => {
      manager.setWorkspace('@test-team');
      manager.clearWorkspace();
      expect(manager.getWorkspace()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to defaults', () => {
      manager.setToken('token');
      manager.setRegistry('https://custom.com');
      manager.addInstalledPackage({
        name: 'pkg', full_name: '@test/pkg', scope: 'test',
        version: '1.0.0', type: 'mcp', agent: 'claude', installed_at: '2024-01-01',
      });
      manager.reset();
      expect(manager.getToken()).toBeUndefined();
      expect(manager.getRegistry()).toBe('http://localhost');
      expect(manager.getInstalledPackages()).toEqual([]);
    });
  });
});

describe('recoverConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-recover-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return recovered=false for valid JSON', async () => {
    const configPath = path.join(tempDir, 'valid.json');
    await fs.writeFile(configPath, '{"token": "abc"}', 'utf-8');
    const result = await recoverConfig(configPath);
    expect(result.recovered).toBe(false);
  });

  it('should recover corrupted JSON', async () => {
    const configPath = path.join(tempDir, 'corrupt.json');
    await fs.writeFile(configPath, '{ broken json }', 'utf-8');
    const result = await recoverConfig(configPath);
    expect(result.recovered).toBe(true);
    expect(result.backupPath).toBeDefined();
    const content = await fs.readFile(configPath, 'utf-8');
    expect(content).toBe('{}');
  });

  it('should return recovered=false for non-existent file', async () => {
    const result = await recoverConfig('/nonexistent/path/config.json');
    expect(result.recovered).toBe(false);
  });
});
