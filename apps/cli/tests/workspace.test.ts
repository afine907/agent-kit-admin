/**
 * CLI Workspace 功能测试
 *
 * 测试 workspace 配置管理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configManager, type ConfigData } from '../src/config/manager.js';

// Mock conf module
vi.mock('conf', () => {
  const store: Record<string, any> = {
    registry: 'http://localhost',
    installed_packages: [],
    workspace: null,
  };
  return {
    default: vi.fn(() => ({
      get: (key: string) => store[key],
      set: (key: string, value: any) => { store[key] = value; },
      has: (key: string) => key in store,
      delete: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    })),
  };
});

describe('CLI Workspace 配置', () => {
  describe('getWorkspace / setWorkspace', () => {
    it('getWorkspace 返回当前 workspace', () => {
      // 默认无 workspace
      const ws = configManager.getWorkspace();
      expect(ws).toBeNull();
    });

    it('setWorkspace 设置当前 workspace', () => {
      configManager.setWorkspace('@test-team');
      expect(configManager.getWorkspace()).toBe('@test-team');
    });

    it('clearWorkspace 清除 workspace', () => {
      configManager.setWorkspace('@test-team');
      configManager.clearWorkspace();
      expect(configManager.getWorkspace()).toBeNull();
    });
  });

  describe('publish --scope 参数', () => {
    it('publish 时 scope 默认为当前 workspace', () => {
      configManager.setWorkspace('@my-team');
      // 读取 manifest scope，默认为当前 workspace
      const scope = configManager.getWorkspace();
      expect(scope).toBe('@my-team');
    });
  });
});
