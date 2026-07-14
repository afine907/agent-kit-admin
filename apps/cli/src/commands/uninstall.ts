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
import { FileLock } from '../utils/lock.js';
import { listInstalled, removeInstallRecord } from '../utils/install-record.js';

// 包安装目录
const PACKAGES_DIR = join(homedir(), '.akit', 'packages');

export const uninstallCommand = new Command('uninstall')
  .description('卸载已安装的包')
  .argument('[package]', '包名 (例如: @scope/name；使用 --all 卸载所有)')
  .option('--agent <name>', '目标 Agent (claude/codex)')
  .option('--all', '卸载所有已安装的包')
  .option('--force', '跳过确认提示')
  .action(async (packageName: string, options) => {
    try {
      if (options.all) {
        return await uninstallAll(options.agent, options.force);
      }

      if (!packageName) {
        console.error(chalk.red('\n✖ 请指定包名，或使用 --all 卸载所有包\n'));
        process.exit(1);
      }

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
          const configPath = adapter.getConfigPath();
          const lock = new FileLock(configPath);

          let release: (() => Promise<void>) | undefined;
          try {
            release = await lock.acquire({ timeout: 10000 });
            await adapter.removeConfig(name);
            spinner1.succeed(`已从 ${adapter.name} 移除配置`);
          } finally {
            if (release) {
              await release();
            }
          }
        } else {
          spinner1.info('未找到 Agent 配置');
        }
      }

      // 4. 删除本地文件
      const spinner2 = ora('删除本地文件...').start();
      rmSync(packageDir, { recursive: true, force: true });
      spinner2.succeed('本地文件已删除');

      // 5. 清除安装记录
      removeInstallRecord(fullName);

      // 显示成功信息
      console.log(chalk.green(`\n✔ 已卸载 ${fullName}`));
      if (agentName) {
        const adapter = agentRegistry.get(agentName);
        console.log(chalk.gray(`  已从 ${adapter?.name} 移除配置`));
      }
      console.log('');
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ 卸载失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

/**
 * 卸载所有已安装的包
 */
async function uninstallAll(agent?: string, force?: boolean): Promise<void> {
  const installed = listInstalled();

  if (installed.length === 0) {
    console.log(chalk.yellow('\n⚠ 没有已安装的包\n'));
    return;
  }

  console.log(chalk.bold(`\n🗑️  将卸载全部 ${installed.length} 个包\n`));

  // 确认（--force 跳过）
  if (!force) {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确定要卸载全部 ${installed.length} 个包吗?`,
        default: false,
      },
    ]);
    if (!answer.confirm) {
      console.log(chalk.gray('  已取消\n'));
      return;
    }
  }

  let success = 0;
  let failed = 0;

  for (const pkg of installed) {
    const spinner = ora(`卸载 ${pkg.scope}/${pkg.name}...`).start();

    try {
      const packageDir = join(PACKAGES_DIR, pkg.scope, pkg.name);

      // 移除 Agent 配置
      const agentName = agent || pkg.agent;
      if (agentName) {
        const adapter = agentRegistry.get(agentName);
        if (adapter) {
          await adapter.removeConfig(pkg.name);
        }
      }

      // 删除本地文件
      if (existsSync(packageDir)) {
        rmSync(packageDir, { recursive: true, force: true });
      }

      // 清除安装记录
      removeInstallRecord(`${pkg.scope}/${pkg.name}`);

      spinner.succeed(`${pkg.scope}/${pkg.name} - 已卸载`);
      success++;
    } catch (error) {
      spinner.fail(`${pkg.scope}/${pkg.name} - 卸载失败: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('');
  console.log(chalk.green(`✔ 完成: ${success} 个包已卸载`));
  if (failed > 0) {
    console.log(chalk.red(`✖ ${failed} 个包卸载失败`));
  }
  console.log('');
}
