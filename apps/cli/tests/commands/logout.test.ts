import { describe, it, expect } from 'vitest';
import * as logoutModule from '../../src/commands/logout';

describe('logout command exports', () => {
  it('exports logoutCommand', () => {
    expect((logoutModule as any).logoutCommand).toBeDefined();
  });

  it('logoutCommand has name logout', () => {
    const cmd = (logoutModule as any).logoutCommand;
    expect(cmd.name()).toBe('logout');
  });

  it('logoutCommand has an action handler', () => {
    const cmd = (logoutModule as any).logoutCommand;
    expect(cmd._actionHandler).toBeDefined();
  });
});
