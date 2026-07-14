import { describe, it, expect } from 'vitest';
import * as loginModule from '../../src/commands/login';

describe('login command exports', () => {
  it('exports loginCommand', () => {
    expect((loginModule as any).loginCommand).toBeDefined();
  });

  it('loginCommand has name login', () => {
    const cmd = (loginModule as any).loginCommand;
    expect(cmd.name()).toBe('login');
  });

  it('loginCommand has an action handler', () => {
    const cmd = (loginModule as any).loginCommand;
    expect(cmd._actionHandler).toBeDefined();
  });

  it('loginCommand has --registry option', () => {
    const cmd = (loginModule as any).loginCommand;
    const opts = cmd.options.map((o: any) => o.long);
    expect(opts).toContain('--registry');
  });

  it('loginCommand has --email option', () => {
    const cmd = (loginModule as any).loginCommand;
    const opts = cmd.options.map((o: any) => o.long);
    expect(opts).toContain('--email');
  });

  it('loginCommand has --password option', () => {
    const cmd = (loginModule as any).loginCommand;
    const opts = cmd.options.map((o: any) => o.long);
    expect(opts).toContain('--password');
  });

  it('loginCommand has --provider option', () => {
    const cmd = (loginModule as any).loginCommand;
    const opts = cmd.options.map((o: any) => o.long);
    expect(opts).toContain('--provider');
  });
});
