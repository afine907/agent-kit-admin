import { describe, it, expect } from 'vitest';
import * as teamModule from '../../src/commands/team';

describe('team command exports', () => {
  it('exports teamCommand', () => {
    expect((teamModule as any).teamCommand).toBeDefined();
  });

  it('teamCommand has name team', () => {
    const cmd = (teamModule as any).teamCommand;
    expect(cmd.name()).toBe('team');
  });

  it('teamCommand has 7 subcommands', () => {
    const cmd = (teamModule as any).teamCommand;
    expect(cmd.commands.length).toBe(7);
  });

  it('has invite subcommand', () => {
    const cmd = (teamModule as any).teamCommand;
    const names = cmd.commands.map((c: any) => c.name());
    expect(names).toContain('invite');
  });

  it('has join subcommand', () => {
    const cmd = (teamModule as any).teamCommand;
    const names = cmd.commands.map((c: any) => c.name());
    expect(names).toContain('join');
  });

  it('has members subcommand', () => {
    const cmd = (teamModule as any).teamCommand;
    const names = cmd.commands.map((c: any) => c.name());
    expect(names).toContain('members');
  });

  it('has role subcommand', () => {
    const cmd = (teamModule as any).teamCommand;
    const names = cmd.commands.map((c: any) => c.name());
    expect(names).toContain('role');
  });

  it('has settings subcommand', () => {
    const cmd = (teamModule as any).teamCommand;
    const names = cmd.commands.map((c: any) => c.name());
    expect(names).toContain('settings');
  });

  it('has list subcommand', () => {
    const cmd = (teamModule as any).teamCommand;
    const names = cmd.commands.map((c: any) => c.name());
    expect(names).toContain('list');
  });

  it('has leave subcommand', () => {
    const cmd = (teamModule as any).teamCommand;
    const names = cmd.commands.map((c: any) => c.name());
    expect(names).toContain('leave');
  });

  it('invite subcommand has --role option', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const inviteCmd = teamCmd.commands.find((c: any) => c.name() === 'invite');
    const opts = inviteCmd.options.map((o: any) => o.long);
    expect(opts).toContain('--role');
  });

  it('invite subcommand has --expires-in option', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const inviteCmd = teamCmd.commands.find((c: any) => c.name() === 'invite');
    const opts = inviteCmd.options.map((o: any) => o.long);
    expect(opts).toContain('--expires-in');
  });

  it('role subcommand requires --role and --team options', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const roleCmd = teamCmd.commands.find((c: any) => c.name() === 'role');
    const opts = roleCmd.options.map((o: any) => o.long);
    expect(opts).toContain('--role');
    expect(opts).toContain('--team');
  });

  it('settings subcommand has --name, --description, --avatar options', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const settingsCmd = teamCmd.commands.find((c: any) => c.name() === 'settings');
    const opts = settingsCmd.options.map((o: any) => o.long);
    expect(opts).toContain('--name');
    expect(opts).toContain('--description');
    expect(opts).toContain('--avatar');
  });

  it('invite subcommand has action handler', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const inviteCmd = teamCmd.commands.find((c: any) => c.name() === 'invite');
    expect(inviteCmd._actionHandler).toBeDefined();
  });

  it('join subcommand has action handler', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const joinCmd = teamCmd.commands.find((c: any) => c.name() === 'join');
    expect(joinCmd._actionHandler).toBeDefined();
  });

  it('members subcommand has action handler', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const membersCmd = teamCmd.commands.find((c: any) => c.name() === 'members');
    expect(membersCmd._actionHandler).toBeDefined();
  });

  it('role subcommand has action handler', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const roleCmd = teamCmd.commands.find((c: any) => c.name() === 'role');
    expect(roleCmd._actionHandler).toBeDefined();
  });

  it('settings subcommand has action handler', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const settingsCmd = teamCmd.commands.find((c: any) => c.name() === 'settings');
    expect(settingsCmd._actionHandler).toBeDefined();
  });

  it('list subcommand has action handler', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const listCmd = teamCmd.commands.find((c: any) => c.name() === 'list');
    expect(listCmd._actionHandler).toBeDefined();
  });

  it('leave subcommand has action handler', () => {
    const teamCmd = (teamModule as any).teamCommand;
    const leaveCmd = teamCmd.commands.find((c: any) => c.name() === 'leave');
    expect(leaveCmd._actionHandler).toBeDefined();
  });
});
