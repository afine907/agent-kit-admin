/**
 * akit uninstall 命令 - 卸载已安装的包
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { agentRegistry } from '../agents/registry.js';
import { parsePackageName } from '../utils/package-name.js';

// 包安装目录
const PACKAGES_DIR = join(homedir(), '.akit', 'packages');

export const uninstallCommand = new Command('uninstall')
  .description('卸载已安装的包')
  .argument('<package>', '包名 (例如: @scope/name)')
  .option('--agent <name>', '目标 Agent (claude/codex)')
  .action(async (packageName: string, options) => {
    try {
      console.log(chalk.bold('\n🗑️  卸载包...\n'));

      // 1. 解析包名
      const { scope, name } = parsePackageName(packageName);
      const fullName = `${scope}/${name}`;

      // 2. 检查包是否存在
      const packageDir = join(PACKAGES_DIR, scope, name);
      if (!existsSync(packageDir)) {
        console.error(chalk.red(`\n✖ 包 ${fullName} 未安装`));
        process.exit(1);
      }

      // 3. 检测 Agent 并移除配置
      const spinner1 = ora('移除 Agent 配置...').start();

      let agentName = options.agent;
      if (!agentName) {
        const detected = await agentRegistry.detectAll();
        const configured = [];
        for (const adapter of detected) {
          if (await adapter.hasConfig(name)) {
            configured.push(adapter);
          }
        }

        if (configured.length === 0) {
          spinner1.info('未找到 Agent 配置');
        } else if (configured.length === 1) {
          agentName = configured[0].name.toLowerCase();
        } else {
          spinner1.stop();
          const answer = await inquirer.prompt([
            {
              type: 'list',
              name: 'agent',
              message: '选择目标 Agent:',
              choices: configured.map((a) => ({ name: a.name, value: a.name.toLowerCase() })),
            },
          ]);
          agentName = answer.agent;
        }
      }

      if (agentName) {
        const adapter = agentRegistry.get(agentName);
        if (adapter && await adapter.hasConfig(name)) {
          await adapter.removeConfig(name);
          spinner1.succeed(`已从 ${adapter.name} 移除配置`);
        } else {
          spinner1.info('未找到 Agent 配置');
        }
      }

      // 4. 删除本地文件
      const spinner2 = ora('删除本地文件...').start();
      rmSync(packageDir, { recursive: true, force: true });
      spinner2.succeed('本地文件已删除');

      // 显示成功信息
      console.log(chalk.green(`\n✔ 已卸载 ${fullName}`));
      if (agentName) {
        const adapter = agentRegistry.get(agentName);
        console.log(chalk.gray(`  已从 ${adapter?.name} 移除配置`));
      }
      console.log('');
    } catch (error: any) {
      console.error(chalk.red(`\n✖ 卸载失败: ${error.message}`));
      process.exit(1);
    }
  });
