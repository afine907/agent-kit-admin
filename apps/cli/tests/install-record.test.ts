/**
 * 安装记录测试 - akit install 后记录到 ~/.akit/config.json
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  recordInstall,
  removeInstallRecord,
  readAkitConfig,
  listInstalled,
} from '../src/utils/install-record.js';

const TEST_DIR = join(tmpdir(), 'akit-install-record-test-' + Date.now());
const CONFIG_PATH = join(TEST_DIR, '.akit', 'config.json');

describe('安装记录 - recordInstall', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, '.akit'), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('首次安装应创建 config.json 并记录', () => {
    recordInstall(
      {
        scope: '@test',
        name: 'my-pkg',
        version: '1.0.0',
        agent: 'claude',
      },
      CONFIG_PATH,
    );

    expect(existsSync(CONFIG_PATH)).toBe(true);
    const config = readAkitConfig(CONFIG_PATH);
    expect(config.installed['@test/my-pkg']).toBeDefined();
    expect(config.installed['@test/my-pkg'].version).toBe('1.0.0');
    expect(config.installed['@test/my-pkg'].agent).toBe('claude');
  });

  it('重复安装应覆盖旧记录', () => {
    recordInstall(
      { scope: '@test', name: 'my-pkg', version: '1.0.0' },
      CONFIG_PATH,
    );
    recordInstall(
      { scope: '@test', name: 'my-pkg', version: '2.0.0' },
      CONFIG_PATH,
    );

    const config = readAkitConfig(CONFIG_PATH);
    expect(config.installed['@test/my-pkg'].version).toBe('2.0.0');
    expect(Object.keys(config.installed)).toHaveLength(1);
  });

  it('多个包应分别记录', () => {
    recordInstall(
      { scope: '@test', name: 'pkg-a', version: '1.0.0' },
      CONFIG_PATH,
    );
    recordInstall(
      { scope: '@test', name: 'pkg-b', version: '2.0.0' },
      CONFIG_PATH,
    );

    const config = readAkitConfig(CONFIG_PATH);
    expect(Object.keys(config.installed)).toHaveLength(2);
    expect(config.installed['@test/pkg-a'].version).toBe('1.0.0');
    expect(config.installed['@test/pkg-b'].version).toBe('2.0.0');
  });

  it('removeInstallRecord 应删除指定记录', () => {
    recordInstall(
      { scope: '@test', name: 'pkg-a', version: '1.0.0' },
      CONFIG_PATH,
    );
    recordInstall(
      { scope: '@test', name: 'pkg-b', version: '2.0.0' },
      CONFIG_PATH,
    );

    removeInstallRecord('@test/pkg-a', CONFIG_PATH);

    const config = readAkitConfig(CONFIG_PATH);
    expect(Object.keys(config.installed)).toHaveLength(1);
    expect(config.installed['@test/pkg-a']).toBeUndefined();
    expect(config.installed['@test/pkg-b']).toBeDefined();
  });

  it('config.json 损坏时应返回空配置', () => {
    writeFileSync(CONFIG_PATH, '{invalid json');
    const config = readAkitConfig(CONFIG_PATH);
    expect(config.installed).toEqual({});
  });

  it('记录应包含 installedAt 时间戳', () => {
    const before = new Date().toISOString();
    recordInstall(
      { scope: '@test', name: 'my-pkg', version: '1.0.0' },
      CONFIG_PATH,
    );
    const after = new Date().toISOString();

    const config = readAkitConfig(CONFIG_PATH);
    const installedAt = config.installed['@test/my-pkg'].installedAt;
    expect(installedAt >= before).toBe(true);
    expect(installedAt <= after).toBe(true);
  });

  it('listInstalled 应返回所有已安装包', () => {
    recordInstall(
      { scope: '@test', name: 'pkg-a', version: '1.0.0' },
      CONFIG_PATH,
    );
    recordInstall(
      { scope: '@test', name: 'pkg-b', version: '2.0.0' },
      CONFIG_PATH,
    );

    const installed = listInstalled(CONFIG_PATH);
    expect(installed).toHaveLength(2);
  });
});
