# Agent Kit Admin

AI-native 管理平台，用于管理团队的 MCP (Model Context Protocol) 和 Agent Skills。

## 核心功能

- 📦 **包管理** - 发布、下载、版本管理 MCP 和 Skills
- 🔐 **身份认证** - 对接企微、飞书、钉钉 OAuth
- ⭐ **评分系统** - 社区评分和下载统计
- 🛠️ **CLI 工具** - `akit` 命令行工具，无缝集成 Agent
- 🤖 **Claude Code Skill** - 自然语言操作包管理

## 快速开始

### CLI 方式

```bash
# 安装 CLI
npm install -g @agent-kit-admin/cli

# 登录
akit login --server https://your-registry.com

# 安装 MCP
akit install @team/web-search-mcp

# 发布
akit publish ./
```

### Claude Code Skill 方式

安装 Skill 后，可以直接用自然语言操作：

```bash
# 安装 Skill（全局）
mkdir -p ~/.claude/skills
cp skills/akit.md ~/.claude/skills/akit.md

# 或安装到当前项目
mkdir -p .claude/skills
cp skills/akit.md .claude/skills/akit.md
```

> `.claude/skills/` 是规范路径，`.claude/commands/` 也兼容。

然后在 Claude Code 中：
- "帮我安装 @team/web-search"
- "搜索数据库相关的 MCP"
- "我安装了哪些包？"
- "发布当前项目"

## Docker 部署

```bash
git clone https://github.com/your-org/agent-kit-admin.git
cd agent-kit-admin
cp deploy/.env.example deploy/.env
# 编辑 .env 配置

docker compose up -d
```

## 技术栈

| 组件 | 技术 |
|---|---|
| 后端 API | Python (FastAPI) |
| CLI | Node.js (TypeScript) |
| 前端 | React + Vite + shadcn/ui |
| 数据库 | PostgreSQL |
| 存储 | MinIO |
| 网关 | Caddy |

## 文档

详细文档见 [wiki](./wiki/) 目录。

## License

MIT
