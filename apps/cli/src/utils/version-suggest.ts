/**
 * 版本号自动递增建议工具
 *
 * 发布时根据最新版本号建议下一个 patch 版本。
 */

import { apiClient } from '../api/client.js';
import { isPrerelease, getNextPatchVersion } from './version-utils.js';

export { isPrerelease, getNextPatchVersion };

/**
 * 建议下一个版本号
 *
 * 根据已有版本列表，建议下一个 patch 版本号。
 * 忽略预发布版本。如果没有正式版本，建议 0.0.1。
 *
 * @param scope - 包的 scope（如 "@team"）
 * @param name - 包名
 * @returns 建议的版本号
 */
export async function suggestNextVersion(scope: string, name: string): Promise<string> {
  try {
    const response = await apiClient.getVersions(scope, name);
    const versions = response.items || [];

    // 过滤出正式版本（非预发布）
    const stableVersions = versions
      .filter((v) => !isPrerelease(v.version))
      .map((v) => v.version)
      .sort((a, b) => {
        // 简单的版本号排序
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
