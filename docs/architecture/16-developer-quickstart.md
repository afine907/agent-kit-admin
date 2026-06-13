# 开发者快速开始

## 概述

本文档面向想要参与开发或自行部署 Agent Kit Admin 的开发者。

---

## 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Python | >= 3.11 | 后端运行 |
| Node.js | >= 18 | CLI + 前端 |
| Docker | >= 20.10 | 部署 |
| Docker Compose | >= 2.0 | 部署 |
| Git | >= 2.0 | 版本控制 |

---

## 快速启动 (Docker)

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/agent-kit-admin.git
cd agent-kit-admin

# 2. 一键启动
./scripts/start.sh

# 3. 访问
# Web UI: http://localhost
# API: http://localhost/api/v1
# MinIO Console: http://localhost:9001
```

---

## 本地开发

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/agent-kit-admin.git
cd agent-kit-admin
```

### 2. 启动依赖服务

```bash
# 启动 PostgreSQL 和 MinIO
docker compose up -d db minio minio-init
```

### 3. 后端开发

```bash
cd server

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -e ".[dev]"

# 配置环境变量
cp .env.example .env
# 编辑 .env，配置数据库和 MinIO 连接
# 注意：MinIO 凭据使用 MINIO_ROOT_USER / MINIO_ROOT_PASSWORD

# 运行数据库迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload --port 8000

# 访问 API 文档
# http://localhost:8000/docs
```

### 4. CLI 开发

```bash
cd cli

# 安装依赖
npm install

# 开发模式运行
npm run dev -- --help

# 构建
npm run build

# 本地链接（全局可用）
npm link

# 测试
npm test
```

### 5. 前端开发

```bash
cd web

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问
# http://localhost:5173
```

---

## 项目结构

```
agent-kit-admin/
├── server/                  # Python 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI 入口
│   │   ├── config.py        # 配置
│   │   ├── database.py      # 数据库连接
│   │   ├── models/          # SQLAlchemy 模型
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── package.py
│   │   │   └── version.py
│   │   ├── schemas/         # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── package.py
│   │   │   └── version.py
│   │   ├── api/             # API 路由
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── packages.py
│   │   │   └── versions.py
│   │   ├── services/        # 业务逻辑
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── package.py
│   │   │   └── storage.py
│   │   └── utils/           # 工具函数
│   ├── alembic/             # 数据库迁移
│   ├── tests/               # 测试
│   ├── pyproject.toml       # Python 配置
│   ├── alembic.ini          # Alembic 配置
│   ├── Dockerfile
│   └── .env.example
│
├── cli/                     # Node.js CLI
│   ├── src/
│   │   ├── index.ts         # 入口
│   │   ├── bin/
│   │   │   └── akit.ts      # CLI 入口
│   │   ├── commands/        # 命令实现
│   │   │   ├── login.ts
│   │   │   ├── publish.ts
│   │   │   ├── install.ts
│   │   │   ├── uninstall.ts
│   │   │   ├── list.ts
│   │   │   ├── search.ts
│   │   │   └── info.ts
│   │   ├── agents/          # Agent 适配器
│   │   │   ├── types.ts
│   │   │   ├── registry.ts
│   │   │   ├── claude.ts    # JSON 格式 (~/.claude/mcp.json)
│   │   │   └── codex.ts    # TOML 格式 (~/.codex/config.toml)
│   │   ├── api/             # API 客户端
│   │   │   └── client.ts
│   │   ├── config/          # 配置管理
│   │   │   └── manager.ts
│   │   └── utils/           # 工具函数
│   │       ├── logger.ts
│   │       ├── progress.ts
│   │       └── error.ts
│   ├── tests/               # 测试
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── web/                     # React 前端
│   ├── src/
│   │   ├── main.tsx         # 入口
│   │   ├── App.tsx          # 根组件
│   │   ├── components/      # 组件
│   │   │   ├── ui/          # shadcn/ui 组件
│   │   │   ├── layout/      # 布局组件
│   │   │   └── common/      # 通用组件
│   │   ├── pages/           # 页面
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── PackageList.tsx
│   │   │   ├── PackageDetail.tsx
│   │   │   └── Profile.tsx
│   │   ├── hooks/           # 自定义 hooks
│   │   │   ├── useAuth.ts
│   │   │   └── usePackages.ts
│   │   ├── stores/          # Zustand 状态
│   │   │   └── authStore.ts
│   │   ├── lib/             # 工具函数
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   └── types/           # TypeScript 类型
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
│
├── deploy/docker/                  # 部署配置
│   ├── Caddyfile
│   ├── docker-compose.yml
│   └── .env.example
│
├── scripts/                 # 脚本
│   ├── start.sh             # 启动脚本
│   ├── init-db.sh           # 数据库初始化
│   └── backup.sh            # 备份脚本
│
├── docs/architecture/                    # 文档
│   └── *.md
│
├── docker-compose.yml       # 开发环境
├── Makefile                 # 常用命令
└── README.md
```

