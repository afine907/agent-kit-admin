/**
 * akit team 命令 - 团队管理
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';
import { t } from '../i18n.js';

export const teamCommand = new Command('team')
  .description(t('commands:team.description') || '团队管理')
  .addCommand(buildInviteCommand())
  .addCommand(buildJoinCommand())
  .addCommand(buildMembersCommand())
  .addCommand(buildRoleCommand())
  .addCommand(buildSettingsCommand())
  .addCommand(buildListCommand())
  .addCommand(buildLeaveCommand());

// akit team invite <team-name> — 生成邀请链接
function buildInviteCommand(): Command {
  return new Command('invite')
    .description('生成团队邀请链接')
    .argument('<team-name>', '团队名称')
    .option('--role <role>', '邀请角色', 'member')
    .option('--expires-in <hours>', '过期时间（小时）', '72')
    .action(async (teamName: string, options) => {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);
      const spinner = ora('正在查找团队 ' + teamName + '...').start();
      try {
        const team = await apiClient.getTeamByName(teamName);
        spinner.text = '正在生成邀请链接...';
        const expiresHours = parseInt(options.expiresIn, 10);
        if (isNaN(expiresHours) || expiresHours <= 0) {
          spinner.fail('无效的过期时间');
          console.error(chalk.red('过期时间必须是正整数（小时）\n'));
          process.exit(1);
        }
        const invite = await apiClient.createTeamInvite(team.id);
        const registry = configManager.getRegistry().replace(/\/$/, '');
        const inviteUrl = registry + '/join?token=' + invite.invite_code;
        spinner.succeed('已为团队 ' + chalk.bold(team.name) + ' 生成邀请链接');
        console.log('\n' + chalk.green('✔ 邀请链接（' + options.role + '，' + options.expiresIn + 'h 过期）'));
        console.log('  ' + chalk.cyan(inviteUrl) + '\n');
        console.log(chalk.gray('邀请码: ' + invite.invite_code));
        console.log(chalk.gray('过期时间: ' + invite.expires_at + '\n'));
      } catch (err: unknown) {
        spinner.fail('查找团队失败');
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not found') || msg.includes('404')) {
          console.error(chalk.red('\n✖ 找不到团队: ' + teamName + '\n'));
        } else {
          console.error(chalk.red('\n✖ ' + msg + '\n'));
        }
        process.exit(1);
      }
    });
}

// akit team join <token> — 加入团队
function buildJoinCommand(): Command {
  return new Command('join')
    .description('通过邀请码加入团队')
    .argument('<token>', '邀请码')
    .action(async (token: string) => {
      const currentToken = configManager.getToken();
      if (!currentToken) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(currentToken);
      const spinner = ora('正在加入团队...').start();
      try {
        const result = await apiClient.joinTeam(token);
        spinner.succeed(chalk.green('✔ 成功加入团队！'));
        console.log('\n' + chalk.bold('团队信息'));
        console.log('  团队 ID: ' + result.team_id);
        console.log('  角色:    ' + chalk.cyan(result.role) + '\n');
      } catch (err: unknown) {
        spinner.fail('加入团队失败');
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('401') || msg.includes('invalid')) {
          console.error(chalk.red('\n✖ 无效的邀请码，请检查后重试\n'));
        } else if (msg.includes('403') || msg.includes('forbidden')) {
          console.error(chalk.red('\n✖ 没有权限加入此团队\n'));
        } else {
          console.error(chalk.red('\n✖ ' + msg + '\n'));
        }
        process.exit(1);
      }
    });
}

// akit team members <team-name> — 列出成员
function buildMembersCommand(): Command {
  return new Command('members')
    .description('列出团队成员')
    .argument('<team-name>', '团队名称')
    .action(async (teamName: string) => {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);
      const spinner = ora('正在加载团队 ' + teamName + '...').start();
      try {
        const team = await apiClient.getTeamByName(teamName);
        spinner.text = '正在加载成员列表...';
        const members = await apiClient.listTeamMembers(team.id);
        spinner.succeed('团队 ' + chalk.bold(team.name) + ' 的成员 (' + members.length + ')');
        if (members.length === 0) {
          console.log(chalk.yellow('\n暂无成员\n'));
          return;
        }
        console.log('\n' + chalk.bold('USER') + ''.padEnd(20) + chalk.bold('ROLE') + ''.padEnd(12) + chalk.bold('JOINED'));
        console.log(chalk.gray(''.padEnd(60, '─')));
        for (const m of members) {
          const displayName = m.display_name || m.username;
          const roleColor = m.role === 'owner' ? chalk.red : m.role === 'admin' ? chalk.yellow : chalk.green;
          const joined = new Date(m.joined_at).toLocaleDateString('zh-CN');
          console.log(displayName.padEnd(24) + roleColor(m.role.padEnd(12)) + chalk.gray(joined));
        }
        console.log();
      } catch (err: unknown) {
        spinner.fail('加载成员列表失败');
        console.error(chalk.red('\n✖ ' + (err instanceof Error ? err.message : String(err)) + '\n'));
        process.exit(1);
      }
    });
}

// akit team role <user-id> --role <role> --team <team> — 更新成员角色
function buildRoleCommand(): Command {
  return new Command('role')
    .description('更新团队成员角色')
    .argument('<user-id>', '用户 ID')
    .requiredOption('--role <role>', '新角色 (admin|member)')
    .requiredOption('--team <team>', '团队名称')
    .action(async (userId: string, options) => {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);
      const spinner = ora('正在更新角色...').start();
      try {
        const team = await apiClient.getTeamByName(options.team);
        const normalizedRole = options.role.toLowerCase() as 'admin' | 'member';
        await apiClient.updateMemberRole(team.id, userId, normalizedRole);
        spinner.succeed(chalk.green('✔ 角色已更新'));
        console.log('\n  用户:    ' + chalk.cyan(userId));
        console.log('  团队:    ' + team.name);
        console.log('  新角色:  ' + (normalizedRole === 'admin' ? chalk.yellow('Admin') : chalk.green('Member')) + '\n');
      } catch (err: unknown) {
        spinner.fail('更新角色失败');
        console.error(chalk.red('\n✖ ' + (err instanceof Error ? err.message : String(err)) + '\n'));
        process.exit(1);
      }
    });
}

// akit team settings <team-name> [--name X] [--description X] [--avatar X]
function buildSettingsCommand(): Command {
  return new Command('settings')
    .description('查看或更新团队设置')
    .argument('<team-name>', '团队名称')
    .option('--name <name>', '新的团队名称')
    .option('--description <description>', '新的团队描述')
    .option('--avatar <avatar>', '新的头像 URL')
    .action(async (teamName: string, options) => {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);
      const spinner = ora('正在加载团队设置...').start();
      try {
        const team = await apiClient.getTeamByName(teamName);
        if (!options.name && !options.description && !options.avatar) {
          spinner.text = '正在获取当前设置...';
          const settings = await apiClient.getTeamSettings(team.id);
          spinner.stop();
          console.log('\n' + chalk.bold('团队设置') + ': ' + chalk.cyan(team.name));
          console.log(chalk.gray(''.padEnd(40, '─')));
          console.log('  名称:        ' + settings.name);
          console.log('  描述:        ' + (settings.description || chalk.gray('(无)')));
          console.log('  头像:        ' + (settings.avatar_url || chalk.gray('(无)')) + '\n');
          return;
        }
        spinner.text = '正在更新设置...';
        const updateData: { name?: string; description?: string; avatar_url?: string } = {};
        if (options.name) updateData.name = options.name;
        if (options.description) updateData.description = options.description;
        if (options.avatar) updateData.avatar_url = options.avatar;
        const updated = await apiClient.updateTeamSettings(team.id, updateData);
        spinner.succeed(chalk.green('✔ 团队设置已更新'));
        console.log('\n' + chalk.bold('更新后的设置'));
        console.log('  名称:  ' + chalk.cyan(updated.name));
        if (updated.description) console.log('  描述:  ' + updated.description);
        if (updated.avatar_url) console.log('  头像:  ' + updated.avatar_url);
        console.log();
      } catch (err: unknown) {
        spinner.fail('更新团队设置失败');
        console.error(chalk.red('\n✖ ' + (err instanceof Error ? err.message : String(err)) + '\n'));
        process.exit(1);
      }
    });
}

// akit team list — 列出我所在的团队
function buildListCommand(): Command {
  return new Command('list')
    .description('列出我所在的团队')
    .action(async () => {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);
      const spinner = ora('正在加载团队列表...').start();
      try {
        const teams = await apiClient.listTeams();
        spinner.succeed('共 ' + teams.length + ' 个团队');
        if (teams.length === 0) {
          console.log(chalk.yellow('\n你还没有加入任何团队。运行 akit team invite <team> 邀请成员。\n'));
          return;
        }
        console.log('\n' + chalk.bold('NAME') + ''.padEnd(20) + chalk.bold('SLUG') + ''.padEnd(16) + chalk.bold('MEMBERS') + ''.padEnd(8) + chalk.bold('CREATED'));
        console.log(chalk.gray(''.padEnd(70, '─')));
        for (const team of teams) {
          const created = new Date(team.created_at).toLocaleDateString('zh-CN');
          console.log(team.name.padEnd(24) + chalk.cyan(team.slug).padEnd(20) + String(team.member_count).padEnd(12) + chalk.gray(created));
        }
        console.log();
      } catch (err: unknown) {
        spinner.fail('加载团队列表失败');
        console.error(chalk.red('\n✖ ' + (err instanceof Error ? err.message : String(err)) + '\n'));
        process.exit(1);
      }
    });
}

// akit team leave <team-name> — 离开团队
function buildLeaveCommand(): Command {
  return new Command('leave')
    .description('离开团队')
    .argument('<team-name>', '团队名称')
    .action(async (teamName: string) => {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);
      const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
        { type: 'confirm', name: 'confirmed', message: '确定要离开团队 ' + teamName + ' 吗？', default: false },
      ]);
      if (!confirmed) {
        console.log(chalk.yellow('\n已取消。\n'));
        return;
      }
      const spinner = ora('正在离开团队...').start();
      try {
        const team = await apiClient.getTeamByName(teamName);
        // 调用后端 DELETE /teams/{team_id}/members/self 删除自己
        await apiClient.removeTeamMember(team.id, 'self');
        spinner.succeed(chalk.green('✔ 已离开团队'));
        console.log(chalk.bold('\n  你已离开 ' + teamName + '\n'));
      } catch (err: unknown) {
        spinner.fail('离开团队失败');
        console.error(chalk.red('\n✖ ' + (err instanceof Error ? err.message : String(err)) + '\n'));
        process.exit(1);
      }
    });
}
