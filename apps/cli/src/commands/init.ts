/**
 * akit init 命令 - 初始化项目
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';


// 包类型选项
const PACKAGE_TYPES = [
  { name: 'MCP Server (模型上下文协议服务器)', value: 'mcp' },
  { name: 'Agent Skill (Agent 技能包)', value: 'skill' },
];

// Transport 选项
const MCP_TRANSPORTS = [
  { name: 'stdio (标准输入输出)', value: 'stdio' },
  { name: 'sse (Server-Sent Events)', value: 'sse' },
  { name: 'streamable-http (HTTP 流)', value: 'streamable-http' },
];

export const initCommand = new Command('init')
  .description('初始化 Agent Kit 项目')
  .option('--name <name>', '包名')
  .option('--type <type>', '包类型 (mcp/skill)')
  .option('--yes', '使用默认配置')
  .action(async (options) => {
    try {
      console.log(chalk.bold('\n📦 Agent Kit Admin - 初始化项目\n'));

      // 检查当前目录是否已有 akit.json
      const manifestPath = path.join(process.cwd(), 'akit.json');
      if (fs.existsSync(manifestPath) && !options.yes) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: '当前目录已有 akit.json，是否覆盖？',
            default: false,
          },
        ]);
        if (!overwrite) {
          console.log(chalk.yellow('\n⚠ 已取消初始化\n'));
          return;
        }
      }

      // 收集信息
      let name = options.name;
      let type = options.type;

      if (!options.yes) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: '包名 (小写字母、数字、连字符):',
            when: !name,
            validate: (input) => {
              if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(input)) {
                return '包名只能包含小写字母、数字和连字符，且不能以连字符开头或结尾';
              }
              return true;
            },
          },
          {
            type: 'list',
            name: 'type',
            message: '包类型:',
            choices: PACKAGE_TYPES,
            when: !type,
          },
        ]);

        name = name || answers.name;
        type = type || answers.type;
      }

      // 默认值
      name = name || path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      type = type || 'mcp';

      // 构建 manifest
      const manifest: Record<string, unknown> = {
        name,
        version: '0.1.0',
        type,
        description: `${name} - Agent Kit ${type === 'mcp' ? 'MCP Server' : 'Skill'}`,
        license: 'MIT',
      };

      // 根据类型添加配置
      if (type === 'mcp') {
        let transport = 'stdio';
        let command = 'node';
        let args = ['index.js'];

        if (!options.yes) {
          const mcpAnswers = await inquirer.prompt([
            {
              type: 'list',
              name: 'transport',
              message: 'MCP Transport:',
              choices: MCP_TRANSPORTS,
            },
            {
              type: 'input',
              name: 'command',
              message: '启动命令:',
              default: 'node',
            },
            {
              type: 'input',
              name: 'args',
              message: '启动参数 (逗号分隔):',
              default: 'index.js',
            },
          ]);

          transport = mcpAnswers.transport;
          command = mcpAnswers.command;
          args = mcpAnswers.args.split(',').map((a: string) => a.trim()).filter(Boolean);
        }

        manifest.mcp = {
          transport,
          command,
          args,
        };
      } else if (type === 'skill') {
        let content = '# Skill Name\n\nDescribe your skill here.';

        if (!options.yes) {
          const skillAnswers = await inquirer.prompt([
            {
              type: 'editor',
              name: 'content',
              message: 'Skill 内容 (Markdown):',
              default: content,
            },
          ]);
          content = skillAnswers.content;
        }

        manifest.skill = {
          content,
        };
      }

      // 写入 akit.json
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

      console.log(chalk.green('\n✔ 项目初始化成功!\n'));
      console.log(chalk.gray(`  包名: ${name}`));
      console.log(chalk.gray(`  类型: ${type}`));
      console.log(chalk.gray(`  文件: ${manifestPath}`));
      console.log('');
      console.log(chalk.gray('  下一步:'));
      console.log(chalk.cyan('    akit publish    # 发布到 Registry'));
      console.log('');
    } catch (error: unknown) {
      console.error(chalk.red(`\n✖ 初始化失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
