/**
 * akit setup-claude-skill 命令 - 安装 Claude Code skill 文件
 *
 * 将 skill 文件复制到 ~/.claude/skills/ 目录
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

export interface SetupSkillOptions {
  /** 源目录路径（包含 .md 文件） */
  sourceDir: string;
  /** 目标目录路径（默认 ~/.claude/skills/） */
  targetDir: string;
  /** 是否强制覆盖已存在的文件 */
  force: boolean;
}

export interface SetupSkillResult {
  /** 已复制的文件列表 */
  copied: string[];
  /** 跳过的文件列表（已存在且未使用 force） */
  skipped: string[];
  /** 处理的文件总数 */
  total: number;
}

/**
 * 安装 skill 文件到 Claude Code skills 目录
 *
 * @param options 配置选项
 * @returns 安装结果
 */
export async function setupClaudeSkill(options: SetupSkillOptions): Promise<SetupSkillResult> {
  const { sourceDir, targetDir, force } = options;

  // 检查源目录是否存在
  if (!existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  // 创建目标目录（如果不存在）
  await fs.mkdir(targetDir, { recursive: true });

  // 读取源目录中的 .md 文件
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name);

  const result: SetupSkillResult = {
    copied: [],
    skipped: [],
    total: mdFiles.length,
  };

  // 复制每个 .md 文件
  for (const fileName of mdFiles) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, fileName);

    // 检查目标文件是否已存在
    if (!force && existsSync(targetPath)) {
      result.skipped.push(fileName);
      continue;
    }

    // 复制文件
    const content = await fs.readFile(sourcePath, 'utf-8');
    await fs.writeFile(targetPath, content, 'utf-8');
    result.copied.push(fileName);
  }

  return result;
}

/**
 * 注册 setup-claude-skill 命令到 Commander 程序
 */
export function setupSkillCommand(program: Command): void {
  program
    .command('setup-claude-skill')
    .description('安装 Claude Code skill 文件到 ~/.claude/skills/')
    .option('--source <dir>', 'skill 文件源目录')
    .option('--target <dir>', '目标目录', path.join(homedir(), '.claude', 'skills'))
    .option('--force', '强制覆盖已存在的文件', false)
    .action(async (options) => {
      try {
        console.log(chalk.bold('\n📦 安装 Claude Code Skills...\n'));

        const spinner = ora('扫描 skill 文件...').start();

        // 确定源目录
        let sourceDir = options.source;
        if (!sourceDir) {
          // 默认使用包内的 skills 目录
          sourceDir = path.join(process.cwd(), 'skills');
        }

        if (!existsSync(sourceDir)) {
          spinner.fail('未找到 skill 文件目录');
          console.error(chalk.red(`\n✖ 目录不存在: ${sourceDir}`));
          console.log(chalk.gray('  使用 --source 指定 skill 文件目录'));
          process.exit(1);
        }

        spinner.succeed(`找到 skill 目录: ${sourceDir}`);

        // 执行安装
        const installSpinner = ora('安装 skill 文件...').start();

        const result = await setupClaudeSkill({
          sourceDir,
          targetDir: options.target,
          force: options.force,
        });

        if (result.total === 0) {
          installSpinner.info('未找到 .md 文件');
          console.log('');
          return;
        }

        installSpinner.succeed(`处理完成`);

        // 显示结果
        console.log('');
        if (result.copied.length > 0) {
          console.log(chalk.green('✔ 已安装:'));
          for (const file of result.copied) {
            console.log(chalk.gray(`  ${file}`));
          }
        }

        if (result.skipped.length > 0) {
          console.log(chalk.yellow('⊘ 已跳过（已存在）:'));
          for (const file of result.skipped) {
            console.log(chalk.gray(`  ${file}`));
          }
          console.log(chalk.gray('  使用 --force 强制覆盖'));
        }

        console.log('');
        console.log(chalk.gray(`目标目录: ${options.target}`));
        console.log('');
      } catch (error: unknown) {
        console.error(
          chalk.red(`\n✖ 安装失败: ${error instanceof Error ? error.message : String(error)}`)
        );
        process.exit(1);
      }
    });
}
