/**
 * akit info 命令 - 查看包详情
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiClient } from '../api/client.js';
import { parsePackageName } from '../utils/package-name.js';
import { formatNumber, formatDate } from '../utils/format.js';

export const infoCommand = new Command('info')
  .description('查看包详情')
  .argument('<package>', '包名 (例如: @scope/name)')
  .action(async (packageName: string) => {
    try {
      const { scope, name } = parsePackageName(packageName);
      const fullName = `${scope}/${name}`;

      console.log(chalk.bold(`\n📦 ${fullName}\n`));

      const spinner = ora('获取包信息...').start();

      // 获取包信息
      const pkg = await apiClient.getPackage(scope, name);
      spinner.succeed('获取成功');

      // 显示基本信息
      console.log(chalk.gray(`  ${pkg.description || '-'}\n`));
      console.log(`  Type:      ${pkg.type === 'mcp' ? 'MCP' : 'Skill'}`);
      console.log(`  License:   ${pkg.license || '-'}`);
      console.log(`  Latest:    ${pkg.latest_version || '-'}`);
      console.log(`  Downloads: ${formatNumber(pkg.downloads_count)}`);
      console.log(`  Visibility: ${pkg.visibility}`);
      if (pkg.repository) {
        console.log(`  Repository: ${pkg.repository}`);
      }

      // 获取版本列表
      const spinner2 = ora('获取版本列表...').start();
      try {
        const versions = await apiClient.getVersions(scope, name);
        spinner2.stop();

        if (versions.data.length > 0) {
          console.log(chalk.bold('\n  Versions:'));
          for (const ver of versions.data.slice(0, 10)) {
            const tag = ver.tag ? ` (${ver.tag})` : '';
            const deprecated = ver.deprecated ? ' [deprecated]' : '';
            const yanked = ver.yanked ? ' [yanked]' : '';
            console.log(
              `    ${ver.version}${tag}${deprecated}${yanked} - ${formatDate(ver.published_at)}`
            );
          }
          if (versions.data.length > 10) {
            console.log(chalk.gray(`    ... and ${versions.data.length - 10} more`));
          }
        }
      } catch {
        spinner2.fail('获取版本列表失败');
      }

      // 安装命令
      console.log(chalk.bold('\n  Install:'));
      console.log(`    akit install ${fullName}`);
      console.log('');
    } catch (error: any) {
      console.error(chalk.red(`\n✖ ${error.message}`));
      process.exit(1);
    }
  });
