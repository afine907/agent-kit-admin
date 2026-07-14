import { describe, it, expect, vi, beforeEach } from 'vitest';
import { diffManifests } from '../../src/commands/info';
import * as installModule from '../../src/commands/install';
import * as listModule from '../../src/commands/list';
import * as searchModule from '../../src/commands/search';
import { apiClient } from '../../src/api/client';

const mockSpinner = { start: vi.fn(), succeed: vi.fn(), fail: vi.fn(), text: '' };

describe('diffManifests', () => {
  it('detects added keys', () => {
    const diff = diffManifests({ name: 'pkg' }, { name: 'pkg', description: 'desc' });
    expect(diff.added).toContain('description');
  });

  it('detects removed keys', () => {
    const diff = diffManifests({ name: 'pkg', description: 'desc' }, { name: 'pkg' });
    expect(diff.removed).toContain('description');
  });

  it('detects changed keys', () => {
    const diff = diffManifests({ command: 'node old.js' }, { command: 'node new.js' });
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].key).toBe('command');
    expect(diff.changed[0].breaking).toBe(true);
  });

  it('ignores version changes', () => {
    const diff = diffManifests({ version: '1.0.0' }, { version: '2.0.0' });
    expect(diff.changed).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('detects nested changes', () => {
    const diff = diffManifests(
      { config: { timeout: 30 } },
      { config: { timeout: 60 } },
    );
    expect(diff.changed.some(c => c.key === 'config.timeout')).toBe(true);
  });

  it('marks transport changes as breaking', () => {
    const diff = diffManifests({ transport: 'stdio' }, { transport: 'http' });
    expect(diff.changed[0].breaking).toBe(true);
  });
});

describe('install command exports', () => {
  it('exports installCommand', () => {
    expect((installModule as any).installCommand).toBeDefined();
  });
});

describe('list command exports', () => {
  it('exports listCommand', () => {
    expect((listModule as any).listCommand).toBeDefined();
  });
});

describe('search command exports', () => {
  it('exports searchCommand', () => {
    expect((searchModule as any).searchCommand).toBeDefined();
  });
});
