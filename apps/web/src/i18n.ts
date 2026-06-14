/**
 * i18n 初始化配置
 *
 * 语言检测优先级：localStorage（用户手动切换后保存） > 浏览器语言 > 回退中文
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'zh',
    supportedLngs: ['zh', 'en'],
    interpolation: {
      escapeValue: false, // React auto-escapes JSX, safe to disable
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    ns: ['common', 'pages', 'admin', 'errors'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
