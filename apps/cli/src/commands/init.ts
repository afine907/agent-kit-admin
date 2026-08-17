/**
 * akit init 命令 - 初始化项目
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

export const initCommand = new Command('init')
  .description('初始化 Agent Kit 项目')
  .option('--name <name>', '包名')
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
        ]);

        name = name || answers.name;
      }

      // 默认值
      name = name || path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const type = 'skill';

      // 构建 manifest
      const manifest: Record<string, unknown> = {
        name,
        version: '0.1.0',
        type,
        description: `${name} - Agent Kit Skill`,
        license: 'MIT',
      };

      // Skill 内容（始终是 skill 类型）
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
