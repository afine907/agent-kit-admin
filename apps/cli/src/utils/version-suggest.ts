/**
 * 版本号自动递增建议工具
 *
 * 发布时根据最新版本号建议下一个 patch 版本。
 * 使用依赖注入模式，方便测试时替换 API 调用。
 */

import { isPrerelease, getNextPatchVersion } from './version-utils.js';

export { isPrerelease, getNextPatchVersion };

/** 版本列表条目 */
interface VersionItem {
  version: string;
}

/** 版本列表获取函数类型 */
export type VersionFetcher = (scope: string, name: string) => Promise<{ items: VersionItem[] }>;

/** 默认的版本获取函数（使用 apiClient） */
async function defaultVersionFetcher(scope: string, name: string): Promise<{ items: VersionItem[] }> {
  const { apiClient } = await import('../api/client.js');
  return apiClient.getVersions(scope, name);
}

/**
 * 建议下一个版本号
 *
 * 根据已有版本列表，建议下一个 patch 版本号。
 * 忽略预发布版本。如果没有正式版本，建议 0.0.1。
 *
 * @param scope - 包的 scope（如 "@team"）
 * @param name - 包名
 * @param fetcher - 版本列表获取函数（可选，默认使用 apiClient）
 * @returns 建议的版本号
 */
export async function suggestNextVersion(
  scope: string,
  name: string,
  fetcher: VersionFetcher = defaultVersionFetcher,
): Promise<string> {
  try {
    const response = await fetcher(scope, name);
    const versions = response.items || [];

    // 过滤出正式版本（非预发布）
    const stableVersions = versions
      .filter((v) => !isPrerelease(v.version))
      .map((v) => v.version)
      .sort((a, b) => {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
        }
        return 0;
      });

    if (stableVersions.length === 0) {
      return '0.0.1';
    }

    const latest = stableVersions[stableVersions.length - 1];
    return getNextPatchVersion(latest);
  } catch {
    // API 调用失败时返回默认版本
    return '0.0.1';
  }
}
