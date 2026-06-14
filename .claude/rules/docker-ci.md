---
description: "Docker 构建和 CI/CD 调试规则"
globs: ["**/Dockerfile*", "**/.github/workflows/*.yml", "docker-compose*.yml"]
alwaysApply: false
---

## Docker 构建调试清单

**在修改任何 Dockerfile 之前，先花 2 分钟完成以下检查：**

### 1. 分析项目结构
- [ ] 读 `package.json` 或 `pyproject.toml` — 确认包管理器（npm/pnpm/yarn/pip）
- [ ] 检查是否有 `pnpm-workspace.yaml` / `lerna.json` — 确认是否 monorepo
- [ ] 检查 lock 文件位置（根目录 vs 子目录）
- [ ] 检查构建脚本用了什么命令（`tsc`? `vite`? `pytest`?）

### 2. Monorepo Dockerfile 要点
- **构建上下文**：通常是根目录（不是子目录）
- **COPY 路径**：所有路径相对于构建上下文
- **依赖安装**：需要复制 workspace 配置文件
- **示例**：
  ```dockerfile
  # ✅ 正确：根目录作为上下文
  FROM node:20-alpine
  WORKDIR /app
  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
  COPY apps/web/package.json ./apps/web/
  RUN pnpm install --frozen-lockfile
  COPY apps/web ./apps/web
  WORKDIR /app/apps/web
  RUN pnpm build
  ```

### 3. Python 项目 Dockerfile 要点
- `pip install .` 需要正确的 `pyproject.toml` 配置
- 如果 hatchling 无法自动发现包，添加：
  ```toml
  [tool.hatch.build.targets.wheel]
  packages = ["app"]
  ```
- 或者直接列出依赖：`pip install fastapi uvicorn ...`

### 4. GitHub Actions 限制
- **services 容器**：健康检查命令必须在容器内可用
- **MinIO 健康检查**：不能用 `curl`（容器内没有），用 `mc ready local` 或直接不设
- **端口映射**：services 容器端口映射到 localhost

### 5. 常见遗漏依赖
- `email-validator` — Pydantic 的 `EmailStr` 需要
- `aiosqlite` — SQLite 异步驱动（测试用）
- `jose` vs `jwt` — `python-jose` 用 `from jose import jwt`，不是 `import jwt`

## 调试流程

```
失败 → 读完整错误日志 → 列出所有问题点 → 一次性修复 → 重新构建
      ↓
      不要：修一个 → 失败 → 再修一个 → 失败 → ...
```

## 来源
- 2026-06-14：Docker 部署测试和 CI 门禁调试，失败 15+ 次
