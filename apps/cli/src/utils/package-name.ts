/**
 * 包名解析工具
 */

export interface ParsedPackageName {
  scope: string;
  name: string;
}

/**
 * 解析包名
 * "@team/web-search" → { scope: "@team", name: "web-search" }
 * "web-search" → { scope: "@unknown", name: "web-search" */
export function parsePackageName(input: string): ParsedPackageName {
  const parts = input.split('/');

  if (parts.length === 2 && parts[0].startsWith('@')) {
    return {
      scope: parts[0],
      name: parts[1],
    };
  }

  // 如果没有 scope，使用默认值
  return {
    scope: '@unknown',
    name: parts[0] || input,
  };
}

/**
 * 格式化包全名
 */
export function formatFullName(scope: string, name: string): string {
  return `${scope}/${name}`;
}
