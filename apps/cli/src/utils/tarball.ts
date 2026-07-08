/**
 * Tarball 打包工具
 */

import { statSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';
import { create, extract } from 'tar';

// 排除的目录和文件
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  '*.tar.gz',
  '.env',
  '.env.local',
];

/**
 * 打包目录为 .tar.gz
 */
export async function createTarball(
  sourceDir: string,
  outputPath: string,
  packageName: string
): Promise<{ path: string; size: number }> {
  // 获取要打包的文件列表
  const files = await getFiles(sourceDir, EXCLUDE_PATTERNS);

  // 创建 tarball
  await create(
    {
      gzip: true,
      file: outputPath,
      cwd: sourceDir,
      prefix: packageName,
    },
    files
  );

  // 获取文件大小
  const stats = statSync(outputPath);

  return {
    path: outputPath,
    size: stats.size,
  };
}

/**
 * 解压 .tar.gz 到目标目录
 */
export async function extractTarball(tarballPath: string, destDir: string): Promise<void> {
  try {
    await extract({
      file: tarballPath,
      cwd: destDir,
      strip: 1, // 去掉顶层目录
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`解压失败: ${msg}`);
  }
}

/**
 * 递归获取文件列表（排除指定模式）
 */
async function getFiles(dir: string, excludePatterns: string[]): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relativePath = relative(dir, fullPath);

      // 检查是否应该排除
      if (shouldExclude(entry.name, excludePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(relativePath);
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * 检查文件名是否匹配排除模式
 */
function shouldExclude(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.startsWith('*')) {
      return name.endsWith(pattern.slice(1));
    }
    return name === pattern;
  });
}

/**
 * 格式化文件大小
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
