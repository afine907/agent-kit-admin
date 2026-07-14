/**
 * akit whoami 命令 - 显示当前登录用户
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { t } from '../i18n.js';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';


export const whoamiCommand = new Command('whoami')
  .description(t('commands:whoami.description'))
  .action(async () => {
    try {
      const token = configManager.getToken();

      if (!token) {
        console.log(chalk.yellow(`\n⚠ ${t('commands:whoami.notLoggedIn')}\n`));
        process.exit(1);
      }

      try {
        apiClient.setToken(token);
        const user = await apiClient.getMe();
        configManager.setUser({
          id: user.id,
          username: user.username,
          display_name: user.display_name,
        });

        console.log(chalk.green(`\n✔ ${t('commands:login.user')}: ${user.username} (${user.display_name})\n`));
      } catch {
        const user = configManager.getUser();
        if (user) {
          console.log(chalk.green(`\n✔ ${t('commands:login.user')}: ${user.username} (${user.display_name})\n`));
          console.log(chalk.gray(`  (${t('commands:whoami.fetchFailed')})`));
        } else {
          console.log(chalk.yellow(`\n⚠ ${t('commands:whoami.notLoggedIn')}\n`));
          process.exit(1);
        }
      }

      const registry = configManager.getRegistry();
      console.log(chalk.gray(`  Registry: ${registry}`));
      console.log('');
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ ${t('commands:whoami.fetchFailed')}: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
