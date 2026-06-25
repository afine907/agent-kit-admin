/**
 * CLI i18n - 同步优先，异步兜底
 * t() 始终返回字符串（同步翻译 map），异步初始化用于真实翻译
 */

import i18n from 'i18next';
import Backend from 'i18next-fs-backend';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function detectLocale(): string {
  const args = process.argv;
  const langEqIdx = args.findIndex((arg) => arg.startsWith('--lang='));
  if (langEqIdx !== -1) return args[langEqIdx].split('=')[1];
  const langIdx = args.indexOf('--lang');
  if (langIdx !== -1 && langIdx + 1 < args.length) {
    const val = args[langIdx + 1];
    if (!val.startsWith('-')) return val;
  }
  const envLang = process.env.AKIT_LANG || process.env.LANG || process.env.LC_ALL;
  if (envLang) {
    const lang = envLang.split('.')[0].split('-')[0].split('_')[0];
    if (lang === 'en') return 'en';
  }
  return 'zh';
}

// 同步翻译 map — 在 i18n 初始化之前就可用
const syncTranslations: Record<string, Record<string, string>> = {
  zh: {
    'cli.description': 'Agent Kit Admin CLI',
    'cli.version': '显示版本号',
    'cli.langOption': '语言 (zh/en)',
    'cli.help': '显示帮助信息',
    'commands:login.description': '登录到 Registry',
    'commands:login.title': '登录',
    'commands:register.description': '注册新账号',
    'commands:logout.description': '退出登录',
    'commands:whoami.description': '显示当前用户信息',
    'commands:init.description': '初始化项目',
    'commands:publish.description': '发布包到 Registry',
    'commands:install.description': '安装包',
    'commands:uninstall.description': '卸载包',
    'commands:update.description': '更新已安装的包',
    'commands:list.description': '列出已安装的包',
    'commands:search.description': '搜索 Registry 中的包',
    'commands:info.description': '显示包的详细信息',
    'commands:config.description': '查看/修改配置',
    'commands:workspace.description': '管理工作空间',
  },
  en: {
    'cli.description': 'Agent Kit Admin CLI',
    'cli.version': 'Show version',
    'cli.langOption': 'Language (zh/en)',
    'cli.help': 'Show help',
    'commands:login.description': 'Sign in to Registry',
    'commands:login.title': 'Login',
    'commands:register.description': 'Register a new account',
    'commands:logout.description': 'Sign out',
    'commands:whoami.description': 'Show current user info',
    'commands:init.description': 'Initialize a project',
    'commands:publish.description': 'Publish package to Registry',
    'commands:install.description': 'Install a package',
    'commands:uninstall.description': 'Uninstall a package',
    'commands:update.description': 'Update installed packages',
    'commands:list.description': 'List installed packages',
    'commands:search.description': 'Search packages in Registry',
    'commands:info.description': 'Show package details',
    'commands:config.description': 'View/modify configuration',
    'commands:workspace.description': 'Manage workspaces',
  },
};

// 获取当前语言
function getLang(): string {
  try {
    return (i18n as unknown as { language?: string }).language || detectLocale();
  } catch {
    return detectLocale();
  }
}

// 同步 t() — 始终返回字符串，绝不抛错
export function t(key: string, options?: Record<string, unknown>): string {
  try {
    const lang = getLang();
    const map = syncTranslations[lang] || syncTranslations.zh;
    let result = map[key] || syncTranslations.zh[key] || key;
    // 简单插值 {{name}} → options.name
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }
    return result;
  } catch {
    return key;
  }
}

export async function initI18n(): Promise<typeof i18n> {
  await i18n.use(Backend).init({
    lng: detectLocale(),
    fallbackLng: 'zh',
    supportedLngs: ['zh', 'en'],
    backend: { loadPath: join(__dirname, '../locales/{{lng}}/{{ns}}.json') },
    ns: ['common', 'commands'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export { i18n };
