/**
 * akit publish 命令 - 发布包到 Registry
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { configManager } from '../config/manager.js';
import { apiClient } from '../api/client.js';
import { readManifest, validateManifest } from '../utils/manifest.js';
import { createTarball, formatSize } from '../utils/tarball.js';

export const publishCommand = new Command('publish')
  .description('发布包到 Registry')
  .option('--tag <tag>', '版本标签 (latest/beta/alpha/rc)')
  .option('--token <token>', 'API token (用于 CI/CD)')
  .option('--dry-run', '仅验证，不实际发布')
  .action(async (options) => {
    try {
      // 使用指定 token 或配置中的 token
      const token = options.token || configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录。请先运行: akit login'));
        process.exit(1);
      }
      apiClient.setToken(token);

      console.log(chalk.bold('\n📦 发布包...\n'));

      // 1. 读取 manifest
      const spinner1 = ora('读取 akit.json...').start();
      let manifest;
      try {
        manifest = readManifest(process.cwd());
        spinner1.succeed('读取 akit.json 成功');
      } catch (error: any) {
        spinner1.fail('读取 akit.json 失败');
        console.error(chalk.red(`\n✖ ${error.message}`));
        process.exit(1);
      }

      // 2. 验证 manifest
      const spinner2 = ora('验证 manifest...').start();
      const errors = validateManifest(manifest);
      if (errors.length > 0) {
        spinner2.fail('manifest 验证失败');
        console.error(chalk.red('\n✖ Invalid manifest:'));
        for (const err of errors) {
          console.error(chalk.gray(`  ${err.field}: ${err.message}`));
        }
        process.exit(1);
      }
      spinner2.succeed('manifest 验证通过');

      // dry-run 模式
      if (options.dryRun) {
        console.log(chalk.green('\n✔ Dry run - manifest 验证通过'));
        console.log(chalk.gray(`  name: ${manifest.name}`));
        console.log(chalk.gray(`  version: ${manifest.version}`));
        console.log(chalk.gray(`  type: ${manifest.type}`));
        console.log('');
        return;
      }

      // 3. 打包
      const spinner3 = ora('创建 tarball...').start();
      const tmpDir = await mkdtemp(join(tmpdir(), 'akit-'));
      const tarballPath = join(tmpDir, `${manifest.name}-${manifest.version}.tar.gz`);

      try {
        const { size } = await createTarball(process.cwd(), tarballPath, manifest.name);
        spinner3.succeed(`创建 tarball 成功 (${formatSize(size)})`);
      } catch (error: any) {
        spinner3.fail('创建 tarball 失败');
        console.error(chalk.red(`\n✖ ${error.message}`));
        process.exit(1);
      }

      // 4. 创建包 (如果不存在)
      const scope = manifest.scope || `@${configManager.getUser()?.username || 'unknown'}`;
      const spinner4 = ora('创建包记录...').start();

      try {
        await apiClient.createPackage({
          name: manifest.name,
          scope: scope,
          type: manifest.type as 'mcp' | 'skill',
          description: manifest.description,
          license: manifest.license,
        });
        spinner4.succeed('包记录创建成功');
      } catch (error: any) {
        if (error.message.includes('409')) {
          spinner4.info('包已存在，跳过创建');
        } else {
          spinner4.fail('创建包记录失败');
          console.error(chalk.red(`\n✖ ${error.message}`));
          process.exit(1);
        }
      }

      // 5. 上传版本
      const spinner5 = ora('上传版本...').start();

      try {
        const formData = new FormData();
        formData.append('version', manifest.version);
        formData.append('manifest', JSON.stringify(manifest));
        formData.append('tarball', new Blob([await import('fs').then(fs => fs.readFileSync(tarballPath))]), `${manifest.name}-${manifest.version}.tar.gz`);
        if (options.tag) {
          formData.append('tag', options.tag);
        }

        await apiClient.publishVersion(scope, manifest.name, formData);
        spinner5.succeed('版本上传成功');
      } catch (error: any) {
        spinner5.fail('版本上传失败');
        console.error(chalk.red(`\n✖ ${error.message}`));
        process.exit(1);
      }

      // 清理临时文件
      await rm(tmpDir, { recursive: true, force: true });

      // 显示成功信息
      console.log(chalk.green(`\n✔ 已发布 ${scope}/${manifest.name}@${manifest.version}`));
      if (options.tag) {
        console.log(chalk.gray(`  Tag: ${options.tag}`));
      }
      console.log(chalk.gray(`  Install: akit install ${scope}/${manifest.name}`));
      console.log('');
    } catch (error: any) {
      console.error(chalk.red(`\n✖ 发布失败: ${error.message}`));
      process.exit(1);
    }
  });
