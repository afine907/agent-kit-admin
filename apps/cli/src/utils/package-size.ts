/**
 * 包大小预检工具
 *
 * 发布前检查包大小，超过 100MB 时警告。
 * 服务端硬限制为 50MB，CLI 预检使用更宽松的 100MB。
 */

const MAX_PACKAGE_SIZE = 100 * 1024 * 1024; // 100MB

export interface SizeCheckResult {
  ok: boolean;
  size: number;
  message?: string;
}

/**
 * 检查包大小是否超过限制
 *
 * @param size - 包大小（字节）
 * @param packageName - 包名（用于错误消息）
 * @returns 检查结果
 */
export function checkPackageSize(size: number, packageName?: string): SizeCheckResult {
  if (size <= MAX_PACKAGE_SIZE) {
    return { ok: true, size };
  }

  const sizeMB = (size / (1024 * 1024)).toFixed(1);
  const maxMB = (MAX_PACKAGE_SIZE / (1024 * 1024)).toFixed(0);
  const namePart = packageName ? ` (${packageName})` : '';

  return {
    ok: false,
    size,
    message: `包${namePart}大小 ${sizeMB} MB 超过限制 ${maxMB} MB。请减少包体积后再试。`,
  };
}
