---
description: "TypeScript/JavaScript 开发规范"
globs: ["apps/cli/**/*.ts", "apps/web/**/*.ts", "apps/web/**/*.tsx"]
---

# TypeScript/JavaScript 开发规范

## TypeScript 配置

始终启用严格模式（`strict: true`）

### 路径别名
```typescript
// ✅ 使用 @ 别名
import { config } from '@/config'
import { UserService } from '@/services/user'

// ❌ 避免深层相对路径
import { helper } from '../../../utils/helper'
```

## 类型系统

### 优先使用类型推断
```typescript
// ✅ 让 TypeScript 推断
const users = await fetchUsers() // User[]

// ❌ 不必要的类型注解
const users: User[] = await fetchUsers()
```

### 使用接口定义对象形状
```typescript
// ✅ 使用接口
interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}
```

## 异步编程

### 使用 async/await
```typescript
// ✅ 使用 async/await
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch user')
  }
  return response.json()
}
```

### 错误处理
```typescript
// ✅ 具体的错误类型
class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User ${userId} not found`)
    this.name = 'UserNotFoundError'
  }
}
```

## 代码组织

### 导出模式
```typescript
// ✅ 命名导出（便于重构和 tree-shaking）
export function createUser(data: CreateUserDTO): User {
  // 实现
}
```

## 常见陷阱

### 避免类型断言
```typescript
// ❌ 使用 as 断言
const user = data as User

// ✅ 使用类型守卫
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'id' in data
}
```
