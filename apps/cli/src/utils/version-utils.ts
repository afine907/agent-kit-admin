/**
 * 版本号工具函数（纯函数，无外部依赖）
 */

/**
 * 判断是否为预发布版本
 *
 * @param version - 版本号
 * @returns 是否为预发布版本
 */
export function isPrerelease(version: string): boolean {
  return version.includes('-');
}

/**
 * 获取下一个 patch 版本号
 *
 * @param version - 当前版本号（如 "1.0.0"）
 * @returns 下一个 patch 版本号（如 "1.0.1"）
 */
export function getNextPatchVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length !== 3) {
    return '0.0.1';
  }
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10);

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    return '0.0.1';
  }

  return `${major}.${minor}.${patch + 1}`;
}
