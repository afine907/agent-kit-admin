/**
 * akit workspace 命令
 *
 * 管理 CLI workspace 上下文
 * - akit workspace          # 显示当前 workspace
 * - akit workspace list    # 列出所有可用 workspace
 * - akit workspace use     # 使用指定 workspace
 * - akit workspace clear   # 清除 workspace
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';

const workspaceCommand = new Command('workspace')
  .description('管理工作空间上下文')
  .action(() => {
    // 默认显示当前 workspace
    const current = configManager.getWorkspace();
    if (current) {
      console.log(chalk.bold(`当前 workspace: ${current}`));
    } else {
      const username = configManager.getUser()?.username;
      console.log(chalk.gray('未设置 workspace'));
      console.log(chalk.gray(`默认范围: @${username || 'unknown'}`));
    }
  });

// workspace list - 列出所有可用 workspace
workspaceCommand
  .command('list')
  .description('列出所有可用 workspace')
  .action(async () => {
    const user = configManager.getUser();
    if (!user) {
      console.error(chalk.red('\n✖ 未登录。请先运行: akit login'));
      process.exit(1);
    }

    const current = configManager.getWorkspace();

    // 显示个人 workspace
    console.log(chalk.bold('\n个人空间'));
    const personal = `@${user.username}`;
    console.log(
      current === personal
        ? chalk.green(`  ${personal} (当前)`)
        : chalk.gray(`  ${personal}`)
    );

    // 显示团队 workspace
    console.log(chalk.bold('\n团队空间'));

    // 获取用户团队
    try {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录'));
        process.exit(1);
      }
      apiClient.setToken(token);
      const teams = await apiClient.listTeams();
      if (teams.length === 0) {
        console.log(chalk.gray('  暂无团队'));
      } else {
        for (const team of teams) {
          const ws = `@${team.slug}`;
          console.log(
            current === ws
              ? chalk.green(`  ${ws} - ${team.name} (当前)`)
              : chalk.gray(`  ${ws} - ${team.name}`)
          );
        }
      }
    } catch (error) {
      console.log(chalk.gray('  无法获取团队列表'));
    }

    console.log('');
  });

// workspace use - 切换 workspace
workspaceCommand
  .command('use <scope>')
  .description('切换到指定 workspace')
  .action((scope: string) => {
    // 验证 scope 格式
    if (!scope.startsWith('@')) {
      scope = '@' + scope;
    }

    const user = configManager.getUser();
    const username = user?.username;

    // 简单验证：如果是团队 scope，不做额外检查（由服务端验证权限）
    configManager.setWorkspace(scope);
    console.log(chalk.green(`\n✔ 已切换到 workspace: ${scope}`));
    console.log(chalk.gray('  发布时将默认使用此范围'));
    console.log('');
  });

// workspace clear - 清除 workspace
workspaceCommand
  .command('clear')
  .description('清除 workspace，恢复默认行为')
  .action(() => {
    configManager.clearWorkspace();
    console.log(chalk.green('\n✔ 已清除 workspace'));
    console.log(chalk.gray('  发布时将使用 @username 作为默认范围'));
    console.log('');
  });

export { workspaceCommand };
