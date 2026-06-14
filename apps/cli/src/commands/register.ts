/**
 * akit register 命令 - 本地注册
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';

export const registerCommand = new Command('register')
  .description('注册新账号')
  .option('--registry <url>', 'Registry URL')
  .option('--username <username>', '用户名')
  .option('--email <email>', '邮箱')
  .option('--password <password>', '密码')
  .option('--display-name <name>', '显示名称')
  .action(async (options) => {
    try {
      // 设置 registry
      if (options.registry) {
        configManager.setRegistry(options.registry);
        apiClient.setToken('');
      }

      console.log(chalk.bold('\n📝 Agent Kit Admin - 注册新账号\n'));

      // 收集注册信息
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: '用户名:',
          when: !options.username,
          validate: (input) => {
            if (input.length < 3) return '用户名至少 3 个字符';
            if (!/^[a-zA-Z0-9_-]+$/.test(input)) return '用户名只能包含字母、数字、下划线和连字符';
            return true;
          },
        },
        {
          type: 'input',
          name: 'email',
          message: '邮箱:',
          when: !options.email,
          validate: (input) => input.includes('@') || '请输入有效的邮箱',
        },
        {
          type: 'password',
          name: 'password',
          message: '密码:',
          when: !options.password,
          validate: (input) => input.length >= 8 || '密码至少 8 位',
        },
        {
          type: 'input',
          name: 'displayName',
          message: '显示名称 (可选):',
          when: !options.displayName,
        },
      ]);

      const username = options.username || answers.username;
      const email = options.email || answers.email;
      const password = options.password || answers.password;
      const displayName = options.displayName || answers.displayName || username;

      const spinner = ora('正在注册...').start();

      try {
        const result = await apiClient.register(username, email, password, displayName);
        spinner.succeed('注册成功');

        // 保存 token 和用户信息
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

        // 显示成功信息
        console.log(chalk.green('\n✔ 注册成功!\n'));
        console.log(chalk.gray(`  用户: ${result.user.username}`));
        console.log(chalk.gray(`  邮箱: ${result.user.email || '-'}`));
        console.log(chalk.gray(`  Token 已保存到: ${configManager.getConfigPath()}`));
        console.log('');
      } catch (error: unknown) {
        spinner.fail('注册失败');
        throw error;
      }
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ 注册失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
