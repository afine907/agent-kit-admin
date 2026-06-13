# Phase 1: MVP SPEC

## 目标

最小可用版本，核心流程闭环。用户能在 3 分钟内完成从零到安装第一个 MCP。

## 时间

Week 1-3 (3 周)

## 技术栈

| 组件 | 技术 |
|---|---|
| Server | Python 3.11+ / FastAPI / SQLAlchemy 2.0 (async) / Alembic |
| CLI | Node.js 18+ / TypeScript / Commander.js |
| Web | React 18 / Vite 5 / shadcn/ui / TypeScript |
| DB | PostgreSQL 16 |
| Storage | MinIO (S3-compatible) |
| Gateway | Caddy |

## 用户故事

| ID | 故事 | 验收标准 |
|---|---|---|
| US-001 | 作为开发者，我想发布 MCP 包 | `akit publish` 上传成功，Web UI 可见 |
| US-002 | 作为开发者，我想发布 Skill 包 | `akit publish` 上传成功，Web UI 可见 |
| US-004 | 作为开发者，我想安装包到 Claude Code | `akit install` 写入 `~/.claude/mcp.json` |
| US-005 | 作为开发者，我想安装包到 Codex | `akit install` 写入 `~/.codex/config.toml` |
| US-011 | 作为用户，我想浏览包列表 | Web UI 首页显示包列表，支持搜索 |
| US-012 | 作为用户，我想查看包详情 | Web UI 详情页显示描述、版本、安装命令 |
| US-013 | 作为用户，我想登录系统 | OAuth 登录成功，获取 JWT Token |
| US-017 | 作为开发者，我想通过 CLI 登录 | `akit login` 浏览器授权后获取 Token |

---

## 模块 1: 基础设施

### 1.1 项目脚手架

```
agent-kit-admin/
├── server/                  # Python 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI 入口
│   │   ├── config.py        # Pydantic Settings
│   │   ├── database.py      # AsyncSession 工厂
│   │   ├── errors.py        # AppError 统一异常
│   │   ├── models/          # SQLAlchemy ORM
│   │   ├── schemas/         # Pydantic 请求/响应
│   │   ├── api/             # 路由层
│   │   ├── services/        # 业务逻辑层
│   │   ├── middleware/      # 中间件
│   │   └── utils/           # 工具函数
│   ├── alembic/             # 数据库迁移
│   ├── tests/
│   ├── pyproject.toml
│   ├── alembic.ini
│   └── Dockerfile
│
├── cli/                     # Node.js CLI
│   ├── src/
│   │   ├── bin/akit.ts      # CLI 入口
│   │   ├── commands/        # 命令实现
│   │   ├── agents/          # Agent 适配器
│   │   ├── api/             # API 客户端
│   │   ├── config/          # 配置管理
│   │   └── utils/           # 工具函数
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── web/                     # React 前端
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── lib/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── deploy/
│   ├── Caddyfile
│   ├── docker-compose.yml
│   └── .env.example
│
├── scripts/
│   ├── start.sh
│   └── init-db.sh
│
├── docker-compose.yml       # 开发环境
└── Makefile
```

### 1.2 Docker Compose

开发环境 `docker-compose.yml`:

| 服务 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| db | postgres:16 | 5432 | PostgreSQL |
| minio | minio/minio | 9000, 9001 | 对象存储 |
| minio-init | minio/mc | - | 初始化 bucket |
| server | 自建 | 8000 | FastAPI |
| web | 自建 | 5173 | Vite dev |
| caddy | caddy:2 | 80, 443 | 网关 |

### 1.3 环境变量

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://agentkit:agentkit@db:5432/agentkit

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=packages
MINIO_USE_SSL=false

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# OAuth
OAUTH_WECHAT_WORK_CORP_ID=
OAUTH_WECHAT_WORK_CORP_SECRET=
OAUTH_FEISHU_APP_ID=
OAUTH_FEISHU_APP_SECRET=
OAUTH_DINGTALK_APP_KEY=
OAUTH_DINGTALK_APP_SECRET=