---

## 后端分层架构

### 分层职责

```
┌─────────────────────────────────────────────────────────┐
│  API Layer (routes/)        薄层：参数解析、响应序列化    │
│  ↓ Depends(service)                                       │
├─────────────────────────────────────────────────────────┤
│  Service Layer (services/)  业务逻辑、事务管理、权限校验    │
│  ↓                                                        │
├─────────────────────────────────────────────────────────┤
│  Model Layer (models/)      ORM 映射、数据库交互           │
│  ↓                                                        │
├─────────────────────────────────────────────────────────┤
│  Infrastructure             MinIO、外部 OAuth 等           │
└─────────────────────────────────────────────────────────┘
```

### 中间件执行链

请求进入后的处理顺序：

```
Request → CORS → RequestID → Logging → RateLimit → Auth → Route Handler → Response
```

```python
# server/app/main.py
from fastapi import FastAPI
from app.middleware import RequestIDMiddleware, LoggingMiddleware, RateLimitMiddleware
from app.api import auth, packages, versions

app = FastAPI(title="Agent Kit Admin", version="0.1.0")

# 中间件（按顺序注册，后注册的先执行）
app.add_middleware(RateLimitMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIDMiddleware)

# 路由注册
app.include_router(auth.router, prefix="/api/v1")
app.include_router(packages.router, prefix="/api/v1")
app.include_router(versions.router, prefix="/api/v1")
```

### 依赖注入模式

使用 FastAPI 的 `Depends` 实现依赖注入：

```python
# server/app/api/deps.py
from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth import AuthService
from app.models.user import User

async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> User:
    """从 Bearer Token 解析当前用户"""
    token = authorization.replace("Bearer ", "")
    auth_service = AuthService(db)
    user = await auth_service.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

async def get_package_service(db: AsyncSession = Depends(get_db)) -> "PackageService":
    """获取包管理服务实例"""
    from app.services.package import PackageService
    return PackageService(db)
```

### Service 层规范

每个 Service 接收 `AsyncSession`，负责业务逻辑和事务管理：

```python
# server/app/services/package.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.package import Package
from app.schemas.package import PackageCreate
from app.errors import AppError

class PackageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: PackageCreate, owner_id: str) -> Package:
        """创建包，含业务校验"""
        # 1. 检查包名是否已存在
        existing = await self.get_by_full_name(data.scope, data.name)
        if existing:
            raise AppError(code=20004, message=f"Package {data.scope}/{data.name} already exists")

        # 2. 创建包记录
        package = Package(
            name=data.name,
            scope=data.scope,
            type=data.type,
            description=data.description,
            owner_id=owner_id,
            owner_type="user",
        )
        self.db.add(package)
        await self.db.commit()
        await self.db.refresh(package)
        return package

    async def get_by_full_name(self, scope: str, name: str) -> Package | None:
        result = await self.db.execute(
            select(Package).where(
                Package.scope == scope,
                Package.name == name,
                Package.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()
```

### 统一错误处理

```python
# server/app/errors.py
from fastapi import HTTPException

class AppError(HTTPException):
    """应用层统一错误"""
    def __init__(self, code: int, message: str, status_code: int = 400, details: dict = None):
        self.error_code = code
        self.error_message = message
        self.error_details = details or {}
        super().__init__(status_code=status_code, detail=message)

# 使用示例
raise AppError(code=20003, message="Package not found", status_code=404)
raise AppError(code=20004, message="Version already exists", status_code=409)
```

```python
# server/app/main.py - 全局异常处理器
from fastapi.responses import JSONResponse
from app.errors import AppError

@app.exception_handler(AppError)
async def app_error_handler(request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.error_message,
                "details": exc.error_details,
            }
        }
    )
```

### 路由层规范

