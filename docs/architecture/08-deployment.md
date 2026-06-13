# 部署方案

## 概述

Agent Kit Admin 使用 Docker Compose 部署，支持一键启动所有服务。

## 系统要求

| 资源 | 最低要求 | 推荐 |
|---|---|---|
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4 GB |
| 磁盘 | 20 GB | 100 GB |
| OS | Linux / macOS | Ubuntu 22.04 |

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/agent-kit-admin.git
cd agent-kit-admin

# 2. 创建环境配置
cp deploy/docker/.env.example deploy/docker/.env
# 编辑 .env 文件

# 3. 启动服务
docker compose up -d

# 4. 初始化数据库
docker compose exec server alembic upgrade head

# 5. 访问
# Web UI: https://your-domain.com
# API: https://your-domain.com/api/v1
```

## Docker Compose 配置

```yaml
# docker-compose.yml
services:
  # 数据库
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: ${DB_NAME:-agentkit}
      POSTGRES_USER: ${DB_USER:-agentkit}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-agentkit}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 对象存储
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # MinIO 初始化
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://minio:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD};
      mc mb --ignore-existing myminio/${MINIO_BUCKET:-packages};
      mc anonymous set download myminio/${MINIO_BUCKET:-packages};
      exit 0;
      "

  # 后端 API
  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER:-agentkit}:${DB_PASSWORD}@db:5432/${DB_NAME:-agentkit}
      MINIO_ENDPOINT: minio:9000
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET: ${MINIO_BUCKET:-packages}
      MINIO_SECURE: "false"
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      WECHAT_WORK_CORP_ID: ${WECHAT_WORK_CORP_ID:-}
      WECHAT_WORK_AGENT_ID: ${WECHAT_WORK_AGENT_ID:-}
      WECHAT_WORK_SECRET: ${WECHAT_WORK_SECRET:-}
      FEISHU_APP_ID: ${FEISHU_APP_ID:-}
      FEISHU_APP_SECRET: ${FEISHU_APP_SECRET:-}
      DINGTALK_APP_KEY: ${DINGTALK_APP_KEY:-}
      DINGTALK_APP_SECRET: ${DINGTALK_APP_SECRET:-}
    volumes:
      - ./server:/app
    # 生产环境使用 gunicorn + uvicorn worker（不要使用 --reload）
    command: gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --access-logfile - --error-logfile -
    # 注意：gunicorn 需要在 server/pyproject.toml 的 dependencies 中添加

  # 前端
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      VITE_API_URL: /api/v1

  # 网关
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/docker/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    environment:
      DOMAIN: ${DOMAIN:-localhost}

volumes:
  postgres_data:
  minio_data:
  caddy_data:
  caddy_config:
```

## Caddy 配置

```caddyfile
# deploy/docker/Caddyfile

