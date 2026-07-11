/**
 * akit webhook 命令 - 管理团队 Webhook
 * Task 5 of PLAN_phase4_ecosystem
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { apiClient, WebhookInfo } from '../api/client.js';
import { configManager } from '../config/manager.js';
import { formatTable } from '../utils/format.js';

/**
 * 解析 team slug/id
 */
async function resolveTeamId(slugOrId: string): Promise<string> {
  if (slugOrId.includes('-') && slugOrId.length === 36) {
    return slugOrId;
  }
  const teams = await apiClient.listTeams();
  const slug = slugOrId.startsWith('@') ? slugOrId.slice(1) : slugOrId;
  const team = teams.find((t) => t.slug === slug);
  if (!team) {
    throw new Error(`团队 @${slug} 不存在`);
  }
  return team.id;
}

const EVENT_CHOICES = ['publish', 'delete', 'version.published', 'version.yanked'] as const;
type EventValue = (typeof EVENT_CHOICES)[number];

/**
 * 列出 Webhook
 */
async function listWebhooks(teamSlug: string): Promise<void> {
  const teamId = await resolveTeamId(teamSlug);
  const webhooks = await apiClient.listWebhooks(teamId);

  if (webhooks.length === 0) {
    console.log(chalk.gray('\n暂无 Webhook\n'));
    return;
  }

  console.log(chalk.bold(`\n团队 @${teamSlug.replace('@', '')} 的 Webhook (${webhooks.length}):\n`));

  const rows = webhooks.map((wh: WebhookInfo) => [
    wh.id.slice(0, 8) + '...',
    wh.url.length > 40 ? wh.url.slice(0, 40) + '...' : wh.url,
    wh.events.join(', '),
    wh.last_triggered_at
      ? new Date(wh.last_triggered_at).toLocaleString('zh-CN')
      : chalk.gray('从未触发'),
  ]);

  console.log(formatTable(rows));
  console.log(chalk.gray('\n添加: akit webhook add --team @slug --url https://...\n'));
  console.log(chalk.gray('删除: akit webhook remove --team @slug --id <id>\n'));
}

/**
 * 添加 Webhook
 */
async function addWebhook(
  teamSlug: string,
  url: string,
  events: string[]
): Promise<void> {
  const teamId = await resolveTeamId(teamSlug);

  // 校验 events
  const invalid = events.filter((e) => !EVENT_CHOICES.includes(e as EventValue));
  if (invalid.length > 0) {
    console.error(
      chalk.red(`\n✖ 无效的事件类型: ${invalid.join(', ')}\n  有效值: ${EVENT_CHOICES.join(', ')}\n`)
    );
    process.exit(1);
  }

  const webhook = await apiClient.createWebhook(teamId, { url, events });
  console.log(chalk.green(`\n✓ Webhook 已创建`));
  console.log(chalk.gray(`  ID: ${webhook.id}`));
  console.log(chalk.gray(`  URL: ${webhook.url}`));
  console.log(chalk.gray(`  事件: ${webhook.events.join(', ')}\n`));
  console.log(
    chalk.cyan(`  提示: 请妥善保存 Webhook Secret，后续无法通过 API 再次查询\n`)
  );
}

/**
 * 删除 Webhook
 */
async function removeWebhook(teamSlug: string, webhookId: string): Promise<void> {
  const teamId = await resolveTeamId(teamSlug);
  await apiClient.deleteWebhook(teamId, webhookId);
  console.log(chalk.green(`\n✓ Webhook ${webhookId.slice(0, 8)}... 已删除\n`));
}

// ─── list 子命令 ───────────────────────────────────────────────
const listCmd = new Command('list')
  .description('列出团队 Webhook')
  .requiredOption('--team <slug>', '团队 slug（如 @my-team）')
  .action(async (options) => {
    try {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录，请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);
      await listWebhooks(options.team);
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  });

// ─── add 子命令 ───────────────────────────────────────────────
const addCmd = new Command('add')
  .description('添加 Webhook')
  .requiredOption('--team <slug>', '团队 slug')
  .requiredOption('--url <url>', 'Webhook 接收地址')
  .requiredOption('--events <events...>', '事件类型（以空格分隔）')
  .action(async (options) => {
    try {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录，请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);
      await addWebhook(options.team, options.url, options.events as string[]);
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  });

// ─── remove 子命令 ────────────────────────────────────────────
const removeCmd = new Command('remove')
  .description('删除 Webhook')
  .requiredOption('--team <slug>', '团队 slug')
  .requiredOption('--id <id>', 'Webhook ID')
  .option('-y, --yes', '跳过确认')
  .action(async (options) => {
    try {
      const token = configManager.getToken();
      if (!token) {
        console.error(chalk.red('\n✖ 未登录，请先运行: akit login\n'));
        process.exit(1);
      }
      apiClient.setToken(token);

      if (!options.yes) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `确定删除 Webhook ${options.id.slice(0, 8)}...?`,
            default: false,
          },
        ]);
        if (!confirmed) {
          console.log(chalk.gray('\n已取消\n'));
          process.exit(0);
        }
      }

      await removeWebhook(options.team, options.id);
    } catch (err) {
      console.error(chalk.red(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  });

// ─── 主命令 ────────────────────────────────────────────────────
export const webhookCommand = new Command('webhook')
  .description('管理团队 Webhook（列出/添加/删除）')
  .addCommand(listCmd)
  .addCommand(addCmd)
  .addCommand(removeCmd);
