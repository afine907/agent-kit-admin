/**
 * akit login 命令 - 支持本地登录和 OAuth 登录
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import express from 'express';
import open from 'open';
import type { Server } from 'http';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';

// OAuth Provider 列表
const OAUTH_PROVIDERS = [
  { name: '企业微信 (WeChat Work)', value: 'wechat_work' },
  { name: '飞书 (Feishu)', value: 'feishu' },
  { name: '钉钉 (DingTalk)', value: 'dingtalk' },
];

// 本地回调服务器端口
const CALLBACK_PORT = 3456;

export const loginCommand = new Command('login')
  .description('登录到 Agent Kit Registry')
  .option('--registry <url>', 'Registry URL')
  .option('--email <email>', '邮箱 (本地登录)')
  .option('--password <password>', '密码 (本地登录)')
  .option('--provider <provider>', 'OAuth Provider (wechat_work/feishu/dingtalk)')
  .action(async (options) => {
    try {
      // 设置 registry
      if (options.registry) {
        configManager.setRegistry(options.registry);
        apiClient.setToken('');
      }

      console.log(chalk.bold('\n🔐 Agent Kit Admin - 登录\n'));

      // 判断登录方式
      let useLocalLogin = options.email && options.password;

      if (!useLocalLogin && !options.provider) {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'method',
            message: '选择登录方式:',
            choices: [
              { name: '邮箱密码登录', value: 'local' },
              { name: 'OAuth 登录 (企业微信/飞书/钉钉)', value: 'oauth' },
            ],
          },
        ]);
        useLocalLogin = answer.method === 'local';
      }

      if (useLocalLogin) {
        // 本地登录
        await localLogin(options);
      } else {
        // OAuth 登录
        await oauthLogin(options);
      }
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ 登录失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

interface LocalLoginOptions {
  email?: string;
  password?: string;
}

interface OAuthLoginOptions {
  provider?: string;
}

async function localLogin(options: LocalLoginOptions) {
  let email = options.email;
  let password = options.password;

  // 交互式输入
  if (!email || !password) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: '邮箱:',
        when: !email,
        validate: (input) => input.includes('@') || '请输入有效的邮箱',
      },
      {
        type: 'password',
        name: 'password',
        message: '密码:',
        when: !password,
        validate: (input) => input.length >= 8 || '密码至少 8 位',
      },
    ]);
    email = email || answers.email;
    password = password || answers.password;
  }

  const spinner = ora('正在登录...').start();

  try {
    const result = await apiClient.login(email, password);
    spinner.succeed('登录成功');

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
    console.log(chalk.green('\n✔ 登录成功!\n'));
    console.log(chalk.gray(`  用户: ${result.user.username}`));
    console.log(chalk.gray(`  角色: ${result.user.role || 'member'}`));
    console.log(chalk.gray(`  Token 已保存到: ${configManager.getConfigPath()}`));
    console.log('');
  } catch (error: unknown) {
    spinner.fail('登录失败');
    throw error;
  }
}

async function oauthLogin(options: OAuthLoginOptions) {
  // 选择 OAuth Provider
  let provider = options.provider;
  if (!provider) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: '选择 OAuth Provider:',
        choices: OAUTH_PROVIDERS,
      },
    ]);
    provider = answer.provider;
  }

  // 验证 provider
  const validProviders = OAUTH_PROVIDERS.map((p) => p.value);
  if (!validProviders.includes(provider)) {
    console.error(chalk.red(`\n✖ 不支持的 Provider: ${provider}`));
    console.log(chalk.gray(`  支持的 Provider: ${validProviders.join(', ')}`));
    process.exit(1);
  }

  const spinner = ora('正在获取 OAuth 授权 URL...').start();

  // 获取 OAuth URL
  let authUrl: string;
  try {
    authUrl = await apiClient.getOAuthUrl(provider);
    spinner.succeed('已获取授权 URL');
  } catch (error: unknown) {
    spinner.fail('获取授权 URL 失败');
    console.error(chalk.red(`\n✖ ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }

  // 启动本地回调服务器
  const tokenPromise = new Promise<string>((resolve, reject) => {
    const app = express();
    let server: Server | undefined;

    // 超时处理
    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error('登录超时 (5 分钟)'));
    }, 5 * 60 * 1000);

    // 回调路由
    app.get('/callback', (req, res) => {
      const token = req.query.token as string;
      if (token) {
        clearTimeout(timeout);
        res.send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1>✅ 登录成功!</h1>
              <p>请返回终端继续操作。</p>
              <script>setTimeout(() => window.close(), 2000)</script>
            </body>
          </html>
        `);
        server?.close();
        resolve(token);
      } else {
        res.status(400).send('缺少 token 参数');
      }
    });

    // 启动服务器
    server = app.listen(CALLBACK_PORT, () => {
      console.log(chalk.gray(`\n  本地回调服务器已启动 (端口: ${CALLBACK_PORT})`));
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`端口 ${CALLBACK_PORT} 已被占用，请关闭占用该端口的程序`));
      } else {
        reject(err);
      }
    });
  });

  // 打开浏览器
  console.log(chalk.gray('\n  正在打开浏览器进行授权...'));
  console.log(chalk.gray(`  如果浏览器没有自动打开，请访问:`));
  console.log(chalk.cyan(`  ${authUrl}\n`));

  try {
    await open(authUrl);
  } catch {
    // 浏览器打开失败，用户手动访问
    console.log(chalk.yellow('  ⚠ 无法自动打开浏览器，请手动访问上述 URL'));
  }

  // 等待回调
  const spinner2 = ora('等待授权完成...').start();

  let token: string;
  try {
    token = await tokenPromise;
    spinner2.succeed('授权成功');
  } catch (error: unknown) {
    spinner2.fail('授权失败');
    console.error(chalk.red(`\n✖ ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }

  // 保存 token
  configManager.setToken(token);

  // 获取用户信息
  const spinner3 = ora('正在获取用户信息...').start();
  try {
    apiClient.setToken(token);
    const user = await apiClient.getMe();
    configManager.setUser({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    });
    spinner3.succeed('用户信息已获取');
  } catch {
    spinner3.warn('无法获取用户信息，但 token 已保存');
  }

  // 显示成功信息
  const user = configManager.getUser();
  console.log(chalk.green('\n✔ 登录成功!\n'));
  if (user) {
    console.log(chalk.gray(`  用户: ${user.username} (${user.display_name})`));
  }
  console.log(chalk.gray(`  Token 已保存到: ${configManager.getConfigPath()}`));
  console.log('');
}
