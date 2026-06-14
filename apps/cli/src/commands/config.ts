/**
 * akit config 命令 - 管理配置
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { configManager } from '../config/manager.js';

export const configCommand = new Command('config')
  .description('管理配置')
  .addCommand(
    new Command('list')
      .description('显示当前配置')
      .action(() => {
        try {
          console.log(chalk.bold('\n⚙️  Agent Kit Admin - 配置\n'));

          const registry = configManager.getRegistry();
          const user = configManager.getUser();
          const installed = configManager.getInstalledPackages();

          console.log(chalk.gray('  Registry:'));
          console.log(chalk.cyan(`    ${registry}`));
          console.log('');

          console.log(chalk.gray('  用户:'));
          if (user) {
            console.log(chalk.cyan(`    ${user.username} (${user.display_name})`));
          } else {
            console.log(chalk.yellow('    未登录'));
          }
          console.log('');

          console.log(chalk.gray('  已安装包:'));
          if (installed.length > 0) {
            for (const pkg of installed) {
              console.log(chalk.cyan(`    ${pkg.full_name}@${pkg.version}`));
            }
          } else {
            console.log(chalk.yellow('    无'));
          }
          console.log('');

          console.log(chalk.gray(`  配置文件: ${configManager.getConfigPath()}`));
          console.log('');
        } catch (error: unknown) {
          console.error(chalk.red(`\n✖ 获取配置失败: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('set')
      .description('设置配置项')
      .argument('<key>', '配置项 (registry)')
      .argument('<value>', '配置值')
      .action((key, value) => {
        try {
          switch (key) {
            case 'registry':
              configManager.setRegistry(value);
              console.log(chalk.green(`\n✔ Registry 已设置为: ${value}\n`));
              break;
            default:
              console.log(chalk.red(`\n✖ 不支持的配置项: ${key}\n`));
              console.log(chalk.gray('  支持的配置项: registry'));
              process.exit(1);
          }
        } catch (error: unknown) {
          console.error(chalk.red(`\n✖ 设置配置失败: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('reset')
      .description('重置配置')
      .option('--yes', '确认重置')
      .action(async (options) => {
        try {
          if (!options.yes) {
            const { confirm } = await import('inquirer').then((m) =>
              m.default.prompt([
                {
                  type: 'confirm',
                  name: 'confirm',
                  message: '确定要重置所有配置吗？',
                  default: false,
                },
              ])
            );
            if (!confirm) {
              console.log(chalk.yellow('\n⚠ 已取消重置\n'));
              return;
            }
          }

          configManager.reset();
          console.log(chalk.green('\n✔ 配置已重置\n'));
        } catch (error: unknown) {
          console.error(chalk.red(`\n✖ 重置配置失败: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  );
