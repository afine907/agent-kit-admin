/**
 * akit list 命令 - 列出已安装的包
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { agentRegistry } from '../agents/registry.js';
import { formatTable } from '../utils/format.js';

// 包安装目录
const PACKAGES_DIR = join(homedir(), '.akit', 'packages');

interface InstalledPackage {
  scope: string;
  name: string;
  version: string;
  type: string;
  agents: string[];
}

export const listCommand = new Command('list')
  .description('列出已安装的包')
  .option('--agent <name>', '按 Agent 筛选')
  .option('--json', '输出 JSON 格式')
  .action(async (options) => {
    try {
      // 扫描已安装的包
      const packages: InstalledPackage[] = [];

      if (existsSync(PACKAGES_DIR)) {
        const scopes = readdirSync(PACKAGES_DIR);
        for (const scope of scopes) {
          const scopeDir = join(PACKAGES_DIR, scope);
          if (!statSync(scopeDir).isDirectory()) continue;

          const names = readdirSync(scopeDir);
          for (const name of names) {
            const packageDir = join(scopeDir, name);
            if (!statSync(packageDir).isDirectory()) continue;

            // 读取 akit.json
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

      // JSON 输出
      if (options.json) {
        console.log(JSON.stringify(packages, null, 2));
        return;
      }

      // 表格输出
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
      console.log('');
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
