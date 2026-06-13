# 架构设计

## 整体架构

```
                    ┌──────────────────────────┐
                    │    Caddy (反代 + TLS)     │
                    └────────────┬─────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
          ┌────────────┐  ┌─────────────────────────┐
          │   React    │  │    FastAPI Server        │
          │ (SPA 前端) │──│  ┌─────────┐ ┌────────┐ │
          │  Vite +    │  │  │ API 层  │ │Registry│ │
          │  shadcn/ui │  │  │ (路由)  │ │(包管理)│ │
          └────────────┘  │  └────┬────┘ └───┬────┘ │
                          │       └─────┬────┘      │
                          └─────────────┼───────────┘
                                        │
                           ┌────────────┼────────────┐
                           ▼                         ▼
                    ┌────────────┐            ┌────────────┐
                    │ PostgreSQL │            │    MinIO   │
                    │  (元数据)  │            │  (包文件)  │
                    └────────────┘            └────────────┘

         ┌──────────────────────────────────────┐
         │            CLI (akit)                │
         │  npm install -g @agent-kit-admin/cli │
         │  ──► 通过 API Server 操作，不直连 DB  │
         └──────────────────────────────────────┘
```

> **说明：** API 层和 Registry 是同一个 FastAPI 应用内的逻辑分层，不是独立服务。API 层负责认证、用户/团队管理等通用接口；Registry 层专门负责包的发布、下载、版本管理等包管理逻辑。

## 组件职责

### Caddy (网关)
- 自动 HTTPS 证书
- 反向代理
- 静态文件服务

### React + Vite (前端)
- Web 管理界面 (SPA)
- 包浏览和搜索
- 用户设置
- 通过 API Server 访问数据（不直连数据库）

### FastAPI (后端 API)
- 包管理 CRUD
- 版本管理
- 评分系统
- 下载统计
- 用户/团队管理

### akit (CLI)
- 用户认证
- 包发布和下载
- Agent 配置自动写入

### PostgreSQL (数据库)
- 用户和团队数据
- 包元数据
- 版本信息
- 评分和统计

### MinIO (对象存储)
- 存储包文件 (tarball)
- S3 兼容 API

## 请求流程

### 包安装流程
```
1. 用户执行: akit install @team/web-search-mcp
2. CLI 请求: GET /api/packages/team/web-search-mcp
3. API 返回包元数据和最新版本信息
4. CLI 请求: GET /api/packages/team/web-search-mcp/versions/1.0.0/download
5. API 返回 MinIO 预签名 URL
6. CLI 从 MinIO 下载 tarball
7. CLI 解压到 ~/.akit/packages/@team/web-search-mcp/
8. CLI 检测 Agent 类型，写入对应配置
9. CLI 记录下载统计
```

### 包发布流程
```
1. 用户执行: akit publish ./
2. CLI 读取 akit.json (manifest)
3. CLI 打包当前目录为 tarball
4. CLI 请求: POST /api/packages/team/web-search-mcp/versions
5. API 返回 MinIO 上传 URL
6. CLI 上传 tarball 到 MinIO
7. API 记录版本信息到数据库
8. 发布完成
```

## 目录结构

```
agent-kit-admin/
├── README.md
├── docker-compose.yml
├── Makefile
│
├── server/                  # Python 后端
│   ├── pyproject.toml
│   ├── alembic/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   └── utils/
│   └── Dockerfile
│
├── cli/                     # Node.js CLI
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── commands/
│   │   ├── config/
│   │   ├── api/
│   │   └── utils/
│   └── bin/
│       └── akit.ts
│
├── web/                     # React + Vite 前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── stores/
│   └── public/
│
├── deploy/docker/
│   ├── Caddyfile
│   ├── .env.example
│   └── docker-compose.yml
│
└── docs/architecture/
    └── *.md
```
