/**
 * akit search 命令 - 搜索 Registry 中的包
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiClient } from '../api/client.js';
import { formatNumber, truncate } from '../utils/format.js';

export const searchCommand = new Command('search')
  .description('搜索 Registry 中的包')
  .argument('<query>', '搜索关键词')
  .option('--type <type>', '按类型筛选 (mcp/skill)')
  .option('--page <page>', '页码', '1')
  .option('--limit <limit>', '每页数量', '20')
  .action(async (query: string, options) => {
    try {
      console.log(chalk.bold(`\n🔍 搜索: "${query}"\n`));

      const spinner = ora('搜索中...').start();

      const result = await apiClient.listPackages({
        search: query,
        type: options.type as 'mcp' | 'skill' | undefined,
        page: parseInt(options.page),
        per_page: parseInt(options.limit),
      });

      spinner.stop();

      if (result.items.length === 0) {
        console.log(chalk.gray('未找到匹配的包'));
        console.log('');
        return;
      }

      // 显示结果
      for (const pkg of result.items) {
        const typeLabel = pkg.type === 'mcp' ? 'MCP' : 'Skill';
        const downloads = formatNumber(pkg.downloads_count);
        const description = truncate(pkg.description || '-', 50);

        console.log(
          `  ${chalk.bold(`${pkg.scope}/${pkg.name}`)}@${pkg.latest_version || '-'}  ` +
          `${chalk.cyan(typeLabel)}  ${description}  ↓ ${downloads}`
        );
      }

      // 分页信息
      const totalPages = Math.ceil(result.total / result.per_page);
      console.log(chalk.gray(`\nPage ${result.page}/${totalPages} (${result.total} results)`));
      console.log('');
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ 搜索失败: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });
