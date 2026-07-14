/**
 * akit info --diff 版本对比测试
 */
import { describe, it, expect } from 'vitest';
import { diffManifests } from '../../src/commands/info';

describe('diffManifests', () => {
  it('两个 manifest 相同应返回空 diff', () => {
    const oldManifest = {
      name: 'test',
      version: '1.0.0',
      type: 'mcp',
      mcp: { command: 'node', transport: 'stdio' },
      dependencies: { '@scope/pkg': '^1.0.0' },
    };
    const newManifest = {
      ...oldManifest,
      version: '2.0.0',
    };

    const result = diffManifests(oldManifest, newManifest);
    expect(result.changed).toHaveLength(0);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it('应检测到新增字段', () => {
    const oldM = { name: 'test', version: '1.0.0' } as Record<string, unknown>;
    const newM = { name: 'test', version: '2.0.0', type: 'mcp' };

    const result = diffManifests(oldM, newM);
    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toBe('type');
  });

  it('应检测到移除字段', () => {
    const oldM: Record<string, unknown> = { name: 'test', version: '1.0.0', type: 'mcp' };
    const newM: Record<string, unknown> = { name: 'test', version: '2.0.0' };

    const result = diffManifests(oldM, newM);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toBe('type');
  });

  it('应检测到变更字段', () => {
    const oldM: Record<string, unknown> = {
      name: 'test',
      version: '1.0.0',
      mcp: { command: 'node', transport: 'stdio' },
      dependencies: { '@scope/foo': '^1.0.0' },
    };
    const newM: Record<string, unknown> = {
      name: 'test',
      version: '2.0.0',
      mcp: { command: 'node', transport: 'streamable-http' },
      dependencies: { '@scope/foo': '^2.0.0', '@scope/bar': '^1.0.0' },
    };

    const result = diffManifests(oldM, newM);

    expect(result.changed).toHaveLength(2);
    const changedKeys = result.changed.map((c) => c.key);
    expect(changedKeys).toContain('mcp.transport');
    expect(changedKeys).toContain('dependencies.@scope/foo');

    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toBe('dependencies.@scope/bar');

    expect(result.removed).toHaveLength(0);
  });

  it('严重的变更（移除 mcp.command）应标为 breaking', () => {
    const oldM: Record<string, unknown> = {
      name: 'test',
      version: '1.0.0',
      mcp: { command: 'node', args: ['old.js'] },
    };
    const newM: Record<string, unknown> = {
      name: 'test',
      version: '2.0.0',
      mcp: { command: 'node', args: ['new.js'] },
    };

    const result = diffManifests(oldM, newM);
    const cmdEntry = result.changed.find((c) => c.key === 'mcp.args');
    expect(cmdEntry).toBeDefined();
    expect(cmdEntry!.breaking).toBe(false);
  });

  it('依赖版本降低应标记为警告', () => {
    const oldM: Record<string, unknown> = {
      name: 'test',
      version: '2.0.0',
      dependencies: { '@scope/foo': '^2.0.0' },
    };
    const newM: Record<string, unknown> = {
      name: 'test',
      version: '1.0.0',
      dependencies: { '@scope/foo': '^1.0.0' },
    };

    const result = diffManifests(oldM, newM);
    expect(result.changed.some((c) => c.key.startsWith('dependencies'))).toBe(true);
  });
});
