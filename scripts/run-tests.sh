#!/bin/bash
# 运行所有测试脚本

set -e

echo "=== Agent Kit Admin 测试套件 ==="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果
SERVER_TESTS_PASSED=false
CLI_TESTS_PASSED=false

# 运行 Server 测试
echo -e "${YELLOW}=== 运行 Server API 测试 ===${NC}"
cd apps/server

# 安装测试依赖（如果需要）
if ! command -v pytest &> /dev/null; then
    echo "安装 pytest..."
    pip install pytest pytest-asyncio httpx aiosqlite
fi

# 运行测试
if pytest tests/ -v --tb=short; then
    echo -e "${GREEN}✓ Server 测试通过${NC}"
    SERVER_TESTS_PASSED=true
else
    echo -e "${RED}✗ Server 测试失败${NC}"
fi

cd ../..

echo ""

# 运行 CLI 测试
echo -e "${YELLOW}=== 运行 CLI 测试 ===${NC}"
cd apps/cli

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    pnpm install
fi

# 运行测试
if pnpm test; then
    echo -e "${GREEN}✓ CLI 测试通过${NC}"
    CLI_TESTS_PASSED=true
else
    echo -e "${RED}✗ CLI 测试失败${NC}"
fi

cd ../..

echo ""

# Web UI E2E 测试提示
echo -e "${YELLOW}=== Web UI E2E 测试 ===${NC}"
echo "Web UI E2E 测试需要使用 CDP MCP 工具手动执行。"
echo ""
echo "步骤："
echo "1. 启动 Web 开发服务器: cd apps/web && pnpm dev"
echo "2. 在 Claude Code 中使用 CDP MCP 工具执行测试"
echo ""
echo "可用的 CDP MCP 工具："
echo "- mcp__chrome-devtools__navigate_page - 导航到 URL"
echo "- mcp__chrome-devtools__take_snapshot - 获取页面快照"
echo "- mcp__chrome-devtools__click - 点击元素"
echo "- mcp__chrome-devtools__fill - 填写表单"
echo "- mcp__chrome-devtools__take_screenshot - 截图"
echo "- mcp__chrome-devtools__wait_for - 等待文本出现"
echo ""

# 测试总结
echo -e "${YELLOW}=== 测试总结 ===${NC}"
if [ "$SERVER_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✓ Server API 测试: 通过${NC}"
else
    echo -e "${RED}✗ Server API 测试: 失败${NC}"
fi

if [ "$CLI_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✓ CLI 测试: 通过${NC}"
else
    echo -e "${RED}✗ CLI 测试: 失败${NC}"
fi

echo -e "${YELLOW}○ Web UI E2E 测试: 需要手动执行${NC}"
echo ""

# 如果有测试失败，退出码为 1
if [ "$SERVER_TESTS_PASSED" = false ] || [ "$CLI_TESTS_PASSED" = false ]; then
    exit 1
fi
