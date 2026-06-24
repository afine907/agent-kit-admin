/**
 * akit register 命令 - 本地注册
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { i18n } from '../i18n.js';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';

const t = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options) as string;

export const registerCommand = new Command('register')
  .description(t('commands:register.description'))
  .option('--registry <url>', 'Registry URL')
  .option('--username <username>', t('commands:register.username'))
  .option('--email <email>', t('commands:register.email'))
  .option('--password <password>', t('commands:register.password'))
  .option('--display-name <name>', t('commands:register.displayName'))
  .action(async (options) => {
    try {
      if (options.registry) {
        configManager.setRegistry(options.registry);
        apiClient.setToken('');
      }

      console.log(chalk.bold(`\n${t('commands:register.title')}\n`));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: t('commands:register.username'),
          when: !options.username,
          validate: (input) => {
            if (input.length < 3) return t('commands:register.usernameMinLength');
            if (!/^[a-zA-Z0-9_-]+$/.test(input)) return t('commands:register.usernamePattern');
            return true;
          },
        },
        {
          type: 'input',
          name: 'email',
          message: t('commands:register.email'),
          when: !options.email,
          validate: (input) => input.includes('@') || t('commands:register.emailValidation'),
        },
        {
          type: 'password',
          name: 'password',
          message: t('commands:register.password'),
          when: !options.password,
          validate: (input) => input.length >= 8 || t('commands:register.passwordValidation'),
        },
        {
          type: 'input',
          name: 'displayName',
          message: t('commands:register.displayName'),
          when: !options.displayName,
        },
      ]);

      const username = options.username || answers.username;
      const email = options.email || answers.email;
      const password = options.password || answers.password;
      const displayName = options.displayName || answers.displayName || username;

      const spinner = ora(t('commands:register.registering')).start();

      try {
        const result = await apiClient.register(username, email, password, displayName);
        spinner.succeed(t('commands:register.registerSuccess'));

        configManager.setToken(result.token);
        if (result.refresh_token) {
          configManager.setRefreshToken(result.refresh_token);
        }
        configManager.setUser({
          id: result.user.id,
          username: result.user.username,
          display_name: result.user.display_name || result.user.username,
          role: result.user.role,
        });

        console.log(chalk.green(`\n✔ ${t('commands:register.registerSuccess')}\n`));
        console.log(chalk.gray(`  ${t('commands:register.user')}: ${result.user.username}`));
        if (result.user.username !== username) {
          console.log(chalk.gray(`  ${t('commands:register.originalUsername')}: ${username}`));
          console.log(chalk.yellow(`  ⚠ ${t('commands:register.usernameAdjusted')}`));
        }
        console.log(chalk.gray(`  ${t('commands:login.tokenSaved')}: ${configManager.getConfigPath()}`));
        console.log('');
      } catch (error: unknown) {
        spinner.fail(t('commands:register.registerFailed'));
        throw error;
      }
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ ${t('commands:register.registerFailed')}: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
