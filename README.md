# Agent Kit Admin

**团队 AI 工具包管理平台** — 团队共享 MCP Servers 和 Agent Skills，支持私有发布、版本管理、一键安装。

适用于：团队内部沉淀可复用的 MCP 工具库，统一管理 Cursor/Claude Code 的 Agent Skills。

[![CI](https://github.com/afine907/agent-kit-admin/actions/workflows/ci.yml/badge.svg)](https://github.com/afine907/agent-kit-admin/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 核心功能

| 功能 | 说明 |
|------|------|
| **团队包管理** | 发布、下载、版本控制团队私有的 MCP/Skill |
| **MCP Server** | 发布标准化的 Model Context Protocol 服务器 |
| **Agent Skill** | 发布可被 Agent 调用的 Skill 配置 |
| **CLI 工具** | `akit` 命令行，无缝集成到 Cursor/Claude Code |
| **Web UI** | 可视化包浏览、团队管理、安装追踪 |
| **OAuth 登录** | 支持企微、飞书、钉钉 SSO |

---

## 快速开始

### 1. 安装 CLI

```bash
npm install -g akit
# 或
pnpm add -g akit
```

### 2. 启动服务（Docker）

```bash
git clone https://github.com/afine907/agent-kit-admin.git
cd agent-kit-admin
cp apps/server/.env.example apps/server/.env  # 编辑配置
docker compose up -d
```

服务启动后访问 `http://localhost:3000`

### 3. 本地开发模式

```bash
# 终端 1: 启动 API
cd apps/server
cp .env.example .env
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 终端 2: 启动 Web
cd apps/web
pnpm install
pnpm dev

# 终端 3: 启动 CLI（开发模式）
cd apps/cli
pnpm install
pnpm link --global
akit --version
```

### 4. 登录并发布团队包

```bash
# 注册账号
akit register --email you@team.com --password ***

# 登录
akit login --email you@team.com --password ***

# 创建团队
curl -X POST http://localhost:8000/api/v1/teams \
  -H "Authorization: Bearer $(cat ~/.config/akit-nodejs/config.json | jq -r .token)" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Team","slug":"myteam","description":"Internal tools"}'

# 初始化包
mkdir my-mcp && cd my-mcp
akit init --name @myteam/web-search --type mcp

# 发布到团队
akit publish --team @myteam
```

---

## CLI 命令

```bash
akit --version          # 查看版本
akit login              # 登录
akit register           # 注册

akit list               # 列出已安装的包
akit list --team @myteam  # 列出团队包

akit install @scope/name    # 安装包
akit install @myteam/web-search  # 安装团队包

akit publish --team @myteam  # 发布到团队
akit publish .               # 发布个人包

akit search mcp              # 搜索包
akit info @scope/name        # 查看包详情

akit update                  # 更新所有已安装的包
akit uninstall @scope/name   # 卸载包
```

---

## 团队包 vs 个人包

| | 团队包 | 个人包 |
|---|---|---|
| 可见范围 | 团队成员 | 所有人 |
| 发布方式 | `akit publish --team @slug` | `akit publish .` |
| 安装 | `akit install @team/name` | `akit install @user/name` |
| 管理 | Web UI 团队页面 | Web UI 个人页面 |

团队包的命名规范：`@{team-slug}/{package-name}`

---

## 技术架构

```
┌─────────────────────────────────────────────┐
│                  Web UI (Next.js)            │
│   http://localhost:3000                      │
│   团队页面 / 包浏览 / 安装追踪                │
└────────────────────┬────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────┐
│              API Server (FastAPI)           │
│   http://localhost:8000                      │
│   /api/v1/packages  包管理                   │
│   /api/v1/teams     团队管理                │
│   /api/v1/auth      认证                    │
└──────┬─────────────────┬───────────────────┘
       │                 │
┌──────▼──────┐   ┌─────▼──────┐
│  PostgreSQL  │   │    MinIO    │
│   包/用户    │   │   tarball   │
│   团队数据   │   │   存储      │
└─────────────┘   └────────────┘
```

---

## 开发指南

### 运行测试

```bash
# Server 测试
cd apps/server
pytest -q

# CLI 测试
cd apps/cli
pnpm test

# Web 测试
cd apps/web
pnpm test
```

### 代码规范

```bash
# Server
cd apps/server && ruff check . && mypy app

# CLI
cd apps/cli && pnpm lint && pnpm typecheck

# Web
cd apps/web && pnpm lint && pnpm typecheck
```

---

## 配置

### 环境变量 (apps/server/.env)

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/agentkit
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:3000
```

### API 地址

CLI 默认连接 `http://localhost:8000`，可通过以下方式覆盖：

```bash
akit config set registry https://your-registry.com
# 或环境变量
AKIT_SERVER=https://your-registry.com akit list
```

---

## License

MIT
