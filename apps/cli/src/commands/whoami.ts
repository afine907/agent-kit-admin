/**
 * akit whoami 命令 - 显示当前登录用户
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';

export const whoamiCommand = new Command('whoami')
  .description('显示当前登录用户')
  .action(async () => {
    try {
      const token = configManager.getToken();

      if (!token) {
        console.log(chalk.yellow('\n⚠ 未登录，请先运行 akit login\n'));
        process.exit(1);
      }

      // 尝试从 API 获取最新用户信息
      try {
        apiClient.setToken(token);
        const user = await apiClient.getMe();
        configManager.setUser({
          id: user.id,
          username: user.username,
          display_name: user.display_name,
        });

        console.log(chalk.green(`\n✔ 登录为 ${user.username} (${user.display_name})\n`));
      } catch {
        // API 调用失败，使用本地缓存
        const user = configManager.getUser();
        if (user) {
          console.log(chalk.green(`\n✔ 登录为 ${user.username} (${user.display_name})\n`));
          console.log(chalk.gray('  (无法连接到服务器，显示本地缓存信息)'));
        } else {
          console.log(chalk.yellow('\n⚠ 无法获取用户信息，请尝试重新登录\n'));
          process.exit(1);
        }
      }

      const registry = configManager.getRegistry();
      console.log(chalk.gray(`  Registry: ${registry}`));
      console.log('');
    } catch (error: any) {
      console.error(chalk.red(`\n✖ 获取用户信息失败: ${error.message}`));
      process.exit(1);
    }
  });