# 应用
APP_ENV=development
APP_BASE_URL=http://localhost
```

---

## 模块 2: 数据库

### 2.1 表结构 (参考 `wiki/04-data-model.md`)

MVP 需要的表：

| 表 | 说明 |
|---|---|
| `users` | 用户表 |
| `packages` | 包表 |
| `versions` | 版本表 |
| `downloads` | 下载记录表 |

### 2.2 Alembic 迁移

- [ ] 初始化 Alembic
- [ ] 创建初始迁移
- [ ] 创建迁移脚本

---

## 模块 3: Server (Python/FastAPI)

### 3.1 中间件

| 中间件 | 说明 | 优先级 |
|---|---|---|
| CORS | 跨域支持 | P0 |
| RequestID | 请求追踪 | P0 |
| Logging | 请求日志 | P0 |
| RateLimit | 限流 (MVP 简化版) | P1 |

### 3.2 认证模块 (`api/auth.py`)

| 端点 | 方法 | 说明 | 认证 |
|---|---|---|---|
| `/api/v1/auth/oauth/:provider` | POST | 发起 OAuth | ❌ |
| `/api/v1/auth/oauth/:provider/callback` | GET | OAuth 回调 | ❌ |
| `/api/v1/auth/me` | GET | 当前用户 | ✅ |

**OAuth 流程:**
1. 前端调用 `POST /api/v1/auth/oauth/:provider`
2. 后端返回授权 URL
3. 前端跳转到授权页
4. 用户授权后回调 `GET /api/v1/auth/oauth/:provider/callback`
5. 后端用 code 换取用户信息，创建/更新用户，返回 JWT

**支持的 Provider:**
- WeChat Work (企业微信)
- Feishu (飞书)
- DingTalk (钉钉)

### 3.3 包管理模块 (`api/packages.py`)

| 端点 | 方法 | 说明 | 认证 |
|---|---|---|---|
| `/api/v1/packages` | GET | 包列表 | ❌ |
| `/api/v1/packages/:scope/:name` | GET | 包详情 | ❌ |
| `/api/v1/packages` | POST | 创建包 | ✅ |
| `/api/v1/packages/:scope/:name/versions` | GET | 版本列表 | ❌ |
| `/api/v1/packages/:scope/:name/versions` | POST | 发布版本 | ✅ |
| `/api/v1/packages/:scope/:name/download` | GET | 下载包 | ❌ |

**包列表查询参数:**
- `search` - 搜索关键词 (ILIKE 匹配 name, description)
- `type` - 筛选类型 (mcp/skill)
- `page` - 页码 (默认 1)
- `per_page` - 每页数量 (默认 20, 最大 100)

**下载流程:**
1. 客户端请求 `GET /api/v1/packages/:scope/:name/download`
2. 可选查询参数: `version` (默认 latest)
3. 后端查询版本对应的 MinIO 对象
4. 返回 302 重定向到 MinIO 预签名 URL

### 3.4 版本管理

**发布版本流程:**
1. 验证 `akit.json` 格式 (参考 `wiki/18-manifest-schema.md`)
2. 上传 `.tar.gz` 到 MinIO
3. 创建版本记录
4. 如果是第一个版本，自动设置为 `latest` tag

**版本标签规则:**
- 首次发布自动设置 `latest`
- 预发布版本 (alpha/beta/rc) 不改变 `latest`
- `akit install` 默认安装 `latest`

### 3.5 统一错误处理

```python
class AppError(HTTPException):
    def __init__(self, code: int, message: str, status_code: int = 400):
        self.error_code = code
        self.error_message = message
        super().__init__(status_code=status_code, detail=message)
