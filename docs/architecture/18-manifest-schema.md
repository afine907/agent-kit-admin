# Manifest Schema (akit.json)

## 概述

`akit.json` 是 Agent Kit Admin 的包描述文件，类似于 Node.js 的 `package.json`。每个发布的 Skill 包都必须包含此文件。

---

## 完整 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://agent-kit.dev/schemas/akit-manifest.json",
  "title": "Agent Kit Manifest",
  "description": "akit.json 包描述文件的 JSON Schema 定义",
  "type": "object",
  "required": ["name", "version", "type"],
  "additionalProperties": false,

  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9]([a-z0-9-]*[a-z0-9])?$",
      "minLength": 1,
      "maxLength": 100,
      "description": "包名（不含 scope），小写字母、数字、连字符"
    },

    "scope": {
      "type": "string",
      "pattern": "^@[a-z0-9][a-z0-9-]*$",
      "minLength": 2,
      "maxLength": 50,
      "description": "作用域，如 @team 或 @username"
    },

    "version": {
      "type": "string",
      "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(-((0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(\\.(0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(\\+[0-9a-zA-Z-]+(\\.[0-9a-zA-Z-]+)*)?$",
      "description": "语义化版本号 (semver)，如 1.0.0、1.0.0-beta.1"
    },

    "type": {
      "type": "string",
      "const": "skill",
      "description": "包类型：固定为 skill（Agent 技能）"
    },

    "description": {
      "type": "string",
      "maxLength": 500,
      "description": "包的简短描述"
    },

    "license": {
      "type": "string",
      "default": "MIT",
      "description": "开源协议标识符"
    },

    "repository": {
      "type": "string",
      "format": "uri",
      "description": "Git 仓库地址"
    },

    "homepage": {
      "type": "string",
      "format": "uri",
      "description": "项目主页"
    },

    "main": {
      "type": "string",
      "description": "入口文件路径"
    },

    "files": {
      "type": "array",
      "items": { "type": "string" },
      "description": "需要包含在包中的文件列表（支持 glob 模式）"
    },

    "keywords": {
      "type": "array",
      "items": { "type": "string", "maxLength": 30 },
      "maxItems": 10,
      "description": "关键词，用于搜索"
    },

    "dependencies": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "description": "版本约束（semver range）"
      },
      "description": "依赖的其他包"
    },

    "engines": {
      "type": "object",
      "properties": {
        "node": { "type": "string", "description": "Node.js 版本约束" },
        "python": { "type": "string", "description": "Python 版本约束" }
      },
      "description": "运行环境版本要求"
    },

    "skill": {
      "$ref": "#/$defs/skillConfig",
      "description": "Skill 配置（type=skill 时必填）"
    }
  },

  "$defs": {
    "skillConfig": {
      "type": "object",
      "required": ["content"],
      "properties": {
        "trigger": {
          "type": "string",
          "enum": ["command", "auto"],
          "default": "command",
          "description": "触发方式：command（斜杠命令）或 auto（自动触发）"
        },
        "command": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "斜杠命令名（trigger=command 时使用）"
        },
        "content": {
          "type": "string",
          "maxLength": 50000,
          "description": "Skill 的 Prompt 内容（Markdown 格式）"
        },
        "hooks": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["pre-commit", "post-commit", "pre-push", "pre-install", "post-install"]
          },
          "description": "生命周期钩子"
        },
        "permissions": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["read-files", "write-files", "execute-commands", "network-access"]
          },
          "description": "所需权限"
        }
      }
    }
  }
}
```

---

## 必填字段规则

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | ✅ 必填 | 包名 |
| `version` | ✅ 必填 | 版本号 |
| `type` | ✅ 必填 | 固定为 `skill` |
| `skill` | ✅ 必填 | Skill 配置 |
| `description` | 推荐 | 描述信息 |
| `main` | 可选 | 入口文件 |

---

## 示例

### Skill 包

```json
{
  "name": "code-review",
  "scope": "@team",
  "version": "1.0.0",
  "type": "skill",
  "description": "Automated code review skill",
  "license": "MIT",
  "skill": {
    "trigger": "command",
    "command": "review",
    "content": "Review the code changes in the current diff...\n\nProvide feedback on:\n1. Code quality\n2. Potential bugs\n3. Performance issues",
    "hooks": ["pre-commit"],
    "permissions": ["read-files"]
  }
}
```

### 带依赖的包

```json
{
  "name": "enhanced-search",
  "scope": "@team",
  "version": "2.0.0",
  "type": "skill",
  "description": "Enhanced search with caching",
  "dependencies": {
    "@team/web-search": "^1.0.0",
    "@team/cache-skill": "^1.2.0"
  },
  "skill": {
    "trigger": "command",
    "command": "search",
    "content": "Search the web and cache results for faster subsequent queries...",
    "permissions": ["network-access"]
  }
}
```

---

## 校验规则

### 包名校验

- 仅允许小写字母、数字、连字符
- 不能以连字符开头或结尾
- 长度 1-100 字符
- 保留字：`admin`、`api`、`system`、`root`、`test`、`official`

### Scope 校验

- 以 `@` 开头
- 仅允许小写字母、数字、连字符
- 长度 2-50 字符

### 版本号校验

- 必须是合法的 semver 格式
- 支持 pre-release 标签（如 `1.0.0-beta.1`）
- 支持 build metadata（如 `1.0.0+build.123`）

### Skill content 校验

- 最大 50000 字符
- 必须是非空字符串
- 建议使用 Markdown 格式

---

## CLI 校验

`akit publish` 时 CLI 会自动校验 manifest：

```bash
$ akit publish

⠋ Validating akit.json...
  ✓ name: web-search
  ✓ version: 1.2.0
  ✓ type: skill
  ✓ skill.content: 最大 50000 字符
  ✗ skill.content: required field missing

✖ Error: Invalid manifest
  See: https://agent-kit.dev/schemas/akit-manifest.json
```

---

## 迁移指南

### 从 v1 manifest 升级

如果未来 manifest 格式有 breaking change，CLI 会提供自动迁移：

```bash
$ akit migrate
⠋ Migrating akit.json from v1 to v2...
✔ Migration complete
```
