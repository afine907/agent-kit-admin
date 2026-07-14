/**
 * akit list 命令 - 列出已安装的包 / 团队包
 * AC-07/AC-08: 团队包列表（含安装状态标记）
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { agentRegistry } from '../agents/registry.js';
import { apiClient } from '../api/client.js';
import { configManager } from '../config/manager.js';
import { formatTable } from '../utils/format.js';

// 包安装目录
const PACKAGES_DIR = join(homedir(), '.akit', 'packages');

interface LocalPackage {
  scope: string;
  name: string;
  version: string;
  type: string;
  agents: string[];
}

/**
 * 获取团队 slug 对应的 team_id
 */
async function resolveTeamId(slugOrId: string): Promise<string> {
  // 如果是完整 UUID，直接使用
  if (slugOrId.includes('-') && slugOrId.length === 36) {
    return slugOrId;
  }
  // 否则从团队列表中查找
  const teams = await apiClient.listTeams();
  const slug = slugOrId.startsWith('@') ? slugOrId.slice(1) : slugOrId;
  const team = teams.find((t) => t.slug === slug);
  if (!team) {
    throw new Error(`团队 @${slug} 不存在`);
  }
  return team.id;
}

/**
 * 格式化团队包状态
 */
function formatStatus(
  latestVersion: string | undefined,
  installedVersion: string | null | undefined,
  hasUpdate: boolean | undefined
): { emoji: string; text: string; color: (s: string) => string } {
  if (hasUpdate && installedVersion) {
    return { emoji: '🔔', text: `${installedVersion} → 有更新 ${latestVersion}`, color: chalk.yellow };
  }
  if (installedVersion && !hasUpdate) {
    return { emoji: '✓', text: `${installedVersion} 最新`, color: chalk.green };
  }
  return { emoji: '○', text: '未安装', color: chalk.gray };
}

/**
 * 输出团队包列表
 */
async function listTeamPackages(slugs: string[], options: { json: boolean }): Promise<void> {
  if (slugs.length === 0) {
    console.log(chalk.yellow('\n⚠ 请指定团队 slug，例如: akit list --team @frontend\n'));
    return;
  }

  const allPackages: Array<{
    scope: string;
    name: string;
    fullName: string;
    type: string;
    latestVersion: string;
    installedVersion: string | null;
    hasUpdate: boolean;
    downloadsCount: number;
  }> = [];

  for (const slug of slugs) {
    const teamId = await resolveTeamId(slug);
    const packages = await apiClient.listTeamPackages(teamId);

    for (const pkg of packages) {
      formatStatus(pkg.latest_version, pkg.my_installed_version, pkg.has_update);
      allPackages.push({
        scope: pkg.scope,
        name: pkg.name,
        fullName: pkg.full_name,
        type: pkg.type,
        latestVersion: pkg.latest_version || '-',
        installedVersion: pkg.my_installed_version ?? null,
        hasUpdate: pkg.has_update ?? false,
        downloadsCount: pkg.downloads_count,
      });
    }
  }

  if (options.json) {
    console.log(JSON.stringify(allPackages, null, 2));
    return;
  }

  if (allPackages.length === 0) {
    console.log(chalk.gray('\n暂无团队包\n'));
    return;
  }

  console.log(chalk.bold(`\n团队工具包 (${allPackages.length}):\n`));

  const rows = allPackages.map((pkg) => {
    const status = formatStatus(pkg.latestVersion, pkg.installedVersion, pkg.hasUpdate);
    return [
      `${pkg.scope}/${pkg.name}`,
      pkg.type.toUpperCase(),
      pkg.latestVersion,
      status.color(`${status.emoji} ${status.text}`),
    ];
  });

  console.log(formatTable(rows));
  console.log(chalk.gray('\n安装: akit install @scope/name\n'));
  console.log(chalk.gray('查看详情: akit info @scope/name\n'));
}

/**
 * 输出本地已安装包列表
 */
async function listLocalPackages(options: { agent?: string; json: boolean }): Promise<void> {
  const packages: LocalPackage[] = [];

  if (existsSync(PACKAGES_DIR)) {
    const scopes = readdirSync(PACKAGES_DIR);
    for (const scope of scopes) {
      const scopeDir = join(PACKAGES_DIR, scope);
      if (!statSync(scopeDir).isDirectory()) continue;

      const names = readdirSync(scopeDir);
      for (const name of names) {
        const packageDir = join(scopeDir, name);
        if (!statSync(packageDir).isDirectory()) continue;

        const manifestPath = join(packageDir, 'akit.json');
        if (existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
            packages.push({
              scope,
              name,
              version: manifest.version || 'unknown',
              type: manifest.type || 'unknown',
              agents: [],
            });
          } catch {
            // 跳过无效的包
          }
        }
      }
    }
  }

  // 检测 Agent 配置
  const detected = await agentRegistry.detectAll();
  for (const pkg of packages) {
    for (const adapter of detected) {
      if (await adapter.hasConfig(pkg.name)) {
        pkg.agents.push(adapter.name);
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(packages, null, 2));
    return;
  }

  if (packages.length === 0) {
    console.log(chalk.gray('\n暂无已安装的包\n'));
    return;
  }

  console.log(chalk.bold(`\n已安装的包 (${packages.length}):\n`));

  const rows = packages.map((pkg) => [
    `${pkg.scope}/${pkg.name}@${pkg.version}`,
    pkg.type.toUpperCase(),
    pkg.agents.join(', ') || '-',
  ]);

  console.log(formatTable(rows));
  console.log(chalk.gray('\n使用 `akit info <package>` 查看详情'));
  console.log(chalk.gray('查看团队包: akit list --team @team-slug\n'));
}

export const listCommand = new Command('list')
  .description('列出已安装的包或团队包')
  .option('--team <slug...>', '指定团队 slug（可多个）')
  .option('--team-id <id>', '指定团队 ID')
  .option('--agent <name>', '按 Agent 筛选（仅本地包）')
  .option('--json', '输出 JSON 格式')
  .argument('[packages...>', '包名（已在本地安装）')
  .action(async (args: string[], options) => {
    try {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login'));
        process.exit(1);
      }
      apiClient.setToken(token);

      // 团队包模式
      if (options.team || options.teamId) {
        const slugs: string[] = [];
        if (options.team) {
          slugs.push(...options.team);
        }
        if (options.teamId) {
          slugs.push(options.teamId);
        }
        await listTeamPackages(slugs, { json: options.json });
        return;
      }

      // 本地包模式
      await listLocalPackages({ agent: options.agent, json: options.json });
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
