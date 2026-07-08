/**
 * tarball 工具测试
 *
 * 测试场景:
 * - extractTarball: 正常解压、错误处理、strip 行为
 * - formatSize: 文件大小格式化
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { create } from 'tar';
import { extractTarball, formatSize } from '../../src/utils/tarball';

describe('extractTarball', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-tarball-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * 创建测试用的 tarball
   * @param files 文件路径到内容的映射
   * @param topLevelDir 顶层目录名（tarball 内的根目录）
   */
  async function createTestTarball(
    files: Record<string, string>,
    topLevelDir = 'package'
  ): Promise<string> {
    const srcDir = path.join(tempDir, 'src');
    const tarPath = path.join(tempDir, 'test.tar.gz');

    // 创建源文件
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(srcDir, topLevelDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }

    // 创建 tarball（带顶层目录）
    const entries = Object.keys(files).map((f) => path.join(topLevelDir, f));
    await create(
      { gzip: true, file: tarPath, cwd: srcDir },
      entries
    );

    return tarPath;
  }

  it('should extract tarball to destination directory', async () => {
    const tarPath = await createTestTarball({
      'index.js': 'console.log("hello")',
      'package.json': '{"name":"test"}',
    });

    const destDir = path.join(tempDir, 'dest');
    await fs.mkdir(destDir, { recursive: true });

    await extractTarball(tarPath, destDir);

    // strip: 1 去掉顶层目录，文件直接在 destDir 下
    const indexContent = await fs.readFile(path.join(destDir, 'index.js'), 'utf-8');
    expect(indexContent).toBe('console.log("hello")');

    const pkgContent = await fs.readFile(path.join(destDir, 'package.json'), 'utf-8');
    expect(pkgContent).toBe('{"name":"test"}');
  });

  it('should strip top-level directory (strip: 1)', async () => {
    const tarPath = await createTestTarball(
      { 'file.txt': 'content' },
      'top-level-dir'
    );

    const destDir = path.join(tempDir, 'dest');
    await fs.mkdir(destDir, { recursive: true });

    await extractTarball(tarPath, destDir);

    // 顶层目录应被去掉
    const files = await fs.readdir(destDir);
    expect(files).toContain('file.txt');
    expect(files).not.toContain('top-level-dir');
  });

  it('should handle nested directory structure', async () => {
    const tarPath = await createTestTarball({
      'src/index.ts': 'export {}',
      'src/utils/helper.ts': 'export function helper() {}',
      'README.md': '# Test',
    });

    const destDir = path.join(tempDir, 'dest');
    await fs.mkdir(destDir, { recursive: true });

    await extractTarball(tarPath, destDir);

    const srcContent = await fs.readFile(path.join(destDir, 'src', 'index.ts'), 'utf-8');
    expect(srcContent).toBe('export {}');

    const helperContent = await fs.readFile(
      path.join(destDir, 'src', 'utils', 'helper.ts'),
      'utf-8'
    );
    expect(helperContent).toBe('export function helper() {}');

    const readmeContent = await fs.readFile(path.join(destDir, 'README.md'), 'utf-8');
    expect(readmeContent).toBe('# Test');
  });

  it('should throw meaningful error for non-existent tarball', async () => {
    const destDir = path.join(tempDir, 'dest');
    await fs.mkdir(destDir, { recursive: true });

    await expect(
      extractTarball('/nonexistent/path/test.tar.gz', destDir)
    ).rejects.toThrow(/解压失败/);
  });

  it('should throw meaningful error for corrupted tarball', async () => {
    // 创建一个损坏的 tarball 文件
    const corruptPath = path.join(tempDir, 'corrupt.tar.gz');
    await fs.writeFile(corruptPath, 'this is not a valid tarball');

    const destDir = path.join(tempDir, 'dest');
    await fs.mkdir(destDir, { recursive: true });

    await expect(extractTarball(corruptPath, destDir)).rejects.toThrow(/解压失败/);
  });

  it('should handle empty tarball', async () => {
    // 创建空的 tarball（只有顶层目录，无文件）
    const srcDir = path.join(tempDir, 'src');
    const tarPath = path.join(tempDir, 'empty.tar.gz');
    const topDir = path.join(srcDir, 'empty-pkg');
    await fs.mkdir(topDir, { recursive: true });

    await create(
      { gzip: true, file: tarPath, cwd: srcDir },
      ['empty-pkg']
    );

    const destDir = path.join(tempDir, 'dest');
    await fs.mkdir(destDir, { recursive: true });

    // 空 tarball 应该能正常解压（不报错）
    await extractTarball(tarPath, destDir);

    const files = await fs.readdir(destDir);
    // strip: 1 后，空目录不会被创建
    expect(files.length).toBe(0);
  });
});

describe('formatSize', () => {
  it('should format bytes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('should format kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(1024 * 100)).toBe('100.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });
});
