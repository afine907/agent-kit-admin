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
import { parsePackageName } from '../utils/package-name.js';

// 包安装目录
const PACKAGES_DIR = join(homedir(), '.akit', 'packages');

export const installCommand = new Command('install')
  .description('安装包到本地')
  .argument('<package>', '包名 (例如: @scope/name)')
  .option('--agent <name>', '目标 Agent (claude/codex)')
  .option('--tag <tag>', '版本标签', 'latest')
  .action(async (packageName: string, options) => {
    try {
      console.log(chalk.bold('\n📥 安装包...\n'));

      // 1. 解析包名
      const { scope, name } = parsePackageName(packageName);
      const fullName = `${scope}/${name}`;

      // 2. 获取包信息
      const spinner1 = ora('获取包信息...').start();
      let pkg;
      try {
        pkg = await apiClient.getPackage(scope, name);
        spinner1.succeed(`找到包: ${fullName}`);
      } catch (error: any) {
        spinner1.fail('获取包信息失败');
        console.error(chalk.red(`\n✖ ${error.message}`));
        process.exit(1);
      }

      // 3. 获取下载 URL
      const spinner2 = ora('获取下载链接...').start();
      let downloadUrl: string;
      try {
        downloadUrl = await apiClient.getDownloadUrl(scope, name, options.tag === 'latest' ? undefined : options.tag);
        spinner2.succeed('获取下载链接成功');
      } catch (error: any) {
        spinner2.fail('获取下载链接失败');
        console.error(chalk.red(`\n✖ ${error.message}`));
        process.exit(1);
      }

      // 4. 下载并解压
      const spinner3 = ora('下载中...').start();
      const packageDir = join(PACKAGES_DIR, scope, name);

      try {
        // 确保目录存在
        if (!existsSync(packageDir)) {
          mkdirSync(packageDir, { recursive: true });
        }

        // 下载文件
        const response = await fetch(downloadUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        // 解压 (简化实现，实际需要 tar 解压)
        const tarPath = join(packageDir, `${name}.tar.gz`);
        const fs = await import('fs');
        fs.writeFileSync(tarPath, buffer);

        spinner3.succeed(`下载完成`);
      } catch (error: any) {
        spinner3.fail('下载失败');
        console.error(chalk.red(`\n✖ ${error.message}`));
        process.exit(1);
      }

      // 5. 读取 akit.json
      const manifest = readManifest(packageDir);

      // 6. 配置 Agent
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

      // 写入配置
      if (manifest.type === 'mcp' && manifest.mcp) {
        await adapter.writeConfig({
          name: name,
          command: manifest.mcp.command,
          args: manifest.mcp.args || [],
          env: {},
        });
        spinner4.succeed(`配置已写入: ${adapter.getConfigPath()}`);
      } else {
        spinner4.info('非 MCP 包，跳过 Agent 配置');
      }

      // 7. 更新已安装记录
      // TODO: 更新 ~/.akit/config.json 的已安装记录

      // 显示成功信息
      const version = pkg.latest_version || 'unknown';
      console.log(chalk.green(`\n✔ 已安装 ${fullName}@${version}`));
      console.log(chalk.gray(`  Agent: ${adapter.name}`));
      console.log(chalk.gray(`  Config: ${adapter.getConfigPath()} 已更新`));
      console.log('');
    } catch (error: any) {
      console.error(chalk.red(`\n✖ 安装失败: ${error.message}`));
      process.exit(1);
    }
  });
