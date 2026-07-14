/**
 * akit update 命令 - 更新已安装的包
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';
import { agentRegistry } from '../agents/registry.js';
import { extractTarball } from '../utils/tarball.js';
import { readManifest } from '../utils/manifest.js';

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

          // 下载新版本 tarball
          const downloadUrl = await apiClient.getDownloadUrl(pkg.scope, pkg.name, remotePkg.latest_version);
          const packageDir = join(homedir(), '.akit', 'packages', pkg.scope, pkg.name);

          // 确保目录存在
          if (!existsSync(packageDir)) {
            mkdirSync(packageDir, { recursive: true });
          }

          // 下载
          const response = await fetch(downloadUrl);
          if (!response.ok) {
            throw new Error(`下载失败: HTTP ${response.status}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());

          // 保存并解压
          const tarPath = join(packageDir, `${pkg.name}.tar.gz`);
          const fs = await import('fs');
          fs.writeFileSync(tarPath, buffer);
          await extractTarball(tarPath, packageDir);
          fs.unlinkSync(tarPath);

          // 读取 manifest 获取实际配置
          const manifest = readManifest(packageDir);

          // 获取 Agent adapter
          const agent = options.agent || pkg.agent;
          const adapter = agentRegistry.get(agent);

          if (!adapter) {
            spinner.fail(`${pkg.full_name} - 不支持的 Agent: ${agent}`);
            failed++;
            continue;
          }

          // 用 manifest 实际值重写配置
          await adapter.removeConfig(pkg.name);
          if (manifest.type === 'mcp' && manifest.mcp) {
            await adapter.writeConfig({
              name: pkg.name,
              command: manifest.mcp.command,
              args: manifest.mcp.args || [],
              env: {},
            });
          }

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
