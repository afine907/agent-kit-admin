/**
 * akit update 命令 - 更新已安装的包
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';
import { agentRegistry } from '../agents/registry.js';

export const updateCommand = new Command('update')
  .description('更新已安装的包')
  .argument('[name]', '包名 (不指定则更新所有)')
  .option('--agent <agent>', '指定 Agent (claude/codex)')
  .action(async (name, options) => {
    try {
      console.log(chalk.bold('\n🔄 Agent Kit Admin - 更新包\n'));

      // 获取已安装的包
      const installed = configManager.getInstalledPackages();

      if (installed.length === 0) {
        console.log(chalk.yellow('\n⚠ 没有已安装的包\n'));
        return;
      }

      // 筛选要更新的包
      let toUpdate = installed;
      if (name) {
        toUpdate = installed.filter((p) => p.name === name || p.full_name === name);
        if (toUpdate.length === 0) {
          console.log(chalk.red(`\n✖ 未找到已安装的包: ${name}\n`));
          process.exit(1);
        }
      }

      console.log(chalk.gray(`  待更新: ${toUpdate.length} 个包\n`));

      let updated = 0;
      let failed = 0;

      for (const pkg of toUpdate) {
        const spinner = ora(`检查 ${pkg.full_name}...`).start();

        try {
          // 从 Registry 获取最新版本
          const remotePkg = await apiClient.getPackage(pkg.scope, pkg.name);

          if (!remotePkg) {
            spinner.warn(`${pkg.full_name} - 包已不存在`);
            continue;
          }

          // 检查是否有新版本
          if (remotePkg.latest_version === pkg.version) {
            spinner.succeed(`${pkg.full_name} - 已是最新版本 (${pkg.version})`);
            continue;
          }

          spinner.text = `更新 ${pkg.full_name} (${pkg.version} → ${remotePkg.latest_version})...`;

          // 获取 Agent adapter
          const agent = options.agent || pkg.agent;
          const adapter = agentRegistry.get(agent);

          if (!adapter) {
            spinner.fail(`${pkg.full_name} - 不支持的 Agent: ${agent}`);
            failed++;
            continue;
          }

          // 更新配置
          await adapter.removeConfig(pkg.name);
          await adapter.writeConfig({
            name: pkg.name,
            command: 'node',
            args: ['index.js'],
          });

          // 更新本地记录
          configManager.updateInstalledPackage(pkg.full_name, {
            version: remotePkg.latest_version,
            updated_at: new Date().toISOString(),
          });

          spinner.succeed(`${pkg.full_name} - 更新成功 (${pkg.version} → ${remotePkg.latest_version})`);
          updated++;
        } catch (error: unknown) {
          spinner.fail(`${pkg.full_name} - 更新失败: ${error instanceof Error ? error.message : String(error)}`);
          failed++;
        }
      }

      // 显示结果
      console.log('');
      if (updated > 0) {
        console.log(chalk.green(`✔ 更新完成: ${updated} 个包已更新`));
      }
      if (failed > 0) {
        console.log(chalk.red(`✖ 更新失败: ${failed} 个包更新失败`));
      }
      if (updated === 0 && failed === 0) {
        console.log(chalk.gray('  所有包已是最新版本'));
      }
      console.log('');
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ 更新失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
