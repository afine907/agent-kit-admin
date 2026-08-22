# 贡献指南

感谢你对 Agent Kit Admin 感兴趣！我们欢迎各种形式的贡献。

---

## 如何贡献

### 报告 Bug

1. 先搜索 [Issues](https://github.com/afine907/agent-kit-admin/issues) 确认问题未被报告
2. 使用 Bug Report 模板创建 Issue
3. 提供清晰的重现步骤和环境信息

### 提出功能建议

1. 使用 Feature Request 模板创建 Issue
2. 说明功能的使用场景和预期行为

### 提交代码

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feat/your-feature`)
3. 提交变更 (`git commit -m "feat: add new feature"`)
4. 推送到分支 (`git push origin feat/your-feature`)
5. 创建 Pull Request

---

## 开发环境搭建

### 前置要求

- Node.js 20+
- Python 3.11+
- pnpm 9+
- Docker & Docker Compose（用于基础设施）

### 快速启动

```bash
# 1. 克隆仓库
git clone https://github.com/afine907/agent-kit-admin.git
cd agent-kit-admin

# 2. 启动基础设施（PostgreSQL + MinIO）
make dev

# 3. 安装依赖
pnpm install

# 4. 启动 Server
cd apps/server
python -m venv venv && source venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# 5. 启动 Web（新终端）
cd apps/web
pnpm dev

# 6. 启动 CLI 开发模式（新终端）
cd apps/cli
pnpm link --global
```

---

## 代码规范

### 提交信息格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type):**
- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具

**示例：**
```
feat(packages): add batch delete API

- Add POST /api/v1/packages/batch/delete
- Support soft delete with permission check
- Add tests for batch operations

Closes #123
```

### 代码风格

- **Python**: Ruff (lint + format)
- **TypeScript**: oxlint + tsc
- 所有提交前必须通过 lint 和 typecheck

### 分支命名

- `feat/*` — 新功能
- `fix/*` — 修复
- `docs/*` — 文档
- `refactor/*` — 重构

---

## 测试

### 运行测试

```bash
# Server
cd apps/server && pytest -v

# CLI
cd apps/cli && pnpm test

# Web
cd apps/web && pnpm test

# 全部
make test
```

### 测试要求

- 新功能必须包含测试
- Bug 修复应包含回归测试
- 所有测试必须在提交前通过

---

## 代码审查流程

1. 所有提交必须经过 PR 审查
2. CI 检查必须全部通过
3. 至少需要 1 个维护者批准
4. 审查意见需妥善处理

---

## 行为准则

请阅读我们的 [Code of Conduct](CODE_OF_CONDUCT.md)。

---

## 许可证

通过贡献你的代码，你同意你的贡献将在 MIT 许可证下发布。
