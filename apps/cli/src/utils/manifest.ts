/**
 * akit.json Manifest 验证工具
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface Manifest {
  name: string;
  version: string;
  type: 'mcp' | 'skill';
  description?: string;
  license?: string;
  scope?: string;
  dependencies?: Record<string, string>;
  mcp?: {
    transport: string;
    command: string;
    args?: string[];
    env?: Array<{ name: string; required?: boolean; description?: string; default?: string }>;
    capabilities?: string[];
    tools?: Array<{ name: string; description?: string }>;
  };
  skill?: {
    trigger?: string;
    command?: string;
    content: string;
    hooks?: string[];
    permissions?: string[];
  };
  [key: string]: unknown;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 读取并验证 manifest
 */
export function readManifest(dir: string): Manifest {
  const path = join(dir, 'akit.json');

  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    throw new Error("No akit.json found. Run 'akit init' first.");
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(content);
  } catch {
    throw new Error('Invalid akit.json: not valid JSON');
  }

  return manifest;
}

/**
 * 验证 manifest 格式
 */
export function validateManifest(manifest: Manifest): ValidationError[] {
  const errors: ValidationError[] = [];

  // 必填字段
  if (!manifest.name) {
    errors.push({ field: 'name', message: 'required field missing' });
  } else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(manifest.name)) {
    errors.push({ field: 'name', message: 'must be lowercase with hyphens' });
  }

  if (!manifest.version) {
    errors.push({ field: 'version', message: 'required field missing' });
  } else if (!isValidSemver(manifest.version)) {
    errors.push({ field: 'version', message: 'must be valid semver (e.g., 1.0.0)' });
  }

  if (!manifest.type) {
    errors.push({ field: 'type', message: 'required field missing' });
  } else if (!['mcp', 'skill'].includes(manifest.type)) {
    errors.push({ field: 'type', message: 'must be "mcp" or "skill"' });
  }

  // MCP 配置验证
  if (manifest.type === 'mcp') {
    if (!manifest.mcp) {
      errors.push({ field: 'mcp', message: 'required for type=mcp' });
    } else {
      if (!manifest.mcp.transport) {
        errors.push({ field: 'mcp.transport', message: 'required field missing' });
      } else if (!['stdio', 'sse', 'streamable-http'].includes(manifest.mcp.transport)) {
        errors.push({ field: 'mcp.transport', message: 'must be stdio, sse, or streamable-http' });
      }
      if (!manifest.mcp.command) {
        errors.push({ field: 'mcp.command', message: 'required field missing' });
      }
    }
  }

  // Skill 配置验证
  if (manifest.type === 'skill') {
    if (!manifest.skill) {
      errors.push({ field: 'skill', message: 'required for type=skill' });
    } else {
      if (!manifest.skill.content) {
        errors.push({ field: 'skill.content', message: 'required field missing' });
      } else {
        const contentSize = Buffer.byteLength(manifest.skill.content, 'utf-8');
        if (contentSize > 50 * 1024) {
          errors.push({ field: 'skill.content', message: `content exceeds 50KB limit (${(contentSize / 1024).toFixed(1)}KB)` });
        }
      }
    }
  }

  return errors;
}

/**
 * 简单的 semver 验证
 */
function isValidSemver(version: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-((0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$/.test(version);
}
