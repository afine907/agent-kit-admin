import { describe, it, expect } from 'vitest';
import * as tokenModule from '../../src/commands/token';

describe('token command exports', () => {
  it('exports tokenCommand', () => {
    expect((tokenModule as any).tokenCommand).toBeDefined();
  });

  it('tokenCommand has configure chain', () => {
    const cmd = (tokenModule as any).tokenCommand;
    expect(cmd.name()).toBe('token');
  });

  it('tokenCommand has create subcommand', () => {
    const cmd = (tokenModule as any).tokenCommand;
    const createCmd = cmd.commands.find((c: any) => c.name() === 'create');
    expect(createCmd).toBeDefined();
    expect(createCmd.description()).toBe('创建新的 API Key');
  });

  it('tokenCommand has list subcommand', () => {
    const cmd = (tokenModule as any).tokenCommand;
    const listCmd = cmd.commands.find((c: any) => c.name() === 'list');
    expect(listCmd).toBeDefined();
    expect(listCmd.description()).toBe('列出所有 API Key');
  });

  it('tokenCommand has delete subcommand', () => {
    const cmd = (tokenModule as any).tokenCommand;
    const deleteCmd = cmd.commands.find((c: any) => c.name() === 'delete');
    expect(deleteCmd).toBeDefined();
    expect(deleteCmd.description()).toBe('删除指定 API Key');
  });
});