```

错误码参考 `wiki/05-api-design.md`。

---

## 模块 4: CLI (Node.js/TypeScript)

### 4.1 命令清单

| 命令 | 说明 | 优先级 |
|---|---|---|
| `akit login` | OAuth 登录 | P0 |
| `akit publish` | 发布包 | P0 |
| `akit install` | 安装包 | P0 |
| `akit uninstall` | 卸载包 | P0 |
| `akit list` | 已安装列表 | P1 |
| `akit search` | 搜索包 | P1 |
| `akit info` | 包详情 | P1 |

### 4.2 `akit login`

```
交互流程:
1. 显示支持的 OAuth Provider 列表
2. 用户选择 Provider
3. 打开浏览器跳转授权页
4. 启动本地 HTTP 服务器接收回调
5. 获取 JWT Token
6. 保存到 ~/.akit/credentials.json

输出:
✔ Login successful! Token saved to ~/.akit/credentials.json
```

### 4.3 `akit publish`

```
交互流程:
1. 读取当前目录的 akit.json
2. 验证 manifest 格式
3. 打包目录为 .tar.gz
4. 调用 API 创建包 (如果不存在)
5. 调用 API 上传版本
6. 显示发布成功

参数:
  --token <token>    CI/CD Token 认证
  --tag <tag>        版本标签 (latest/beta/alpha/rc)

输出:
✔ Published @scope/name@1.0.0
  Install: akit install @scope/name
```

### 4.4 `akit install`

```
交互流程:
1. 解析包名 (@scope/name 或 name)
2. 调用 API 获取包信息
3. 调用 API 获取下载 URL
4. 下载 .tar.gz 到临时目录
5. 解压到 ~/.akit/packages/@scope/name/
6. 检测已安装的 Agent
7. 写入 Agent 配置

参数:
  --agent <name>     指定 Agent (claude/codex)
  --tag <tag>        版本标签 (默认 latest)
  --global           全局安装 (默认)

输出:
✔ Installed @scope/name@1.0.0
  Agent: Claude Code
  Config: ~/.claude/mcp.json
```

### 4.5 Agent 适配器

**适配器接口:**
```typescript
interface AgentAdapter {
  name: string
  detect(): Promise<boolean>
  getConfigPath(): string
  readConfig(): Promise<MCPConfig>
  writeConfig(entry: MCPEntry): Promise<void>
  removeConfig(packageName: string): Promise<void>
  hasConfig(packageName: string): Promise<boolean>
}
```

**MVP 适配器:**

| Agent | 配置路径 | 格式 |
|---|---|---|
| Claude Code | `~/.claude/mcp.json` | JSON (`mcpServers`) |
| Codex | `~/.codex/config.toml` | TOML (`[mcp_servers]`) |

### 4.6 API 客户端

```typescript
// cli/src/api/client.ts
class ApiClient {
  constructor(private baseUrl: string, private token?: string) {}

  async listPackages(params: ListPackagesParams): Promise<PackageListResponse>
  async getPackage(scope: string, name: string): Promise<PackageResponse>
  async getVersions(scope: string, name: string): Promise<VersionListResponse>
  async createPackage(data: CreatePackageRequest): Promise<PackageResponse>
  async publishVersion(scope: string, name: string, data: FormData): Promise<VersionResponse>
  async getDownloadUrl(scope: string, name: string, version?: string): Promise<string>
}
```

---

## 模块 5: Web UI (React/Vite)

### 5.1 页面清单

| 页面 | 路由 | 说明 |
|---|---|---|
| 首页 | `/` | 包列表，搜索、筛选、排序 |
| 包详情 | `/packages/:scope/:name` | 描述、版本、安装命令 |
| 登录 | `/login` | OAuth 登录 |
| 个人中心 | `/profile` | 我的包列表 |

### 5.2 组件结构

```
web/src/
├── components/
│   ├── ui/                  # shadcn/ui
│   ├── layout/
│   │   ├── Header.tsx       # 导航栏
│   │   ├── Footer.tsx       # 页脚
│   │   └── Sidebar.tsx      # 侧边栏
│   ├── PackageCard.tsx      # 包卡片
│   ├── SearchBar.tsx        # 搜索框
│   ├── VersionList.tsx      # 版本列表
│   └── InstallCommand.tsx   # 安装命令复制
├── pages/
│   ├── Home.tsx
│   ├── PackageDetail.tsx
│   ├── Login.tsx
│   └── Profile.tsx
├── hooks/
│   ├── useAuth.ts
│   └── usePackages.ts
├── stores/
│   └── authStore.ts         # Zustand
├── lib/
│   ├── api.ts               # API 客户端
│   └── utils.ts
└── types/
    └── index.ts
