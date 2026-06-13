/**
 * akit logout 命令 - 登出
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { configManager } from '../config/manager.js';

export const logoutCommand = new Command('logout')
  .description('登出当前用户')
  .action(async () => {
    try {
      const user = configManager.getUser();

      if (!user && !configManager.getToken()) {
        console.log(chalk.yellow('\n⚠ 当前未登录\n'));
        return;
      }

      // 清除 token 和用户信息
      configManager.setToken('');
      configManager.setUser(null);

      console.log(chalk.green('\n✔ 已登出\n'));
      if (user) {
        console.log(chalk.gray(`  用户 ${user.username} 已登出`));
      }
      console.log('');
    } catch (error: any) {
      console.error(chalk.red(`\n✖ 登出失败: ${error.message}`));
      process.exit(1);
    }
  });
