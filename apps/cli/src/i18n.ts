/**
 * CLI i18n 初始化配置
 *
 * 语言检测优先级：--lang 参数 > AKIT_LANG 环境变量 > 系统 LANG/LC_ALL > 默认中文
 * 当前仅支持 zh 和 en 两种语言
 */

import i18n from 'i18next';
import Backend from 'i18next-fs-backend';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function detectLocale(): string {
  // 1. --lang 参数（支持 --lang=xxx 和 --lang xxx 两种格式）
  const args = process.argv;
  const langEqIdx = args.findIndex((arg) => arg.startsWith('--lang='));
  if (langEqIdx !== -1) return args[langEqIdx].split('=')[1];

  const langIdx = args.indexOf('--lang');
  if (langIdx !== -1 && langIdx + 1 < args.length) {
    const val = args[langIdx + 1];
    if (!val.startsWith('-')) return val;
  }

  // 2. 环境变量（仅支持 zh 和 en，其他语言回退到中文）
  const envLang = process.env.AKIT_LANG || process.env.LANG || process.env.LC_ALL;
  if (envLang) {
    const lang = envLang.split('.')[0].split('-')[0].split('_')[0];
    if (lang === 'en') return 'en';
  }

  // 3. 默认中文
  return 'zh';
}

export async function initI18n(): Promise<typeof i18n> {
  await i18n.use(Backend).init({
    lng: detectLocale(),
    fallbackLng: 'zh',
    supportedLngs: ['zh', 'en'],
    backend: {
      loadPath: join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },
    ns: ['common', 'commands'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });

  return i18n;
}

export { i18n };
export const t = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options) as string;