路由层保持薄层，仅做参数解析和响应序列化：

```python
# server/app/api/packages.py
from fastapi import APIRouter, Depends, Query
from app.api.deps import get_current_user, get_package_service
from app.schemas.package import PackageCreate, PackageResponse, PackageListResponse
from app.models.user import User

router = APIRouter(prefix="/packages", tags=["packages"])

@router.post("/", response_model=PackageResponse)
async def create_package(
    data: PackageCreate,
    user: User = Depends(get_current_user),
    service = Depends(get_package_service),
):
    """创建包"""
    package = await service.create(data, owner_id=str(user.id))
    return package

@router.get("/", response_model=PackageListResponse)
async def list_packages(
    search: str | None = Query(None),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    service = Depends(get_package_service),
):
    """列出包（支持搜索和筛选）"""
    return await service.list(search=search, type=type, page=page, per_page=per_page)
```

---

## 常用命令

### Makefile

```makefile
# 开发环境
make dev              # 启动所有服务
make dev-server       # 仅启动后端
make dev-cli          # 仅启动 CLI
make dev-web          # 仅启动前端

# 数据库
make db-migrate       # 运行迁移
make db-revision      # 创建新迁移
make db-reset         # 重置数据库

# 测试
make test             # 运行所有测试
make test-server      # 后端测试
make test-cli         # CLI 测试
make test-web         # 前端测试

# 构建
make build            # 构建所有
make build-server     # 构建后端镜像
make build-cli        # 构建 CLI
make build-web        # 构建前端

# 部署
make deploy           # 部署到生产
make backup           # 备份数据
```

---

## API 开发

### 添加新端点

1. **定义 Schema** (`server/app/schemas/`)

```python
# server/app/schemas/package.py
from pydantic import BaseModel
from datetime import datetime

class PackageCreate(BaseModel):
    name: str
    scope: str | None = None
    type: str  # mcp / skill
    description: str | None = None
    license: str = "MIT"

class PackageResponse(BaseModel):
    id: str
    name: str
    scope: str
    full_name: str
    type: str
    description: str | None
    created_at: datetime

    class Config:
        from_attributes = True
```

2. **定义 Model** (`server/app/models/`)

```python
# server/app/models/package.py
from sqlalchemy import Column, String, DateTime, func
from app.database import Base

class Package(Base):
    __tablename__ = "packages"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    scope = Column(String, nullable=False)
    type = Column(String, nullable=False)
    description = Column(String)
    created_at = Column(DateTime, server_default=func.now())
```

3. **实现 Service** (`server/app/services/`)

```python
# server/app/services/package.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.package import Package
from app.schemas.package import PackageCreate

class PackageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: PackageCreate) -> Package:
        package = Package(**data.model_dump())
        self.db.add(package)
        await self.db.commit()
        return package

    async def get_by_name(self, scope: str, name: str) -> Package | None:
        result = await self.db.execute(
            select(Package).where(
                Package.scope == scope,
                Package.name == name
            )
        )
        return result.scalar_one_or_none()
```

4. **定义路由** (`server/app/api/`)

```python
# server/app/api/packages.py
from fastapi import APIRouter, Depends
from app.schemas.package import PackageCreate, PackageResponse
from app.services.package import PackageService
from app.database import get_db

router = APIRouter(prefix="/packages", tags=["packages"])

@router.post("/", response_model=PackageResponse)
async def create_package(
    data: PackageCreate,
    db = Depends(get_db)
):
    service = PackageService(db)
    return await service.create(data)

@router.get("/{scope}/{name}", response_model=PackageResponse)
async def get_package(
    scope: str,
    name: str,
    db = Depends(get_db)
):
    service = PackageService(db)
    package = await service.get_by_name(scope, name)
    if not package:
        raise HTTPException(404, "Package not found")
    return package
```

5. **注册路由** (`server/app/main.py`)

```python
from app.api import packages, auth, versions

app.include_router(packages.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(versions.router, prefix="/api/v1")
```

---

## CLI 开发

### 添加新命令

1. **创建命令文件** (`cli/src/commands/`)

```typescript
// cli/src/commands/info.ts
import { Command } from 'commander'
import chalk from 'chalk'
import { apiClient } from '../api/client'

export const infoCommand = new Command('info')
  .description('View package details')
  .argument('<package>', 'Package name (e.g., @team/web-search)')
  .action(async (packageName: string) => {
    try {
      const { scope, name } = parsePackageName(packageName)
      const pkg = await apiClient.getPackage(scope, name)

      console.log(`
