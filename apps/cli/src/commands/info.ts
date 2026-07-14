/**
 * akit info 命令 - 查看包详情
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiClient } from '../api/client.js';
import { parsePackageName } from '../utils/package-name.js';
import { formatNumber, formatDate } from '../utils/format.js';

interface DiffEntry {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  breaking: boolean;
}

export interface DiffResult {
  added: string[];
  removed: string[];
  changed: DiffEntry[];
}

/**
 * 递归比较两个 manifest 的差异
 */
export function diffManifests(
  oldM: Record<string, unknown>,
  newM: Record<string, unknown>,
): DiffResult {
  const allKeys = new Set([...Object.keys(oldM), ...Object.keys(newM)]);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: DiffEntry[] = [];

  for (const key of allKeys) {
    // 排除 version 变更（预期变化）
    if (key === 'version') continue;

    if (!(key in oldM)) {
      added.push(key);
    } else if (!(key in newM)) {
      removed.push(key);
    } else {
      const oldVal = oldM[key];
      const newVal = newM[key];

      // 嵌套对象递归比较
      if (
        typeof oldVal === 'object' &&
        oldVal !== null &&
        typeof newVal === 'object' &&
        newVal !== null &&
        !Array.isArray(oldVal) &&
        !Array.isArray(newVal)
      ) {
        const nested = diffManifests(
          oldVal as Record<string, unknown>,
          newVal as Record<string, unknown>,
        );
        for (const k of nested.added) {
          added.push(`${key}.${k}`);
        }
        for (const k of nested.removed) {
          removed.push(`${key}.${k}`);
        }
        for (const c of nested.changed) {
          changed.push({ ...c, key: `${key}.${c.key}` });
        }
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        const isBreaking =
          key === 'command' || key === 'transport';
        changed.push({ key, oldValue: oldVal, newValue: newVal, breaking: isBreaking });
      }
    }
  }

  return { added, removed, changed };
}

export const infoCommand = new Command('info')
  .description('查看包详情')
  .argument('<package>', '包名 (例如: @scope/name)')
  .option('--diff <versions>', '对比两个版本的差异，格式: oldVer,newVer')
  .action(async (packageName: string, options) => {
    try {
      const { scope, name } = parsePackageName(packageName);
      const fullName = `${scope}/${name}`;

      // --diff 模式
      if (options.diff) {
        const [oldVer, newVer] = options.diff.split(',');
        if (!oldVer || !newVer) {
          console.error(chalk.red('\n✖ --diff 参数格式: <oldVersion>,<newVersion>'));
          process.exit(1);
        }

        console.log(chalk.bold(`\n📊 ${fullName} 版本对比: ${oldVer} → ${newVer}\n`));

        // 获取两个版本的 manifest
        try {
          const oldVersionResp = await apiClient.getVersion(scope, name, oldVer);
          const newVersionResp = await apiClient.getVersion(scope, name, newVer);

          const diff = diffManifests(
            oldVersionResp.manifest,
            newVersionResp.manifest,
          );

          if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
            console.log(chalk.green('  两个版本无差异\n'));
            return;
          }

          if (diff.added.length > 0) {
            console.log(chalk.green('  ✚ 新增:'));
            for (const k of diff.added) {
              console.log(`    ${k}`);
            }
          }

          if (diff.removed.length > 0) {
            console.log(chalk.red('  ✖ 移除:'));
            for (const k of diff.removed) {
              console.log(`    ${k}`);
            }
          }

          if (diff.changed.length > 0) {
            console.log(chalk.yellow('  ⚡ 变更:'));
            for (const c of diff.changed) {
              const prefix = c.breaking ? chalk.red('⚠ ') : '  ';
              const oldStr = typeof c.oldValue === 'string' ? c.oldValue : JSON.stringify(c.oldValue);
              const newStr = typeof c.newValue === 'string' ? c.newValue : JSON.stringify(c.newValue);
              console.log(`${prefix} ${c.key}: ${chalk.red(oldStr)} → ${chalk.green(newStr)}`);
            }
          }

          console.log('');
        } catch (error: unknown) {
          console.error(
            chalk.red(`\n✖ 版本对比失败: ${error instanceof Error ? error.message : String(error)}`),
          );
        }
        return;
      }

      // 普通 info 模式
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
          // 检查最新版本是否有 deprecated/yanked 警告
          const latestVer = versions.items[0];
          if (latestVer.yanked) {
            console.log(chalk.red(`\n  ❌ 最新版本 ${latestVer.version} 已撤回`));
          } else if (latestVer.deprecated) {
            console.log(chalk.yellow(`\n  ⚠️ 最新版本 ${latestVer.version} 已废弃`));
          }

          console.log(chalk.bold('\n  Versions:'));
          for (const ver of versions.items.slice(0, 10)) {
            const tag = ver.tag ? ` (${ver.tag})` : '';
            const deprecated = ver.deprecated ? chalk.yellow(' [deprecated]') : '';
            const yanked = ver.yanked ? chalk.red(' [yanked]') : '';
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
