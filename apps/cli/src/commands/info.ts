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

      // 获取版本列表（团队包或普通包）
      const spinner2 = ora('获取版本列表...').start();
      try {
        let versions;
        // 尝试普通包版本 API
        try {
          versions = await apiClient.getVersions(scope, name);
        } catch {
          // 尝试团队包版本 API
          const teams = await apiClient.listTeams();
          for (const team of teams) {
            try {
              const pkgs = await apiClient.listTeamPackages(team.id);
              const found = pkgs.find((p) => p.name === name || p.full_name === fullName);
              if (found) {
                const verResp = await apiClient.getTeamPackageVersions(team.id, found.id);
                versions = verResp;
                break;
              }
            } catch {
              // continue
            }
          }
        }
        spinner2.stop();

        if (versions && versions.items.length > 0) {
          console.log(chalk.bold('\n  Versions:'));
          for (const ver of versions.items.slice(0, 10)) {
            const tag = ver.tag ? ` (${ver.tag})` : '';
            const deprecated = ver.deprecated ? ' [deprecated]' : '';
            const yanked = ver.yanked ? ' [yanked]' : '';
            console.log(
              `    ${ver.version}${tag}${deprecated}${yanked} - ${formatDate(ver.published_at)}`
            );
          }
          if (versions.items.length > 10) {
            console.log(chalk.gray(`    ... and ${versions.items.length - 10} more`));
          }
        }
      } catch {
        spinner2.fail('获取版本列表失败');
      }

      // 安装命令
      console.log(chalk.bold('\n  Install:'));
      console.log(`    akit install ${fullName}`);
      console.log('');
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });
