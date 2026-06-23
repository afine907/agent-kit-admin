/**
 * 安装记录测试 - #TODO install 记录到 ~/.akit/config.json
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'akit-install-record-test-' + Date.now());
const CONFIG_PATH = join(TEST_DIR, '.akit', 'config.json');

// 安装记录工具函数（从 install.ts 提取）
interface InstalledPackage {
  name: string;
  scope: string;
  version: string;
  installedAt: string;
  agent?: string;
}

interface AkitConfig {
  installed: Record<string, InstalledPackage>;
}

function readAkitConfig(configPath: string): AkitConfig {
  if (!existsSync(configPath)) {
    return { installed: {} };
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return { installed: {} };
  }
}

function recordInstall(
  configPath: string,
  pkg: { scope: string; name: string; version: string; agent?: string }
): void {
  const configDir = configPath.substring(0, configPath.lastIndexOf('/'));
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config = readAkitConfig(configPath);
  const key = `${pkg.scope}/${pkg.name}`;
  config.installed[key] = {
    name: pkg.name,
    scope: pkg.scope,
    version: pkg.version,
    installedAt: new Date().toISOString(),
    agent: pkg.agent,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function removeInstallRecord(configPath: string, key: string): void {
  if (!existsSync(configPath)) return;
  const config = readAkitConfig(configPath);
  delete config.installed[key];
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

describe('安装记录 - recordInstall', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, '.akit'), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('首次安装应创建 config.json 并记录', () => {
    recordInstall(CONFIG_PATH, {
      scope: '@test',
      name: 'my-pkg',
      version: '1.0.0',
      agent: 'claude',
    });

    expect(existsSync(CONFIG_PATH)).toBe(true);
    const config = readAkitConfig(CONFIG_PATH);
    expect(config.installed['@test/my-pkg']).toBeDefined();
    expect(config.installed['@test/my-pkg'].version).toBe('1.0.0');
    expect(config.installed['@test/my-pkg'].agent).toBe('claude');
  });

  it('重复安装应覆盖旧记录', () => {
    recordInstall(CONFIG_PATH, { scope: '@test', name: 'my-pkg', version: '1.0.0' });
    recordInstall(CONFIG_PATH, { scope: '@test', name: 'my-pkg', version: '2.0.0' });

    const config = readAkitConfig(CONFIG_PATH);
    expect(config.installed['@test/my-pkg'].version).toBe('2.0.0');
    expect(Object.keys(config.installed)).toHaveLength(1);
  });

  it('多个包应分别记录', () => {
    recordInstall(CONFIG_PATH, { scope: '@test', name: 'pkg-a', version: '1.0.0' });
    recordInstall(CONFIG_PATH, { scope: '@test', name: 'pkg-b', version: '2.0.0' });

    const config = readAkitConfig(CONFIG_PATH);
    expect(Object.keys(config.installed)).toHaveLength(2);
    expect(config.installed['@test/pkg-a'].version).toBe('1.0.0');
    expect(config.installed['@test/pkg-b'].version).toBe('2.0.0');
  });

  it('removeInstallRecord 应删除指定记录', () => {
    recordInstall(CONFIG_PATH, { scope: '@test', name: 'pkg-a', version: '1.0.0' });
    recordInstall(CONFIG_PATH, { scope: '@test', name: 'pkg-b', version: '2.0.0' });

    removeInstallRecord(CONFIG_PATH, '@test/pkg-a');

    const config = readAkitConfig(CONFIG_PATH);
    expect(Object.keys(config.installed)).toHaveLength(1);
    expect(config.installed['@test/pkg-a']).toBeUndefined();
    expect(config.installed['@test/pkg-b']).toBeDefined();
  });

  it('config.json 损坏时应返回空配置', () => {
    writeFileSync(CONFIG_PATH, '{invalid json');
    const config = readAkitConfig(CONFIG_PATH);
    expect(config).toEqual({ installed: {} });
  });

  it('记录应包含 installedAt 时间戳', () => {
    const before = new Date().toISOString();
    recordInstall(CONFIG_PATH, { scope: '@test', name: 'my-pkg', version: '1.0.0' });
    const after = new Date().toISOString();

    const config = readAkitConfig(CONFIG_PATH);
    const installedAt = config.installed['@test/my-pkg'].installedAt;
    expect(installedAt >= before).toBe(true);
    expect(installedAt <= after).toBe(true);
  });
});
