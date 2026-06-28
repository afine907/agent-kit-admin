/**
 * semver 版本约束检查工具
 * 校验依赖版本是否满足 semver 约束
 */
import { coerce, satisfies } from 'semver';

/**
 * 检查 version 是否满足 constraint 约束
 * @param version - 当前版本号 (如 "1.0.0")
 * @param constraint - semver 约束 (如 "^1.0.0", ">=2.0.0 <3.0.0", "*", "latest")
 * @returns 是否满足
 */
export function satisfiesSemverConstraint(
  version: string,
  constraint: string,
): boolean {
  // special values
  if (!constraint || constraint === 'latest' || constraint === '*') {
    return true;
  }

  const coerced = coerce(version);
  if (!coerced) {
    return false;
  }

  try {
    return satisfies(coerced, constraint);
  } catch {
    return false;
  }
}
