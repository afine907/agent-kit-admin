---
description: "React 开发规范"
globs: ["apps/web/**/*.tsx", "apps/web/**/*.ts"]
---

# React 开发规范

## 组件规范

```typescript
// ✅ 使用函数组件和 TypeScript
interface UserCardProps {
  user: User
  onSelect?: (userId: string) => void
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div onClick={() => onSelect?.(user.id)}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  )
}

// ✅ 组件组织结构
// 1. 类型定义
// 2. 组件实现
// 3. Hooks
// 4. 事件处理
// 5. 渲染
```

## Hooks 规范

```typescript
// ✅ 自定义 Hook 以 use 开头
function useUser(userId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })

  return {
    user: data,
    isLoading,
    error,
  }
}

// ✅ 正确的依赖数组
useEffect(() => {
  fetchUser(userId)
}, [userId])  // 明确依赖

// ❌ 缺少依赖
useEffect(() => {
  fetchUser(userId)
}, [])  // userId 变化时不会重新执行
```

## i18n 与 Hooks 依赖

- **错误**: 在 `useCallback`/`useEffect` 中使用 `t()` 函数但未加入依赖数组
- **原因**: `t` 是从 `useTranslation()` 解构的函数，引用可能随语言切换变化
- **正确做法**: `useCallback` 的依赖数组必须包含 `t`
- **场景**: 组件使用 `useTranslation()` 且在 `useCallback`/`useEffect` 中调用 `t()`
- **来源**: 2026-07-08

```typescript
// ✅ 正确：t 在依赖数组中
const handleSearch = useCallback((value: string) => {
  setError(t('search.failed'))
}, [t])

// ❌ 错误：缺少 t
const handleSearch = useCallback((value: string) => {
  setError(t('search.failed'))
}, [])
```

## 状态管理

```typescript
// ✅ 使用 Zustand 进行全局状态管理
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface UserStore {
  users: User[]
  selectedUser: User | null
  addUser: (user: User) => void
  selectUser: (user: User | null) => void
}

const useUserStore = create<UserStore>()(
  devtools(
    (set) => ({
      users: [],
      selectedUser: null,
      addUser: (user) =>
        set((state) => ({ users: [...state.users, user] })),
      selectUser: (user) => set({ selectedUser: user }),
    }),
    { name: 'user-store' }
  )
)
```

## 数据获取

```typescript
// ✅ 使用 TanStack Query 进行数据获取
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function UserList() {
  const queryClient = useQueryClient()

  // 查询
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 分钟
  })

  // 变更
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (newUser) => {
      // 更新缓存
      queryClient.setQueryData(['users'], (old: User[]) => [
        ...old,
        newUser,
      ])
      // 或者使缓存失效
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  if (isLoading) return <Loading />

  return (
    <div>
      {users?.map(user => <UserCard key={user.id} user={user} />)}
      <CreateUserForm
        onSubmit={createUserMutation.mutate}
        isLoading={createUserMutation.isPending}
      />
    </div>
  )
}
```

## 性能优化

```typescript
// ✅ 使用 React.lazy 进行代码分割
const HeavyComponent = lazy(() => import('./HeavyComponent'))

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  )
}

// ✅ 使用 React.memo 缓存组件
const UserCard = React.memo(function UserCard({ user }: UserCardProps) {
  return <div>{user.name}</div>
})

// ✅ 使用 useMemo 缓存计算结果
function UserStats({ users }: { users: User[] }) {
  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter(u => u.isActive).length,
    }),
    [users]
  )

  return <div>Total: {stats.total}, Active: {stats.active}</div>
}
```

## 样式规范

```typescript
// ✅ 使用 Tailwind CSS 工具类
function Button({ children, variant = 'primary' }: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded font-medium'
  const variantStyles = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  }

  return (
    <button className={cn(baseStyles, variantStyles[variant])}>
      {children}
    </button>
  )
}

// ✅ 使用 clsx/tailwind-merge 处理条件类名
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## API 集成模式

页面接入后端 API 时的标准模式：loading → data/error 三态 + useCallback + useEffect。

```typescript
// ✅ 标准 API 集成模式
import { useState, useEffect, useCallback } from 'react';
import { api, type Team } from '../lib/api';  // 类型从 api.ts 统一导出

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listTeams();
      setTeams(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  // loading/error/data 三态渲染
  if (loading && teams.length === 0) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  return <TeamList teams={teams} />;
}
```

**规则**：
- 类型定义统一在 `api.ts` 中导出，页面不内联类型
- 使用 `useCallback` 包裹异步函数，避免 useEffect 无限循环
- 错误用 `try/catch` 捕获，`err instanceof Error` 判断类型
- 不使用 `alert()` 展示错误，使用内联 UI

## 错误处理

```typescript
// ✅ 使用 ErrorBoundary 组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
```
