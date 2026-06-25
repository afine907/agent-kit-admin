/**
 * akit logout 命令 - 登出
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { i18n, t } from '../i18n.js';
import { configManager } from '../config/manager.js';


export const logoutCommand = new Command('logout')
  .description(t('commands:logout.description'))
  .action(async () => {
    try {
      const user = configManager.getUser();

      if (!user && !configManager.getToken()) {
        console.log(chalk.yellow(`\n⚠ ${t('commands:logout.notLoggedIn')}\n`));
        return;
      }

      configManager.setToken('');
      configManager.setUser(null);

      console.log(chalk.green(`\n✔ ${t('commands:logout.logoutSuccess')}\n`));
      if (user) {
        console.log(chalk.gray(`  ${t('commands:login.user')} ${user.username} ${t('commands:logout.logoutSuccess')}`));
      }
      console.log('');
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ ${t('commands:logout.logoutFailed')}: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