${chalk.bold(pkg.full_name)}

  ${pkg.description}

  Version: ${pkg.latest_version}
  Type: ${pkg.type}
  License: ${pkg.license}
  Downloads: ${pkg.downloads_count}
  Rating: ⭐ ${pkg.rating_avg} (${pkg.rating_count} reviews)

  Install:
    akit install ${pkg.full_name}
      `)
    } catch (error) {
      console.error(chalk.red(`✖ Error: ${error.message}`))
      process.exit(1)
    }
  })
```

2. **注册命令** (`cli/src/bin/akit.ts`)

```typescript
import { Command } from 'commander'
import { infoCommand } from '../commands/info'
import { installCommand } from '../commands/install'
// ...

const program = new Command()
  .name('akit')
  .description('Agent Kit Admin CLI')
  .version('0.1.0')

program.addCommand(infoCommand)
program.addCommand(installCommand)
// ...

program.parse()
```

---

## 测试

### 后端测试

```bash
cd server

# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_packages.py

# 运行带覆盖率
pytest --cov=app --cov-report=html
```

测试示例：

```python
# server/tests/test_packages.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c

async def test_create_package(client):
    response = await client.post("/api/v1/packages/", json={
        "name": "test-mcp",
        "scope": "@test",
        "type": "mcp",
        "description": "Test MCP"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-mcp"
    assert data["full_name"] == "@test/test-mcp"
```

### CLI 测试

```bash
cd cli

# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "info command"
```

测试示例：

```typescript
// cli/tests/commands/info.test.ts
import { describe, it, expect, vi } from 'vitest'
import { infoCommand } from '../../src/commands/info'

describe('info command', () => {
  it('should display package info', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    // Mock API response
    vi.mock('../../src/api/client', () => ({
      apiClient: {
        getPackage: vi.fn().mockResolvedValue({
          full_name: '@team/test-mcp',
          description: 'Test MCP',
          latest_version: '1.0.0',
          type: 'mcp',
          license: 'MIT',
          downloads_count: 100,
          rating_avg: 4.5,
          rating_count: 10
        })
      }
    }))

    await infoCommand.parseAsync(['@team/test-mcp'], { from: 'user' })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('@team/test-mcp')
    )
  })
})
```

---

## 调试

### 后端调试

```bash
# 启动调试模式
uvicorn app.main:app --reload --log-level debug

# 使用 VS Code 调试器
# .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload"],
      "jinja": true
    }
  ]
}
```

### CLI 调试

```bash
# 使用 Node.js 调试器
node --inspect dist/bin/akit.js info @team/test-mcp

# 使用 VS Code 调试器
# .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Node: CLI",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/cli/src/bin/akit.ts",
      "args": ["info", "@team/test-mcp"],
      "runtimeArgs": ["-r", "tsx/cjs"]
    }
  ]
}
```

---

## 贡献指南

### 1. Fork 仓库

```bash
# Fork 到自己的账号
# 克隆 fork 的仓库
git clone https://github.com/your-username/agent-kit-admin.git
cd agent-kit-admin

# 添加上游仓库
git remote add upstream https://github.com/your-org/agent-kit-admin.git
```

### 2. 创建分支

```bash
# 同步上游
git fetch upstream
git checkout -b feature/my-feature upstream/main
```

### 3. 开发和测试

```bash
# 开发
# ...

# 运行测试
make test

# 代码检查
make lint
```

### 4. 提交 PR

```bash
# 提交
git add .
git commit -m "feat: add my feature"
git push origin feature/my-feature

# 在 GitHub 上创建 PR
```

### Commit 规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试
chore: 构建/工具
```

---

## 常见问题

### Q: 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker compose ps db

# 检查连接
docker compose exec db psql -U agentkit -d agentkit
```

### Q: MinIO 连接失败

```bash
# 检查 MinIO 是否运行
docker compose ps minio

# 检查配置
cat server/.env | grep MINIO
```

### Q: CLI 命令不生效

```bash
# 检查是否全局安装
which akit

# 重新链接
cd cli
npm link
```

### Q: 前端 API 请求失败

```bash
# 检查 API 是否运行
curl http://localhost:8000/api/v1/health

# 检查代理配置
cat web/vite.config.ts
```
