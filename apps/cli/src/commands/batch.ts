/**
 * akit batch 命令 - 批量操作包
 * Task 6 of PLAN_phase4_ecosystem
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { apiClient } from '../api/client.js';
import { configManager } from '../config/manager.js';

/**
 * 显示操作摘要
 */
function showSummary(packages: string[], action: string): void {
  console.log(chalk.bold(`\n准备 ${action} ${packages.length} 个包:\n`));
  for (const p of packages) {
    console.log(`  • ${p}`);
  }
  console.log();
}

// ─── delete 子命令 ────────────────────────────────────────────
const deleteCmd = new Command('delete')
  .description('批量删除包（软删除）')
  .argument('<packages...>', '包名列表（如 @scope/name）')
  .option('-y, --yes', '跳过确认直接执行')
  .action(async (packages: string[], options) => {
    try {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录，请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);

      showSummary(packages, '删除');

      if (!options.yes) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `确定删除以上 ${packages.length} 个包？（此操作可恢复）`,
            default: false,
          },
        ]);
        if (!confirmed) {
          console.log(chalk.gray('\n已取消\n'));
          process.exit(0);
        }
      }

      const result = await apiClient.batchDeletePackages(packages);

      console.log(chalk.bold('\n── 删除结果 ──\n'));
      if (result.success.length > 0) {
        for (const p of result.success) {
          console.log(chalk.green(`  ✓ ${p}`));
        }
      }
      if (result.failed.length > 0) {
        for (const f of result.failed) {
          console.log(chalk.red(`  ✖ ${f.name}: ${f.error}`));
        }
      }
      console.log();
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  });

// ─── deprecate 子命令 ────────────────────────────────────────
const deprecateCmd = new Command('deprecate')
  .description('批量废弃/取消废弃包')
  .argument('<packages...>', '包名列表（如 @scope/name）')
  .option('--undeprecate', '取消废弃（恢复使用）')
  .option('-y, --yes', '跳过确认直接执行')
  .action(async (packages: string[], options) => {
    try {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录，请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);

      const action = options.undeprecate ? '取消废弃' : '废弃';
      showSummary(packages, action);

      if (!options.yes) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `确定${action}以上 ${packages.length} 个包？`,
            default: false,
          },
        ]);
        if (!confirmed) {
          console.log(chalk.gray('\n已取消\n'));
          process.exit(0);
        }
      }

      const result = await apiClient.batchDeprecatePackages(packages, !options.undeprecate);

      console.log(chalk.bold(`\n── ${action}结果 ──\n`));
      if (result.success.length > 0) {
        for (const p of result.success) {
          console.log(chalk.green(`  ✓ ${p}`));
        }
      }
      if (result.failed.length > 0) {
        for (const f of result.failed) {
          console.log(chalk.red(`  ✖ ${f.name}: ${f.error}`));
        }
      }
      console.log();
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  });

// ─── 主命令 ────────────────────────────────────────────────────
export const batchCommand = new Command('batch')
  .description('批量操作包（删除/废弃）')
  .addCommand(deleteCmd)
  .addCommand(deprecateCmd);
