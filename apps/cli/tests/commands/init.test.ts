import { describe, it, expect } from 'vitest';
import * as initModule from '../../src/commands/init';

describe('init command exports', () => {
  it('exports initCommand', () => {
    expect((initModule as any).initCommand).toBeDefined();
  });

  it('initCommand has name init', () => {
    const cmd = (initModule as any).initCommand;
    expect(cmd.name()).toBe('init');
  });

  it('initCommand has an action handler', () => {
    const cmd = (initModule as any).initCommand;
    expect(cmd._actionHandler).toBeDefined();
  });

  it('initCommand has --name option', () => {
    const cmd = (initModule as any).initCommand;
    const opts = cmd.options.map((o: any) => o.long);
    expect(opts).toContain('--name');
  });

  it('initCommand has --type option', () => {
    const cmd = (initModule as any).initCommand;
    const opts = cmd.options.map((o: any) => o.long);
    expect(opts).toContain('--type');
  });

  it('initCommand has --yes option', () => {
    const cmd = (initModule as any).initCommand;
    const opts = cmd.options.map((o: any) => o.long);
    expect(opts).toContain('--yes');
  });
});
