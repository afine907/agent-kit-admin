---
description: "TypeScript/JavaScript 开发规范"
globs: ["apps/cli/**/*.ts", "apps/web/**/*.ts", "apps/web/**/*.tsx"]
---

# TypeScript/JavaScript 开发规范

## TypeScript 配置

### 严格模式
始终启用严格模式:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### 路径别名
使用路径别名简化导入:
```typescript
// 使用 @ 别名指向 src 目录
import { config } from '@/config'
import { UserService } from '@/services/user'

// 避免深层相对路径
// ❌ 不要这样
import { helper } from '../../../utils/helper'

// ✅ 应该这样
import { helper } from '@/utils/helper'
```

## 类型系统

### 优先使用类型推断
```typescript
// ✅ 让 TypeScript 推断类型
const users = await fetchUsers() // User[]
const count = users.length // number

// ❌ 不必要的类型注解
const users: User[] = await fetchUsers()
const count: number = users.length
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

// ❌ 使用 type（除非需要联合类型或交叉类型）
type User = {
  id: string
  name: string
}
```

### 泛型约束
```typescript
// ✅ 使用泛型约束
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

// ❌ 使用 any
function getProperty(obj: any, key: string): any {
  return obj[key]
}
```

### 联合类型和交叉类型
```typescript
// 联合类型: 可能是多种类型之一
type Status = 'pending' | 'active' | 'completed'

// 交叉类型: 组合多个类型
type UserWithPosts = User & { posts: Post[] }
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

// ❌ 使用 Promise chains
function fetchUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch user')
      }
      return response.json()
    })
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

// ✅ 错误边界处理
async function safeFetchUser(id: string): Promise<User | null> {
  try {
    return await fetchUser(id)
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return null
    }
    throw error
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

export function findUser(id: string): User | null {
  // 实现
}

// ❌ 默认导出（除非组件或单导出模块）
export default class UserService {
  // 实现
}
```

### 文件结构
```typescript
// 1. 类型定义
interface UserDTO {
  name: string
  email: string
}

// 2. 常量
const MAX_USERS = 100

// 3. 辅助函数
function validateEmail(email: string): boolean {
  // 实现
}

// 4. 主要导出
export async function createUser(data: UserDTO): Promise<User> {
  // 实现
}
```

## 性能优化

### 懒加载
```typescript
// 动态导入
const heavyModule = await import('./heavy-module')

// React 组件懒加载
const HeavyComponent = lazy(() => import('./HeavyComponent'))
```

### 避免不必要的重渲染
```typescript
// ✅ 使用 useCallback
const handleClick = useCallback(() => {
  // 处理点击
}, [dependency])

// ✅ 使用 useMemo
const expensiveResult = useMemo(() => {
  return computeExpensiveValue(data)
}, [data])
```

## 常见陷阱

### 避免类型断言
```typescript
// ❌ 使用 as 断言
const user = data as User

// ✅ 使用类型守卫
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data
  )
}

if (isUser(data)) {
  // data 是 User 类型
}
```

### 避免空值检查
```typescript
// ❌ 使用可选链作为错误处理
const name = user?.profile?.name

// ✅ 明确处理空值
if (!user?.profile) {
  throw new Error('User profile not found')
}
const name = user.profile.name
```
