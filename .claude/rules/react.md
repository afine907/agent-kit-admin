---
description: "React 开发规范"
globs: ["apps/web/**/*.tsx", "apps/web/**/*.ts"]
---

# React 开发规范

## 组件规范

### 函数组件
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
```

### 组件组织
```typescript
// 1. 类型定义
interface Props {
  title: string
  items: Item[]
}

// 2. 组件实现
export function ItemList({ title, items }: Props) {
  // 3. Hooks
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 4. 事件处理
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  // 5. 渲染
  return (
    <div>
      <h2>{title}</h2>
      {items.map(item => (
        <Item
          key={item.id}
          item={item}
          isSelected={item.id === selectedId}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
```

## Hooks 规范

### 自定义 Hooks
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
```

### Hook 依赖
```typescript
// ✅ 正确的依赖数组
useEffect(() => {
  fetchUser(userId)
}, [userId])  // 明确依赖

// ❌ 缺少依赖
useEffect(() => {
  fetchUser(userId)
}, [])  // userId 变化时不会重新执行
```

## 状态管理

### Zustand Store
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

### TanStack Query
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

### 代码分割
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
```

### 避免不必要的重渲染
```typescript
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

### Tailwind CSS
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

## 错误处理

### 错误边界
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
