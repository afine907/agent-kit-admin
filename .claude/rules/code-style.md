---
description: "代码风格和格式化规范"
globs: ["**/*.ts", "**/*.tsx", "**/*.py"]
---

# 代码风格规范

## 通用原则

- **一致性**: 遵循项目中已有的代码风格
- **可读性**: 代码是写给人看的，顺便让机器执行
- **简洁性**: 避免过度工程化，保持简单直接

## 命名规范

### TypeScript/JavaScript
- 变量和函数: `camelCase`
- 类和接口: `PascalCase`
- 常量: `UPPER_SNAKE_CASE`
- 文件名: `kebab-case.ts` 或 `PascalCase.tsx` (组件)
- 类型/接口: 使用 `I` 前缀仅在需要区分时（如 `IUser` vs `User` class）

### Python
- 变量和函数: `snake_case`
- 类: `PascalCase`
- 常量: `UPPER_SNAKE_CASE`
- 私有成员: `_single_leading_underscore`
- 文件名: `snake_case.py`

## 格式化

### TypeScript/JavaScript
- 使用 ESLint + Prettier 进行格式化
- 缩进: 2 空格
- 行宽: 120 字符
- 引号: 单引号 `'` 用于 JS/TS，双引号 `"` 用于 JSX
- 分号: 不使用（ASI）

### Python
- 使用 Ruff 进行格式化和 linting
- 缩进: 4 空格
- 行宽: 120 字符
- 引号: 双引号 `"`
- 遵循 PEP 8 规范

## 导入顺序

### TypeScript/JavaScript
```typescript
// 1. Node.js 内置模块
import path from 'path'
import fs from 'fs/promises'

// 2. 第三方库
import axios from 'axios'
import chalk from 'chalk'

// 3. 项目内部模块 (绝对路径)
import { config } from '@/config'
import { UserService } from '@/services/user'

// 4. 项目内部模块 (相对路径)
import './styles.css'
import { helper } from './utils'
```

### Python
```python
# 1. 标准库
import os
import sys
from pathlib import Path
from typing import Optional

# 2. 第三方库
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

# 3. 项目内部模块
from app.core.config import settings
from app.models.user import User
from app.services.auth import AuthService
```

## 注释规范

- 使用有意义的变量名减少注释需求
- 复杂逻辑必须添加注释说明 **为什么** 这样做
- 公共 API 使用 JSDoc (TypeScript) 或 docstring (Python)
- TODO 注释格式: `// TODO(username): 描述` 或 `# TODO(username): 描述`

## 错误处理

- 始终处理错误，不要忽略 Promise rejection
- 使用具体的错误类型，避免捕获通用 Exception
- 在适当的层级处理错误，不要吞掉错误
