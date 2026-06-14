# 技术栈

## 总览

| 组件 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 后端 API | Python | 3.11+ | FastAPI 框架 |
| CLI | Node.js / TypeScript | 18+ | Commander.js |
| 前端 | React + Vite | 18+ | SPA + shadcn/ui |
| 数据库 | PostgreSQL | 16 | 主数据库 |
| 对象存储 | MinIO | latest | S3 兼容 |
| 网关 | Caddy | latest | 自动 HTTPS |

## 后端技术栈

### 核心依赖

```toml
[project]
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.29.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "minio>=7.2.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "httpx>=0.25.0",
    "alembic>=1.13.0",
    "gunicorn>=21.2.0",
]
```

### 选型理由

| 库 | 理由 |
|---|---|
| FastAPI | 高性能异步框架，自动生成 OpenAPI 文档 |
| SQLAlchemy 2.0 | 成熟 ORM，async 支持好 |
| asyncpg | 高性能 PostgreSQL 异步驱动 |
| Pydantic v2 | 数据验证，与 FastAPI 深度集成 |
| MinIO Python SDK | S3 兼容，Docker 友好 |

### 性能优化

```python
# 1. 连接池配置
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# 2. 缓存层（可选，后期加 Redis）
# 注意：lru_cache 不能缓存协程，需使用 async-lru
from async_lru import alru_cache

@alru_cache(maxsize=1000)
async def get_package_metadata(name: str):
    ...

# 3. Gunicorn 多 Worker
# gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
```

## CLI 技术栈

### 核心依赖

```json
{
  "dependencies": {
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0",
    "@inquirer/prompts": "^3.0.0",
    "conf": "^11.0.0",
    "got": "^11.8.6",
    "tar": "^6.2.0",
    "semver": "^7.5.0",
    "open": "^9.0.0",
    "express": "^4.18.0",
    "smol-toml": "^1.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 选型理由

| 库 | 理由 |
|---|---|
| Commander.js | 成熟的 CLI 框架 |
| chalk + ora | 终端美化，用户体验好 |
| @inquirer/prompts | 交互式提示 |
| conf | 配置文件持久化 |
| got | HTTP 客户端 |
| tar | 打包/解包 |
| semver | 语义化版本处理 |

### 发布方式

```json
{
  "name": "@agent-kit-admin/cli",
  "version": "0.1.0",
  "bin": {
    "akit": "./dist/bin/akit.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/bin/akit.ts",
    "prepublishOnly": "npm run build"
  }
}
```

用户安装：
```bash
npm install -g @agent-kit-admin/cli
```

## 前端技术栈

### 技术选型

采用纯 React SPA 架构，放弃 SSR（私有化部署场景不需要 SEO）：

```
React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS
```

### 核心依赖

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "lucide-react": "^0.300.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "@radix-ui/react-*": "^1.0.0",
    "date-fns": "^3.0.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "oxlint": "^1.69.0"
  }
}
```

### 选型理由

| 库 | 理由 |
|---|---|
| **Vite** | 构建速度极快（比 Webpack 快 10x），HMR 即时 |
| **React 18** | 成熟稳定，生态最好 |
| **shadcn/ui** | 现代设计，零依赖，完全可控，GitHub 50k+ stars |
| **TanStack Query** | 最佳数据请求方案，缓存、重试、乐观更新 |
| **Zustand** | 轻量状态管理（2KB），比 Redux 简单 |
| **React Router** | 标准路由方案 |
| **React Hook Form + Zod** | 表单 + 验证，性能好 |
| **Lucide React** | 精美的图标库 |
| **oxlint** | Rust 编写的超快 linter，比 ESLint 快 50-100x，零配置 |

### 为什么选 shadcn/ui

| 特性 | shadcn/ui | Ant Design | MUI |
|---|---|---|---|
| 设计风格 | 现代极简 | 企业后台 | Material |
| 包大小 | 零依赖 | ~1MB | ~500KB |
| 定制性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 无障碍 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| TypeScript | 原生 | 支持 | 支持 |
| 学习曲线 | 低 | 中 | 中 |

**核心优势：**
- 代码复制到项目，不引入第三方依赖
- 基于 Radix UI，无障碍访问（a11y）最佳
- Tailwind CSS 样式，完全可控
- 设计语言类似 Vercel/Stripe，现代感强

### 前端目录结构

