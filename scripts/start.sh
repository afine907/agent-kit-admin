#!/bin/bash
# Agent Kit Admin - 一键启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Agent Kit Admin 启动脚本 ===${NC}"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    echo "请安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    echo "请安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# 生成 .env 文件（如果不存在）
if [ ! -f .env ]; then
    echo -e "${YELLOW}生成 .env 文件...${NC}"

    # 生成随机密码
    DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    MINIO_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)

    cat > .env << EOF
# 自动生成的配置 - 请妥善保管密码

# 数据库
DB_USER=agentkit
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=agentkit

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}

# OAuth (请自行配置)
WECCHAT_WORK_CORP_ID=
WECCHAT_WORK_SECRET=
WECCHAT_WORK_AGENT_ID=
FEISHU_APP_ID=
FEISHU_APP_SECRET=
DINGTALK_APP_KEY=
DINGTALK_APP_SECRET=
EOF

    echo -e "${GREEN}✔ .env 文件已生成${NC}"
    echo -e "${YELLOW}  请检查并修改 OAuth 配置${NC}"
    echo ""
fi

# 启动服务
echo -e "${GREEN}启动服务...${NC}"
docker compose up -d

# 等待服务就绪
echo ""
echo -e "${YELLOW}等待服务就绪...${NC}"

# 等待 PostgreSQL
echo -n "  PostgreSQL: "
for i in {1..30}; do
    if docker compose exec -T db pg_isready -U agentkit &> /dev/null; then
        echo -e "${GREEN}就绪${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}超时${NC}"
        exit 1
    fi
    sleep 1
done

# 等待 MinIO
echo -n "  MinIO: "
for i in {1..30}; do
    if docker compose exec -T minio mc ready local &> /dev/null; then
        echo -e "${GREEN}就绪${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}超时${NC}"
        exit 1
    fi
    sleep 1
done

# 等待 Server
echo -n "  Server: "
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health &> /dev/null; then
        echo -e "${GREEN}就绪${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}超时${NC}"
        exit 1
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}=== 启动完成 ===${NC}"
echo ""
echo "访问地址:"
echo "  Web UI:    http://localhost"
echo "  API:       http://localhost/api/v1"
echo "  API Docs:  http://localhost/api/v1/docs"
echo "  MinIO:     http://localhost:9001"
echo ""
echo "常用命令:"
echo "  查看日志:   docker compose logs -f"
echo "  停止服务:   docker compose down"
echo "  重启服务:   docker compose restart"
echo ""
