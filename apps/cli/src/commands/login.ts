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
import { i18n } from '../i18n.js';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';

const t = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options) as string;

// OAuth Provider 列表
const OAUTH_PROVIDERS = () => [
  { name: '企业微信 (WeChat Work)', value: 'wechat_work' },
  { name: '飞书 (Feishu)', value: 'feishu' },
  { name: '钉钉 (DingTalk)', value: 'dingtalk' },
];

// 本地回调服务器端口
const CALLBACK_PORT = 3456;

export const loginCommand = new Command('login')
  .description(t('commands:login.description'))
  .option('--registry <url>', 'Registry URL')
  .option('--email <email>', t('commands:login.email'))
  .option('--password <password>', t('commands:login.password'))
  .option('--provider <provider>', 'OAuth Provider (wechat_work/feishu/dingtalk)')
  .action(async (options) => {
    try {
      if (options.registry) {
        configManager.setRegistry(options.registry);
        apiClient.setToken('');
      }

      console.log(chalk.bold(`\n${t('commands:login.title')}\n`));

      let useLocalLogin = options.email && options.password;

      if (!useLocalLogin && !options.provider) {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'method',
            message: t('commands:login.selectMethod'),
            choices: [
              { name: t('commands:login.localLogin'), value: 'local' },
              { name: t('commands:login.oauthLogin'), value: 'oauth' },
            ],
          },
        ]);
        useLocalLogin = answer.method === 'local';
      }

      if (useLocalLogin) {
        await localLogin(options);
      } else {
        await oauthLogin(options);
      }
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ ${t('commands:login.loginFailed')}: ${error instanceof Error ? error.message : String(error)}`));
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

async function oauthLogin(options: OAuthLoginOptions) {
  let provider = options.provider;
  if (!provider) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: t('commands:login.selectProvider'),
        choices: OAUTH_PROVIDERS(),
      },
    ]);
    provider = answer.provider;
  }

  const validProviders = OAUTH_PROVIDERS().map((p) => p.value);
  if (!validProviders.includes(provider!)) {
    console.error(chalk.red(`\n✖ ${t('commands:login.unsupportedProvider')}: ${provider}`));
    console.log(chalk.gray(`  ${t('commands:login.supportedProviders')}: ${validProviders.join(', ')}`));
    process.exit(1);
  }

  const spinner = ora(t('commands:login.fetchingOAuthUrl')).start();

  let authUrl: string;
  try {
    authUrl = await apiClient.getOAuthUrl(provider!);
    spinner.succeed(t('commands:login.oauthUrlFetched'));
  } catch (error: unknown) {
    spinner.fail(t('commands:login.oauthUrlFailed'));
    console.error(chalk.red(`\n✖ ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }

  const tokenPromise = new Promise<string>((resolve, reject) => {
    const app = express();
    let server: Server | undefined;

    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error(t('commands:login.loginTimeout')));
    }, 5 * 60 * 1000);

    app.get('/callback', (req, res) => {
      const token = req.query.token as string;
      if (token) {
        clearTimeout(timeout);
        res.send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1>✅ ${t('commands:login.loginSuccessTitle')}</h1>
              <p>${i18n.language === 'zh' ? '请返回终端继续操作。' : 'Please return to the terminal.'}</p>
              <script>setTimeout(() => window.close(), 2000)</script>
            </body>
          </html>
        `);
        server?.close();
        resolve(token);
      } else {
        res.status(400).send('Missing token parameter');
      }
    });

    server = app.listen(CALLBACK_PORT, () => {
      console.log(chalk.gray(`\n  ${t('commands:login.callbackServerStarted')}: ${CALLBACK_PORT})`));
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(t('commands:login.portInUse', { port: CALLBACK_PORT })));
      } else {
        reject(err);
      }
    });
  });

  console.log(chalk.gray(`\n  ${t('commands:login.openingBrowser')}`));
  console.log(chalk.gray(`  ${t('commands:login.manualVisit')}`));
  console.log(chalk.cyan(`  ${authUrl}\n`));

  try {
    await open(authUrl);
  } catch {
    console.log(chalk.yellow(`  ⚠ ${t('commands:login.browserOpenFailed')}`));
  }

  const spinner2 = ora(t('commands:login.waitingAuth')).start();

  let token: string;
  try {
    token = await tokenPromise;
    spinner2.succeed(t('commands:login.authSuccess'));
  } catch (error: unknown) {
    spinner2.fail(t('commands:login.authFailed'));
    console.error(chalk.red(`\n✖ ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }

  configManager.setToken(token);

  const spinner3 = ora(t('commands:login.fetchingUserInfo')).start();
  try {
    apiClient.setToken(token);
    const user = await apiClient.getMe();
    configManager.setUser({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    });
    spinner3.succeed(t('commands:login.userInfoFetched'));
  } catch {
    spinner3.warn(t('commands:login.userInfoFailed'));
  }

  const user = configManager.getUser();
  console.log(chalk.green(`\n✔ ${t('commands:login.loginSuccessTitle')}\n`));
  if (user) {
    console.log(chalk.gray(`  ${t('commands:login.user')}: ${user.username} (${user.display_name})`));
  }
  console.log(chalk.gray(`  ${t('commands:login.tokenSaved')}: ${configManager.getConfigPath()}`));
  console.log('');
}
