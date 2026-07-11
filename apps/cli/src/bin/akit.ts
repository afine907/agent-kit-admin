#!/usr/bin/env node
/**
 * Agent Kit Admin CLI - 入口文件
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initI18n, i18n } from '../i18n.js';
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
import { workspaceCommand } from '../commands/workspace.js';
import { tokenCommand } from '../commands/token.js';
import { setupSkillCommand } from '../commands/setup-skill.js';
import { webhookCommand } from '../commands/webhook.js';
import { batchCommand } from '../commands/batch.js';

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

async function main() {
  // 初始化 i18n（在注册命令之前）
  await initI18n();

  const t = i18n.t.bind(i18n);

  const program = new Command()
    .name('akit')
    .description(t('cli.description'))
    .version(version)
    .option('--lang <lang>', t('cli.langOption', 'Language (zh/en)'));

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
  program.addCommand(tokenCommand);
  program.addCommand(listCommand);
  program.addCommand(searchCommand);
  program.addCommand(infoCommand);
  program.addCommand(configCommand);
  program.addCommand(workspaceCommand);

  // 注册 setup-claude-skill 命令（函数式注册）
  setupSkillCommand(program);

  // Webhook 管理命令
  program.addCommand(webhookCommand);

  // Batch 批量操作命令
  program.addCommand(batchCommand);

  // 帮助信息
  program
    .command('help')
    .description(t('cli.help'))
    .action(() => {
      console.log(`
Agent Kit Admin CLI v${version}

${t('cli.usage')}
  akit <command> [options]

${t('cli.commands')}
  login       ${t('commands:login.description')}
  register    ${t('commands:register.description')}
  logout      ${t('commands:logout.description')}
  whoami      ${t('commands:whoami.description')}
  init        ${t('commands:init.description')}
  publish     ${t('commands:publish.description')}
  webhook     ${t('commands:webhook.description')}
  batch       ${t('commands:batch.description')}
  install     ${t('commands:install.description')}
  uninstall   ${t('commands:uninstall.description')}
  update      ${t('commands:update.description')}
  list        ${t('commands:list.description')}
  search      ${t('commands:search.description')}
  info        ${t('commands:info.description')}
  config      ${t('commands:config.description')}
  help        ${t('cli.help')}

${t('cli.options')}
  -V, --version  ${t('cli.version')}
  -h, --help     ${t('cli.help')}
      --lang     Language (zh/en)

${t('cli.examples')}
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
}

main();
