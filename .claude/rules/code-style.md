---
description: "代码风格和格式化规范"
globs: ["**/*.ts", "**/*.tsx", "**/*.py"]
---

# 代码风格规范

## 命名规范

| 类型 | TypeScript/JavaScript | Python |
|---|---|---|
| 变量/函数 | `camelCase` | `snake_case` |
| 类/接口 | `PascalCase` | `PascalCase` |
| 常量 | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
| 文件名 | `kebab-case.ts` / `PascalCase.tsx` | `snake_case.py` |

## 格式化

| 语言 | 工具 | 缩进 | 行宽 | 引号 |
|---|---|---|---|---|
| TypeScript/JavaScript | ESLint + Prettier | 2 空格 | 120 | 单引号 `'` |
| Python | Ruff | 4 空格 | 120 | 双引号 `"` |

## 注释规范

- 复杂逻辑必须注释 **为什么**
- 公共 API 使用 JSDoc (TypeScript) / docstring (Python)
- TODO 格式: `// TODO(username): 描述` 或 `# TODO(username): 描述`

## 错误处理

- 始终处理错误，不忽略 Promise rejection
- 使用具体错误类型，避免捕获通用 Exception
- 在适当层级处理错误，不吞掉错误
