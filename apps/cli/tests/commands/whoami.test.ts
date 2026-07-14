import { describe, it, expect } from 'vitest';
import * as whoamiModule from '../../src/commands/whoami';

describe('whoami command exports', () => {
  it('exports whoamiCommand', () => {
    expect((whoamiModule as any).whoamiCommand).toBeDefined();
  });

  it('whoamiCommand has name whoami', () => {
    const cmd = (whoamiModule as any).whoamiCommand;
    expect(cmd.name()).toBe('whoami');
  });

  it('whoamiCommand has an action handler', () => {
    const cmd = (whoamiModule as any).whoamiCommand;
    expect(cmd._actionHandler).toBeDefined();
  });
});
