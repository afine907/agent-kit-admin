#!/bin/bash
# Agent Kit Admin - 数据库初始化脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 数据库初始化 ===${NC}"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

# 加载环境变量
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}错误: .env 文件不存在${NC}"
    echo "请先运行 scripts/start.sh"
    exit 1
fi

# 等待 PostgreSQL 就绪
echo -e "${YELLOW}等待 PostgreSQL 就绪...${NC}"
for i in {1..30}; do
    if docker compose exec -T db pg_isready -U ${DB_USER:-agentkit} &> /dev/null; then
        echo -e "${GREEN}✔ PostgreSQL 已就绪${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✖ PostgreSQL 连接超时${NC}"
        exit 1
    fi
    sleep 1
done

# 执行初始化 SQL
echo -e "${YELLOW}执行数据库初始化...${NC}"
docker compose exec -T db psql -U ${DB_USER:-agentkit} -d ${DB_NAME:-agentkit} < scripts/init-db.sql
echo -e "${GREEN}✔ 数据库初始化完成${NC}"

# 运行 Alembic 迁移（如果 server 已构建）
echo ""
echo -e "${YELLOW}运行数据库迁移...${NC}"
if docker compose exec -T server alembic upgrade head 2>/dev/null; then
    echo -e "${GREEN}✔ 数据库迁移完成${NC}"
else
    echo -e "${YELLOW}⚠ Server 未启动，跳过 Alembic 迁移${NC}"
    echo "  请在 server 启动后运行: docker compose exec server alembic upgrade head"
fi

echo ""
echo -e "${GREEN}=== 初始化完成 ===${NC}"
