/**
 * setup-claude-skill 命令测试 - TDD RED phase
 *
 * 测试场景:
 * - 正确复制 skill 文件到 ~/.claude/skills/
 * - 已存在时提示覆盖
 * - 配置文件正确更新
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('setup-claude-skill command', () => {
  let tempDir: string;
  let skillsDir: string;
  let sourceDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-skill-test-'));
    skillsDir = path.join(tempDir, '.claude', 'skills');
    sourceDir = path.join(tempDir, 'source', 'skills');

    // 创建源目录和测试文件
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(
      path.join(sourceDir, 'test-skill.md'),
      '# Test Skill\n\nThis is a test skill.'
    );
    await fs.writeFile(
      path.join(sourceDir, 'another-skill.md'),
      '# Another Skill\n\nAnother test skill.'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should create skills directory if not exists', async () => {
    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    await setupClaudeSkill({
      sourceDir,
      targetDir: skillsDir,
      force: false,
    });

    const dirExists = await fs
      .stat(skillsDir)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);
  });

  it('should copy skill files to target directory', async () => {
    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    await setupClaudeSkill({
      sourceDir,
      targetDir: skillsDir,
      force: false,
    });

    const files = await fs.readdir(skillsDir);
    expect(files).toContain('test-skill.md');
    expect(files).toContain('another-skill.md');
  });

  it('should copy file content correctly', async () => {
    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    await setupClaudeSkill({
      sourceDir,
      targetDir: skillsDir,
      force: false,
    });

    const content = await fs.readFile(
      path.join(skillsDir, 'test-skill.md'),
      'utf-8'
    );
    expect(content).toBe('# Test Skill\n\nThis is a test skill.');
  });

  it('should not overwrite existing files without force flag', async () => {
    // 预先创建 skills 目录和文件
    await fs.mkdir(skillsDir, { recursive: true });
    const existingContent = '# Existing Skill\n\nDo not overwrite.';
    await fs.writeFile(
      path.join(skillsDir, 'test-skill.md'),
      existingContent
    );

    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    // 不使用 force，应该跳过已存在的文件
    const result = await setupClaudeSkill({
      sourceDir,
      targetDir: skillsDir,
      force: false,
    });

    const content = await fs.readFile(
      path.join(skillsDir, 'test-skill.md'),
      'utf-8'
    );
    expect(content).toBe(existingContent);
    expect(result.skipped).toContain('test-skill.md');
  });

  it('should overwrite existing files with force flag', async () => {
    // 预先创建 skills 目录和文件
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(
      path.join(skillsDir, 'test-skill.md'),
      '# Old Content'
    );

    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    await setupClaudeSkill({
      sourceDir,
      targetDir: skillsDir,
      force: true,
    });

    const content = await fs.readFile(
      path.join(skillsDir, 'test-skill.md'),
      'utf-8'
    );
    expect(content).toBe('# Test Skill\n\nThis is a test skill.');
  });

  it('should return result with copied and skipped files', async () => {
    // 预先创建一个已存在的文件
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(
      path.join(skillsDir, 'test-skill.md'),
      'existing'
    );

    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    const result = await setupClaudeSkill({
      sourceDir,
      targetDir: skillsDir,
      force: false,
    });

    expect(result.copied).toContain('another-skill.md');
    expect(result.skipped).toContain('test-skill.md');
    expect(result.total).toBe(2);
  });

  it('should handle empty source directory', async () => {
    const emptyDir = path.join(tempDir, 'empty');
    await fs.mkdir(emptyDir, { recursive: true });

    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    const result = await setupClaudeSkill({
      sourceDir: emptyDir,
      targetDir: skillsDir,
      force: false,
    });

    expect(result.copied).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should throw error if source directory does not exist', async () => {
    const nonExistentDir = path.join(tempDir, 'nonexistent');

    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    await expect(
      setupClaudeSkill({
        sourceDir: nonExistentDir,
        targetDir: skillsDir,
        force: false,
      })
    ).rejects.toThrow();
  });

  it('should only copy .md files', async () => {
    // 添加非 .md 文件
    await fs.writeFile(path.join(sourceDir, 'readme.txt'), 'not a skill');
    await fs.writeFile(path.join(sourceDir, '.hidden'), 'hidden file');

    const { setupClaudeSkill } = await import('../../src/commands/setup-skill');

    const result = await setupClaudeSkill({
      sourceDir,
      targetDir: skillsDir,
      force: false,
    });

    expect(result.total).toBe(2); // 只有 .md 文件
    const files = await fs.readdir(skillsDir);
    expect(files).not.toContain('readme.txt');
    expect(files).not.toContain('.hidden');
  });
});
