/**
 * akit install 命令 - 安装包到本地
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { apiClient } from '../api/client.js';
import { agentRegistry } from '../agents/registry.js';
import { readManifest } from '../utils/manifest.js';
import { extractTarball } from '../utils/tarball.js';
import { parsePackageName } from '../utils/package-name.js';
import { FileLock } from '../utils/lock.js';
import { t } from '../i18n.js';
import { recordInstall } from '../utils/install-record.js';
import { satisfiesSemverConstraint } from '../utils/semver.js';

// 包安装目录
const PACKAGES_DIR = join(homedir(), '.akit', 'packages');

/**
 * 带指数退避的下载重试
 */
async function downloadWithRetry(url: string, maxRetries: number): Promise<Buffer> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export const installCommand = new Command('install');
installCommand
  .description(t('commands:install.description'))
  .argument('<package>', '包名 (例如: @scope/name)')
  .option('--agent <name>', '目标 Agent (claude/codex)')
  .option('--tag <tag>', '版本标签', 'latest')
  .option('--global', '全局安装到 ~/.akit/packages')
  .option('--no-config', '仅下载包，不写入 Agent 配置')
  .option('--no-deps', '跳过依赖检查')
  .action(async (packageName: string, options) => {
    try {
      console.log(chalk.bold('\n📥 安装包...\n'));

      // 1. 解析包名
      const { scope, name } = parsePackageName(packageName);
      const fullName = `${scope}/${name}`;

      // 2. 获取包信息 + 下载 URL（团队包或普通包）
      const spinner1 = ora('获取包信息...').start();
      let pkg: { latest_version?: string; name?: string } | null = null;
      let downloadUrl: string = '';
      let teamId: string | undefined;
      let packageId: string | undefined;

      try {
        // 先尝试普通包
        pkg = await apiClient.getPackage(scope, name);
        spinner1.succeed(`找到包: ${fullName}`);
        // 获取普通包下载链接
        const dUrl = await apiClient.getDownloadUrl(scope, name, options.tag === 'latest' ? undefined : options.tag);
        downloadUrl = dUrl;
      } catch (error: unknown) {
        // 如果是 404，且 scope 看起来是团队名，尝试团队包
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('404') || errMsg.includes('Not Found') || errMsg.includes('not found')) {
          // 遍历用户团队查找这个包
          spinner1.info(`个人包未找到，查找团队包...`);
          const teams = await apiClient.listTeams();
          for (const team of teams) {
            try {
              const pkgs = await apiClient.listTeamPackages(team.id);
              const found = pkgs.find((p) => p.name === name || p.full_name === fullName);
              if (found) {
                teamId = team.id;
                packageId = found.id;
                downloadUrl = await apiClient.getTeamPackageDownloadUrl(teamId, packageId as string, options.tag === 'latest' ? undefined : options.tag);
                spinner1.succeed(`找到团队包: ${team.name}/${fullName}`);
                break;
              }
            } catch {
              // continue
            }
          }
          if (!downloadUrl) {
            spinner1.fail('获取包信息失败');
            console.error(chalk.red(`\n✖ 包 ${fullName} 不存在`));
            process.exit(1);
          }
        } else {
          spinner1.fail('获取包信息失败');
          console.error(chalk.red(`\n✖ ${errMsg}`));
          process.exit(1);
        }
      }

      // 3. 下载已获取到 URL，开始下载

      const spinner3 = ora('下载中...').start();
      const installDir = options.global ? PACKAGES_DIR : join(process.cwd(), '.akit', 'packages');
      const packageDir = join(installDir, scope, name);

      try {
        // 确保目录存在
        if (!existsSync(packageDir)) {
          mkdirSync(packageDir, { recursive: true });
        }

        // 下载文件（带重试）
        const buffer = await downloadWithRetry(downloadUrl, 3);

        // 保存 tarball
        const tarPath = join(packageDir, `${name}.tar.gz`);
        const fs = await import('fs');
        fs.writeFileSync(tarPath, buffer);

        // 解压
        spinner3.text = '解压中...';
        await extractTarball(tarPath, packageDir);

        // 清理 tarball
        fs.unlinkSync(tarPath);

        spinner3.succeed(`下载完成`);
      } catch (error: unknown) {
        spinner3.fail('下载失败');
        console.error(chalk.red(`\n✖ ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }

      // 5. 检查依赖
      const manifest = readManifest(packageDir);
      if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
        const spinner5 = ora('检查依赖...').start();
        try {
          const depCheck = await apiClient.checkDependencies(manifest.dependencies);
          let hasBlocking = false;
          if (!depCheck.all_exist) {
            const missing = depCheck.results.filter((r) => !r.exists);
            spinner5.fail('依赖检查失败');
            for (const dep of missing) {
              console.log(chalk.red(`  ✖ ${dep.name} ${dep.constraint} — 不存在`));
            }
            hasBlocking = true;
          }

          // 校验存在的依赖是否满足 semver 约束
          const versionMismatch = depCheck.results.filter(
            (r) => r.exists && r.latest_version && !satisfiesSemverConstraint(r.latest_version, r.constraint),
          );
          for (const dep of versionMismatch) {
            console.log(
              chalk.yellow(
                `  ⚠ ${dep.name} ${dep.constraint} — 当前最新版本 ${dep.latest_version} 不满足约束`,
              ),
            );
          }

          if (hasBlocking) {
            console.log(chalk.yellow('\n请先安装缺失的依赖，或使用 --no-deps 跳过检查'));
            if (!options.noDeps) {
              process.exit(1);
            }
          } else if (versionMismatch.length > 0) {
            spinner5.warn('部分依赖版本不满足约束');
          } else {
            spinner5.succeed('依赖检查通过');
          }
        } catch {
          spinner5.warn('依赖检查跳过（服务不可用）');
        }
      }

      // 6. 配置 Agent（--no-config 跳过）
      if (options.config === false) {
        // 跳过 Agent 配置
        const version = pkg!.latest_version || 'unknown';
        console.log(chalk.green(`\n✔ 已下载 ${fullName}@${version}`));
        console.log(chalk.gray(`  目录: ${packageDir}`));
        console.log('');
      } else {
        const spinner4 = ora('配置 Agent...').start();

        let agentName = options.agent;
        if (!agentName) {
          // 自动检测
          const detected = await agentRegistry.detectAll();
          if (detected.length === 0) {
            spinner4.fail('未检测到已安装的 Agent');
            console.error(chalk.red('\n✖ 请安装 Claude Code 或 Codex'));
            process.exit(1);
          }

          if (detected.length === 1) {
            agentName = detected[0].name.toLowerCase();
          } else {
            spinner4.stop();
            const answer = await inquirer.prompt([
              {
                type: 'list',
                name: 'agent',
                message: '选择目标 Agent:',
                choices: detected.map((a) => ({ name: a.name, value: a.name.toLowerCase() })),
              },
            ]);
            agentName = answer.agent;
          }
        }

        const adapter = agentRegistry.get(agentName);
        if (!adapter) {
          spinner4.fail(`未找到 Agent 适配器: ${agentName}`);
          process.exit(1);
        }

        // 写入配置（使用文件锁保护并发写入）
        if (manifest.type === 'mcp' && manifest.mcp) {
          const configPath = adapter.getConfigPath();
          const lock = new FileLock(configPath);

          // 确保配置文件存在
          if (!existsSync(configPath)) {
            const fs = await import('fs');
            const configDir = join(configPath, '..');
            if (!existsSync(configDir)) {
              mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(configPath, '{}');
          }

          let release: (() => Promise<void>) | undefined;
          try {
            release = await lock.acquire({ timeout: 10000 });
            await adapter.writeConfig({
              name: name,
              command: manifest.mcp.command,
              args: manifest.mcp.args || [],
              env: {},
            });
            spinner4.succeed(`配置已写入: ${configPath}`);
          } finally {
            if (release) {
              await release();
            }
          }
        } else {
          spinner4.info('非 MCP 包，跳过 Agent 配置');
        }

        // 7. 更新已安装记录
        const version = pkg!.latest_version || 'unknown';
        recordInstall({ scope, name, version, agent: agentName });

        // 显示成功信息
        console.log(chalk.green(`\n✔ 已安装 ${fullName}@${version}`));
        console.log(chalk.gray(`  Agent: ${adapter.name}`));
        console.log(chalk.gray(`  Config: ${adapter.getConfigPath()} 已更新`));
        console.log('');
      }
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ 安装失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
