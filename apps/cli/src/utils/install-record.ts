/**
 * 已安装包记录管理
 * 将已安装包记录到 ~/.akit/config.json，支持 akit list 和 akit update --all
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

export interface InstalledPackage {
  name: string;
  scope: string;
  version: string;
  installedAt: string;
  agent?: string;
}

export interface AkitConfig {
  version: number;
  installed: Record<string, InstalledPackage>;
}

const AKIT_CONFIG_PATH = join(homedir(), '.akit', 'config.json');

export function getConfigPath(): string {
  return AKIT_CONFIG_PATH;
}

export function readAkitConfig(configPath?: string): AkitConfig {
  const targetPath = configPath ?? AKIT_CONFIG_PATH;
  if (!existsSync(targetPath)) {
    return { version: 1, installed: {} };
  }
  try {
    return JSON.parse(readFileSync(targetPath, 'utf-8')) as AkitConfig;
  } catch {
    return { version: 1, installed: {} };
  }
}

export function recordInstall(
  pkg: { scope: string; name: string; version: string; agent?: string },
  configPath?: string,
): void {
  const targetPath = configPath ?? AKIT_CONFIG_PATH;
  const configDir = dirname(targetPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config = readAkitConfig(targetPath);
  const key = `${pkg.scope}/${pkg.name}`;
  config.installed[key] = {
    name: pkg.name,
    scope: pkg.scope,
    version: pkg.version,
    installedAt: new Date().toISOString(),
    agent: pkg.agent,
  };

  writeFileSync(targetPath, JSON.stringify(config, null, 2));
}

export function removeInstallRecord(key: string, configPath?: string): void {
  const targetPath = configPath ?? AKIT_CONFIG_PATH;
  if (!existsSync(targetPath)) return;
  const config = readAkitConfig(targetPath);
  delete config.installed[key];
  writeFileSync(targetPath, JSON.stringify(config, null, 2));
}

export function listInstalled(configPath?: string): InstalledPackage[] {
  const config = readAkitConfig(configPath);
  return Object.values(config.installed);
}