{$DOMAIN:localhost} {
    # API
    handle /api/* {
        reverse_proxy server:8000
    }

    # MinIO (下载)
    handle /packages/* {
        reverse_proxy minio:9000
    }

    # 前端
    handle {
        reverse_proxy web:3000
    }

    # 日志
    log {
        output file /data/access.log
    }

    # 自动 HTTPS
    tls {
        protocols tls1.2 tls1.3
    }
}
```

## 环境变量

```bash
# deploy/docker/.env.example

# 域名
DOMAIN=your-domain.com

# 数据库
DB_NAME=agentkit
DB_USER=agentkit
DB_PASSWORD=change_me_to_strong_password

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=change_me_to_strong_password
MINIO_BUCKET=packages
MINIO_CONSOLE_PORT=9001
# 注意：后端代码中也使用 MINIO_ROOT_USER / MINIO_ROOT_PASSWORD 作为 MinIO 连接凭据

# JWT
JWT_SECRET_KEY=change_me_to_random_string_at_least_32_chars

# 企业微信 (选填)
WECHAT_WORK_CORP_ID=
WECHAT_WORK_AGENT_ID=
WECHAT_WORK_SECRET=

# 飞书 (选填)
FEISHU_APP_ID=
FEISHU_APP_SECRET=

# 钉钉 (选填)
DINGTALK_APP_KEY=
DINGTALK_APP_SECRET=
```

## 初始化脚本

```bash
#!/bin/bash
# scripts/init.sh

set -e

echo "🚀 Initializing Agent Kit Admin..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

# 创建 .env
if [ ! -f deploy/docker/.env ]; then
    echo "📝 Creating .env file..."
    cp deploy/docker/.env.example deploy/docker/.env

    # 生成随机密码
    DB_PASSWORD=$(openssl rand -base64 32)
    MINIO_PASSWORD=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 48)

    # 替换默认密码（兼容 macOS 和 Linux）
    if [[ "$OSTYPE" == "darwin"* ]]; then
      SED_CMD="sed -i ''"
    else
      SED_CMD="sed -i"
    fi
    $SED_CMD "s/change_me_to_strong_password/$DB_PASSWORD/" deploy/docker/.env
    $SED_CMD "s/change_me_to_strong_password/$MINIO_PASSWORD/" deploy/docker/.env
    $SED_CMD "s/change_me_to_random_string_at_least_32_chars/$JWT_SECRET/" deploy/docker/.env

    echo "✅ .env file created with random passwords"
    echo "⚠️  Please edit deploy/docker/.env to configure OAuth providers"
fi

# 启动服务
echo "🐳 Starting services..."
docker compose up -d

# 等待数据库就绪
echo "⏳ Waiting for database..."
sleep 10

# 运行迁移
echo "📦 Running database migrations..."
docker compose exec server alembic upgrade head

echo ""
echo "✅ Installation complete!"
echo ""
echo "🌐 Web UI: https://$(grep DOMAIN deploy/docker/.env | cut -d= -f2)"
echo "📡 API: https://$(grep DOMAIN deploy/docker/.env | cut -d= -f2)/api/v1"
echo ""
echo "📝 Next steps:"
echo "   1. Edit deploy/docker/.env to configure OAuth providers"
echo "   2. Visit the Web UI to create your first account"
echo "   3. Install CLI: npm install -g @agent-kit-admin/cli"
echo "   4. Login: akit login --server https://your-domain.com"
```

## 反向代理（外部 Caddy/Nginx）

如果使用外部反向代理（如已有 Caddy/Nginx），可以只暴露内部端口：

```yaml
# docker-compose.yml (修改)
services:
  # ...
  server:
    ports:
      - "127.0.0.1:8000:8000"
  web:
    ports:
      - "127.0.0.1:3000:3000"
  minio:
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
```

外部 Caddy 配置：

```caddyfile
your-domain.com {
    reverse_proxy /api/* localhost:8000
    reverse_proxy localhost:3000
}
```

## 备份

### 数据库备份

```bash
# 手动备份
docker compose exec db pg_dump -U agentkit agentkit > backup_$(date +%Y%m%d).sql

# 自动备份 (crontab)
0 2 * * * cd /path/to/agent-kit-admin && docker compose exec -T db pg_dump -U agentkit agentkit > /backups/agentkit_$(date +\%Y\%m\%d).sql
```

### MinIO 备份

```bash
# 使用 mc 客户端
mc mirror myminio/packages /backups/minio/packages
```

## 升级

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建
docker compose build

# 3. 运行迁移
docker compose exec server alembic upgrade head

# 4. 重启服务
docker compose up -d
```

## CI/CD 流水线

### 分支策略

```
main (生产) ←── release/v* ←── develop (开发) ←── feature/* 
                                 ↑
                              hotfix/* ──→ main
```

| 分支 | 用途 | 部署目标 |
|---|---|---|
| `main` | 生产代码，始终可部署 | 生产环境 |
| `develop` | 开发集成分支 | 测试环境 |
| `feature/*` | 功能开发 | 无（PR 到 develop） |
| `release/v*` | 发布准备 | 预发布环境 |
| `hotfix/*` | 生产紧急修复 | 无（PR 到 main） |

### GitHub Actions 流水线

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # 后端测试
  test-server:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: agentkit_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -e ".[dev]"
      - run: alembic upgrade head
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/agentkit_test
      - run: pytest --cov=app --cov-report=xml
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/agentkit_test

  # CLI 测试
  test-cli:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
      - run: cd cli && npm ci && npm test

  # 前端构建检查
  build-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
      - run: cd web && npm ci && npm run build
      - run: cd web && npm run lint

  # Docker 镜像构建（仅 main/develop）
  build-images:
    needs: [test-server, test-cli, build-web]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: ./server
          push: false
          tags: agent-kit-admin/server:${{ github.sha }}
      - uses: docker/build-push-action@v5
        with:
          context: ./web
          push: false
          tags: agent-kit-admin/web:${{ github.sha }}
```

### 发布流程

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4
      
      # 构建并推送 Docker 镜像
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          docker build -t ghcr.io/${{ github.repository }}/server:${{ github.ref_name }} ./server
          docker push ghcr.io/${{ github.repository }}/server:${{ github.ref_name }}
          docker build -t ghcr.io/${{ github.repository }}/web:${{ github.ref_name }} ./web
          docker push ghcr.io/${{ github.repository }}/web:${{ github.ref_name }}

      # 发布 CLI 到 npm
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          registry-url: "https://registry.npmjs.org"
      - run: cd cli && npm ci && npm run build && npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # 创建 GitHub Release
      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

### 部署到生产

```bash
# 方式 1：手动部署
git checkout main
git pull
docker compose -f deploy/docker/docker-compose.yml pull
docker compose -f deploy/docker/docker-compose.yml up -d

# 方式 2：Watchtower 自动更新（可选）
# 在 deploy/docker/docker-compose.yml 中添加：
# watchtower:
#   image: containrrr/watchtower
#   volumes:
#     - /var/run/docker.sock:/var/run/docker.sock
#   command: --interval 300 agent-kit-admin-server agent-kit-admin-web
```

## 监控

### 健康检查

```bash
# API 健康检查
curl https://your-domain.com/api/v1/health

# 响应
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "storage": "connected"
}
```

### Docker 健康检查

```yaml
services:
  server:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 日志

```bash
# 查看所有日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f server
docker compose logs -f web

# 查看最近 100 行
docker compose logs --tail 100 server
```

## 故障排查

### 数据库连接失败

```bash
# 检查数据库状态
docker compose ps db

# 查看数据库日志
docker compose logs db

# 手动连接测试
docker compose exec db psql -U agentkit -d agentkit
```

### MinIO 连接失败

```bash
# 检查 MinIO 状态
docker compose ps minio

# 测试连接
docker compose exec minio mc alias set local http://localhost:9000 minioadmin your_password
```

### 端口冲突

```bash
# 检查端口占用
lsof -i :80
lsof -i :443
lsof -i :5432

# 修改端口映射
# 编辑 docker-compose.yml 中的 ports 配置
```
