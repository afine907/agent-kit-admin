#!/usr/bin/env node
/**
 * Agent Kit Admin CLI - 入口文件
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loginCommand } from '../commands/login.js';
import { registerCommand } from '../commands/register.js';
import { logoutCommand } from '../commands/logout.js';
import { whoamiCommand } from '../commands/whoami.js';
import { initCommand } from '../commands/init.js';
import { publishCommand } from '../commands/publish.js';
import { installCommand } from '../commands/install.js';
import { uninstallCommand } from '../commands/uninstall.js';
import { updateCommand } from '../commands/update.js';
import { listCommand } from '../commands/list.js';
import { searchCommand } from '../commands/search.js';
import { infoCommand } from '../commands/info.js';
import { configCommand } from '../commands/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取版本号
let version = '0.1.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
  version = pkg.version;
} catch {
  // 使用默认版本
}

const program = new Command()
  .name('akit')
  .description('Agent Kit Admin CLI - AI Agent 包管理工具')
  .version(version);

// 注册所有命令
program.addCommand(loginCommand);
program.addCommand(registerCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(initCommand);
program.addCommand(publishCommand);
program.addCommand(installCommand);
program.addCommand(uninstallCommand);
program.addCommand(updateCommand);
program.addCommand(listCommand);
program.addCommand(searchCommand);
program.addCommand(infoCommand);
program.addCommand(configCommand);

// 帮助信息
program
  .command('help')
  .description('显示帮助信息')
  .action(() => {
    console.log(`
Agent Kit Admin CLI v${version}

用法:
  akit <command> [options]

命令:
  login       登录到 Agent Kit Registry
  register    注册新账号
  logout      登出当前用户
  whoami      显示当前登录用户
  init        初始化项目
  publish     发布包到 Registry
  install     安装包到本地
  uninstall   卸载已安装的包
  update      更新已安装的包
  list        列出已安装的包
  search      搜索 Registry 中的包
  info        查看包详情
  config      管理配置
  help        显示帮助信息

选项:
  -V, --version  显示版本号
  -h, --help     显示帮助信息

示例:
  akit register
  akit login
  akit login --email user@example.com --password pass123
  akit init
  akit publish
  akit install @team/web-search
  akit search mcp
  akit config list
    `);
  });

program.parse();
