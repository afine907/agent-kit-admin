/**
 * akit token - API Key 管理命令
 *
 * 子命令：
 *   akit token create <name>  - 创建新的 API Key
 *   akit token list           - 列出所有 API Key
 *   akit token delete <id>    - 删除指定 API Key
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { apiClient } from '../api/client.js';
import { configManager } from '../config/manager.js';

export const tokenCommand = new Command('token')
  .description('管理 API Key（用于 CI/CD 和自动化工具）');

// akit token create <name>
tokenCommand
  .command('create')
  .description('创建新的 API Key')
  .argument('<name>', 'API Key 名称（例如：CI/CD Token）')
  .action(async (name: string) => {
    // 检查是否已登录
    if (!configManager.getToken()) {
      console.error(chalk.red('错误：请先登录'));
      console.log('运行 ' + chalk.cyan('akit login') + ' 进行登录');
      process.exit(1);
    }

    try {
      const result = await apiClient.createAPIKey(name);

      console.log(chalk.green('✓ API Key 创建成功'));
      console.log('');
      console.log(chalk.yellow('  名称:    ') + result.name);
      console.log(chalk.yellow('  ID:      ') + result.id);
      console.log(chalk.yellow('  Key:     ') + chalk.bold(result.key));
      console.log(chalk.yellow('  前缀:    ') + result.key_prefix);
      console.log('');
      console.log(chalk.red('  ⚠ 请立即保存此 Key，它只会显示一次！'));
      console.log(chalk.dim('  使用方式：'));
      console.log(chalk.dim('    export AGENT_KIT_TOKEN=' + result.key));
      console.log(chalk.dim('    akit --token $AGENT_KIT_TOKEN install @scope/package'));
    } catch (error: any) {
      console.error(chalk.red('创建失败: ' + error.message));
      process.exit(1);
    }
  });

// akit token list
tokenCommand
  .command('list')
  .description('列出所有 API Key')
  .action(async () => {
    // 检查是否已登录
    if (!configManager.getToken()) {
      console.error(chalk.red('错误：请先登录'));
      console.log('运行 ' + chalk.cyan('akit login') + ' 进行登录');
      process.exit(1);
    }

    try {
      const keys = await apiClient.listAPIKeys();

      if (keys.length === 0) {
        console.log(chalk.dim('暂无 API Key'));
        console.log('运行 ' + chalk.cyan('akit token create <name>') + ' 创建');
        return;
      }

      console.log(chalk.bold('API Key 列表:'));
      console.log('');

      for (const key of keys) {
        const lastUsed = key.last_used_at
          ? new Date(key.last_used_at).toLocaleString('zh-CN')
          : '从未使用';
        const created = new Date(key.created_at).toLocaleString('zh-CN');

        console.log(chalk.cyan(`  ${key.name}`));
        console.log(chalk.dim(`    ID:       ${key.id}`));
        console.log(chalk.dim(`    前缀:     ${key.key_prefix}`));
        console.log(chalk.dim(`    权限:     ${key.permissions.join(', ')}`));
        console.log(chalk.dim(`    最后使用: ${lastUsed}`));
        console.log(chalk.dim(`    创建时间: ${created}`));
        console.log('');
      }
    } catch (error: any) {
      console.error(chalk.red('获取列表失败: ' + error.message));
      process.exit(1);
    }
  });

// akit token delete <id>
tokenCommand
  .command('delete')
  .description('删除指定 API Key')
  .argument('<id>', 'API Key ID')
  .action(async (id: string) => {
    // 检查是否已登录
    if (!configManager.getToken()) {
      console.error(chalk.red('错误：请先登录'));
      console.log('运行 ' + chalk.cyan('akit login') + ' 进行登录');
      process.exit(1);
    }

    try {
      await apiClient.deleteAPIKey(id);
      console.log(chalk.green('✓ API Key 已删除'));
    } catch (error: any) {
      console.error(chalk.red('删除失败: ' + error.message));
      process.exit(1);
    }
  });
