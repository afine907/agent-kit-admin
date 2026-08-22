/**
 * akit login 命令 - 本地登录
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { t } from '../i18n.js';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';


export const loginCommand = new Command('login')
  .description(t('commands:login.description'))
  .option('--registry <url>', 'Registry URL')
  .option('--email <email>', t('commands:login.email'))
  .option('--password <password>', t('commands:login.password'))
  .action(async (options) => {
    try {
      if (options.registry) {
        configManager.setRegistry(options.registry);
        apiClient.setToken('');
      }

      console.log(chalk.bold(`\n${t('commands:login.title')}\n`));

      await localLogin(options);
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ ${t('commands:login.loginFailed')}: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

interface LocalLoginOptions {
  email?: string;
  password?: string;
}

async function localLogin(options: LocalLoginOptions) {
  let email = options.email;
  let password = options.password;

  if (!email || !password) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: t('commands:login.email'),
        when: !email,
        validate: (input) => input.includes('@') || t('commands:login.emailValidation'),
      },
      {
        type: 'password',
        name: 'password',
        message: t('commands:login.password'),
        when: !password,
        validate: (input) => input.length >= 8 || t('commands:login.passwordValidation'),
      },
    ]);
    email = email || answers.email;
    password = password || answers.password;
  }

  const spinner = ora(t('commands:login.loggingIn')).start();

  try {
    const result = await apiClient.login(email!, password!);
    spinner.succeed(t('commands:login.loginSuccess'));

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

    console.log(chalk.green(`\n✔ ${t('commands:login.loginSuccessTitle')}\n`));
    console.log(chalk.gray(`  ${t('commands:login.user')}: ${result.user.username}`));
    console.log(chalk.gray(`  ${t('commands:login.role')}: ${result.user.role || 'member'}`));
    console.log(chalk.gray(`  ${t('commands:login.tokenSaved')}: ${configManager.getConfigPath()}`));
    console.log('');
  } catch (error: unknown) {
    spinner.fail(t('commands:login.loginFailed'));
    throw error;
  }
}
