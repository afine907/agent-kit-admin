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
      type: 'skill',
      skill: { content: '## Skill', trigger: 'keyword' },
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
    const newM = { name: 'test', version: '2.0.0', type: 'skill' };

    const result = diffManifests(oldM, newM);
    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toBe('type');
  });

  it('应检测到移除字段', () => {
    const oldM: Record<string, unknown> = { name: 'test', version: '1.0.0', type: 'skill' };
    const newM: Record<string, unknown> = { name: 'test', version: '2.0.0' };

    const result = diffManifests(oldM, newM);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toBe('type');
  });

  it('应检测到变更字段', () => {
    const oldM: Record<string, unknown> = {
      name: 'test',
      version: '1.0.0',
      skill: { content: '## Skill', trigger: 'keyword' },
      dependencies: { '@scope/foo': '^1.0.0' },
    };
    const newM: Record<string, unknown> = {
      name: 'test',
      version: '2.0.0',
      skill: { content: '## Skill', trigger: 'new-keyword' },
      dependencies: { '@scope/foo': '^2.0.0', '@scope/bar': '^1.0.0' },
    };

    const result = diffManifests(oldM, newM);

    expect(result.changed).toHaveLength(2);
    const changedKeys = result.changed.map((c) => c.key);
    expect(changedKeys).toContain('skill.trigger');
    expect(changedKeys).toContain('dependencies.@scope/foo');

    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toBe('dependencies.@scope/bar');

    expect(result.removed).toHaveLength(0);
  });

  it('非破坏性变更（skill.content 变更）不应标为 breaking', () => {
    const oldM: Record<string, unknown> = {
      name: 'test',
      version: '1.0.0',
      skill: { content: 'old content' },
    };
    const newM: Record<string, unknown> = {
      name: 'test',
      version: '2.0.0',
      skill: { content: 'new content' },
    };

    const result = diffManifests(oldM, newM);
    const contentEntry = result.changed.find((c) => c.key === 'skill.content');
    expect(contentEntry).toBeDefined();
    expect(contentEntry!.breaking).toBe(false);
  });

  it('破坏性变更（skill.trigger 变更）应标为 breaking', () => {
    const oldM: Record<string, unknown> = {
      name: 'test',
      version: '1.0.0',
      skill: { content: '## Skill', trigger: 'keyword' },
    };
    const newM: Record<string, unknown> = {
      name: 'test',
      version: '2.0.0',
      skill: { content: '## Skill', trigger: 'new-keyword' },
    };

    const result = diffManifests(oldM, newM);
    const triggerEntry = result.changed.find((c) => c.key === 'skill.trigger');
    expect(triggerEntry).toBeDefined();
    expect(triggerEntry!.breaking).toBe(true);
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