```

### 5.3 状态管理

**Zustand Store:**
```typescript
interface AuthStore {
  user: User | null
  token: string | null
  login: (token: string) => void
  logout: () => void
  fetchUser: () => Promise<void>
}
```

**TanStack Query:**
```typescript
// 包列表
useQuery({ queryKey: ['packages', params], queryFn: () => api.listPackages(params) })

// 包详情
useQuery({ queryKey: ['package', scope, name], queryFn: () => api.getPackage(scope, name) })
```

### 5.4 UI 设计要点

- 响应式布局 (桌面优先)
- 中文界面
- 包卡片显示: 名称、描述、类型、版本、下载量
- 详情页显示: 安装命令 (一键复制)、版本历史、描述
- 搜索框: 实时搜索 (防抖 300ms)

---

## 模块 6: 部署

### 6.1 Docker Compose (生产)

参考 `wiki/08-deployment.md`。

### 6.2 初始化脚本

`scripts/start.sh`:
1. 检查 Docker 是否安装
2. 生成 `.env` (随机密码)
3. 启动所有服务
4. 等待服务就绪
5. 运行数据库迁移
6. 初始化 MinIO bucket
7. 输出访问地址

### 6.3 健康检查

`GET /api/health`:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "services": {
    "database": "ok",
    "minio": "ok"
  }
}
```

---

## 明确不做

| 功能 | 推迟到 | 原因 |
|---|---|---|
| 评分/评论 | Phase 2 | 非核心流程 |
| 团队管理 | Phase 2 | 先支持个人使用 |
| 依赖管理 | Phase 3 | 增加复杂度 |
| 包签名 | Phase 3 | 安全增强 |
| Webhook | Phase 3 | 高级功能 |
| 多 Agent (Cursor 等) | Phase 2 | 先做 Claude Code + Codex |
| API Key 认证 | Phase 2 | CI/CD 场景 |
| 包编辑/删除 | Phase 2 | 非核心 |

---

## 验收标准

### 功能验收

| 场景 | 验收标准 |
|---|---|
| OAuth 登录 | 浏览器授权后获取 JWT Token |
| 发布 MCP | `akit publish` 成功，Web UI 可见 |
| 发布 Skill | `akit publish` 成功，Web UI 可见 |
| 安装到 Claude Code | `akit install` 写入配置，MCP 可用 |
| 安装到 Codex | `akit install` 写入配置，MCP 可用 |
| 搜索包 | `akit search` 返回匹配结果 |
| Docker 部署 | `docker compose up` 一键启动 |

### 性能验收

| 指标 | 目标 |
|---|---|
| CLI 安装 (10MB 包) | < 5s |
| API 响应时间 | P95 < 200ms |
| Web 首屏加载 | < 2s |
| Docker 启动时间 | < 30s |

### 体验验收

| 场景 | 目标 |
|---|---|
| 零到安装第一个 MCP | < 3 分钟 |
| 首次 Docker 部署 | < 5 分钟 |
| 学习成本 | 看 README 即可上手 |

---

## 周计划

### Week 1: 基础搭建

- [ ] 项目脚手架 (server/cli/web)
- [ ] 数据库 Schema + Alembic 迁移
- [ ] API 基础框架 (中间件、错误处理)
- [ ] Docker Compose 基础配置
- [ ] MinIO 存储服务

### Week 2: 核心功能

- [ ] CLI: `login`, `publish`, `install`
- [ ] API: 包 CRUD + 版本管理
- [ ] Agent 适配器: Claude Code
- [ ] Web UI: 登录 + 包列表

### Week 3: 完善和测试

- [ ] Agent 适配器: Codex
- [ ] CLI: `list`, `search`, `info`, `uninstall`
- [ ] Web UI: 包详情 + 个人中心
- [ ] 集成测试
- [ ] 文档编写