```
web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── components.json            # shadcn/ui 配置
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css              # Tailwind imports
│   │
│   ├── components/
│   │   └── ui/                # shadcn/ui 组件（自动生成）
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       ├── toast.tsx
│   │       └── ...
│   │
│   ├── layouts/
│   │   ├── RootLayout.tsx
│   │   ├── DashboardLayout.tsx
│   │   └── AuthLayout.tsx
│   │
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── packages/
│   │   │   ├── PackageList.tsx
│   │   │   ├── PackageDetail.tsx
│   │   │   └── PackageSearch.tsx
│   │   ├── dashboard/
│   │   │   ├── Overview.tsx
│   │   │   ├── MyPackages.tsx
│   │   │   └── Settings.tsx
│   │   └── admin/
│   │       ├── Users.tsx
│   │       └── Teams.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePackages.ts
│   │   └── useUser.ts
│   │
│   ├── lib/
│   │   ├── api.ts             # Axios 实例
│   │   ├── auth.ts            # 认证逻辑
│   │   ├── queryClient.ts     # TanStack Query 配置
│   │   └── utils.ts           # 工具函数
│   │
│   ├── stores/
│   │   ├── authStore.ts       # 认证状态
│   │   └── uiStore.ts         # UI 状态
│   │
│   ├── types/
│   │   ├── package.ts
│   │   ├── user.ts
│   │   └── api.ts
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   └── favicon.ico
│
└── Dockerfile
```

### 前端路由表

使用 React Router v6，路由结构如下：

```typescript
// src/App.tsx
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },              // 首页：包列表
      { path: "login", element: <Login /> },            // 登录页
      {
        path: "packages/:scope/:name",
        element: <PackageDetail />,                      // 包详情页
      },
      {
        path: "dashboard",
        element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
        children: [
          { index: true, element: <Overview /> },       // 仪表盘概览
          { path: "my-packages", element: <MyPackages /> }, // 我的包
          { path: "api-keys", element: <ApiKeys /> },   // API Key 管理
          { path: "settings", element: <Settings /> },  // 个人设置
        ],
      },
      {
        path: "admin",
        element: <ProtectedRoute requireRole="admin"><AdminLayout /></ProtectedRoute>,
        children: [
          { path: "users", element: <Users /> },        // 用户管理
          { path: "teams", element: <Teams /> },        // 团队管理
        ],
      },
      { path: "*", element: <NotFound /> },             // 404
    ],
  },
]);
```

| 路径 | 页面 | 权限 | 说明 |
|---|---|---|---|
| `/` | Home | 公开 | 包列表，搜索/筛选/排序 |
| `/login` | Login | 公开 | OAuth 登录 |
| `/packages/:scope/:name` | PackageDetail | 公开 | 包详情、版本、评分 |
| `/dashboard` | DashboardLayout | 登录 | 仪表盘布局 |
| `/dashboard/my-packages` | MyPackages | 登录 | 我发布的包 |
| `/dashboard/api-keys` | ApiKeys | 登录 | API Key 管理 |
| `/dashboard/settings` | Settings | 登录 | 个人设置 |
| `/admin/users` | Users | admin+ | 用户管理 |
| `/admin/teams` | Teams | admin+ | 团队管理 |

### 状态管理职责划分

| 状态类型 | 管理方案 | 示例 |
|---|---|---|
| **服务端数据** | `@tanstack/react-query` | 包列表、用户信息、版本列表、评分 |
| **认证状态** | `zustand` (authStore) | JWT Token、当前用户、登录状态 |
| **UI 状态** | `zustand` (uiStore) | 侧边栏开关、主题偏好、toast 消息 |
| **表单状态** | `react-hook-form` | 登录表单、发布表单、评分表单 |
| **URL 状态** | React Router | 当前页面、筛选参数、分页页码 |

**原则：** 能用 URL 参数管理的状态（如搜索关键词、页码）优先放 URL，方便分享和刷新。

### API 客户端配置

```typescript
// src/lib/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 30_000,
})

// 请求拦截器：自动附加 Token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export { api }
```

## 基础设施

### Docker Compose 服务

```yaml
services:
  db:
    image: postgres:16-alpine

  minio:
    image: minio/minio

  server:
    build: ./server

  web:
    build: ./web

  caddy:
    image: caddy:2-alpine
```

### 环境变量

```bash
# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/agentkit

# MinIO（统一使用 MINIO_ROOT_USER / MINIO_ROOT_PASSWORD）
MINIO_ENDPOINT=minio:9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=packages

# OAuth - 企微（统一使用 WECHAT_WORK_SECRET）
WECHAT_WORK_CORP_ID=
WECHAT_WORK_AGENT_ID=
WECHAT_WORK_SECRET=

# OAuth - 飞书
FEISHU_APP_ID=
FEISHU_APP_SECRET=

# OAuth - 钉钉
DINGTALK_APP_KEY=
DINGTALK_APP_SECRET=

# JWT
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```
