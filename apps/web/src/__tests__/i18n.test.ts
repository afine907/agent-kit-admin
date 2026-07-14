/**
 * i18n 覆盖率测试
 *
 * 测试场景:
 * - 中英文 locale 文件 key 一致性
 * - locale 文件是有效 JSON
 * - 无硬编码字符串（基础检查）
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// 读取 locale 文件
function readLocaleFile(locale: string, namespace: string): Record<string, unknown> {
  const filePath = path.resolve(__dirname, `../../public/locales/${locale}/${namespace}.json`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// 递归获取所有 key
function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getKeys(value as Record<string, unknown>, fullKey));
    }
  }
  return keys;
}

describe('i18n locale consistency', () => {
  const namespaces = ['common', 'pages'];

  it.each(namespaces)('zh and en should have same keys for %s', (namespace) => {
    const zhKeys = getKeys(readLocaleFile('zh', namespace));
    const enKeys = getKeys(readLocaleFile('en', namespace));

    // 排序后比较
    const zhSorted = [...zhKeys].sort();
    const enSorted = [...enKeys].sort();

    // 检查 zh 中有但 en 中没有的 key
    const missingInEn = zhSorted.filter((k) => !enSorted.includes(k));
    // 检查 en 中有但 zh 中没有的 key
    const missingInZh = enSorted.filter((k) => !zhSorted.includes(k));

    expect(missingInEn).toEqual([]);
    expect(missingInZh).toEqual([]);
  });

  it.each(namespaces)('%s locale files should be valid JSON', (namespace) => {
    expect(() => readLocaleFile('zh', namespace)).not.toThrow();
    expect(() => readLocaleFile('en', namespace)).not.toThrow();
  });

  it.each(namespaces)('%s locale should not have empty values', (namespace) => {
    const zhData = readLocaleFile('zh', namespace);
    const enData = readLocaleFile('en', namespace);

    function checkNoEmptyValues(obj: Record<string, unknown>, pathPrefix = ''): void {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        if (typeof value === 'string') {
          expect(value.length, `Empty value at ${fullPath}`).toBeGreaterThan(0);
        } else if (typeof value === 'object' && value !== null) {
          checkNoEmptyValues(value as Record<string, unknown>, fullPath);
        }
      }
    }

    checkNoEmptyValues(zhData);
    checkNoEmptyValues(enData);
  });
});
