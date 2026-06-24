# 测试架构

## 概述

三层测试 + 全链路 E2E，覆盖用户旅程的每一个阶段。

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    全链路 E2E (Playwright)                │
│         模拟真实用户：浏览器 + CLI → Server → Storage       │
│              覆盖：旅程 1→2→3→4→5→6→8→9                 │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────┐
│                  App 级集成测试                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Server     │  │  CLI        │  │  Web        │     │
│  │  (pytest)   │  │  (vitest)   │  │  (vitest)   │     │
│  │             │  │  + MSW      │  │  + MSW      │     │
│  │  覆盖：4-9  │  │  覆盖：4-9  │  │  覆盖：1-4  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   单元测试 (已有)                          │
│  Server: pytest   CLI: vitest   Web: vitest             │
│  覆盖：工具函数、组件渲染、API 边界                         │
└─────────────────────────────────────────────────────────┘
```

## 用户旅程 → 测试映射

| 旅程阶段 | CLI | Server | Web | Playwright |
|---|---|---|---|---|
| 1. 发现产品 | - | - | ✅ 首页/搜索 | ✅ |
| 2. 安装 CLI | ✅ --version | - | - | ✅ npm install |
| 3. 登录 | ✅ login | ✅ OAuth/Token | ✅ Web 登录 | ✅ OAuth |
| 4. 探索 | ✅ search/info | ✅ 包 CRUD | ✅ 包列表/详情 | ✅ |
| 5. 首次安装 | ✅ install | - | - | ✅ |
| 6. 验证 MCP | - | - | - | - (需真实 Agent) |
| 7. 进阶使用 | ✅ list/update/uninstall | ✅ | ✅ | ✅ |
| 8. 发布 | ✅ init/publish | ✅ 版本发布/下载 | ✅ 发布向导 | ✅ |
| 9. 日常使用 | ✅ | ✅ | ✅ | ✅ |

## 各层测试说明

### 1. 单元测试（已有）

**Server** (`apps/server/tests/`)
**CLI** (`apps/cli/tests/`)
**Web** (`apps/web/src/**/*.test.tsx`)

### 2. App 级集成测试

#### Server Journey E2E (`test_e2e_journey.py`)

使用 pytest + AsyncClient，测试 Server API 完整旅程：

```
用户旅程 → API 调用 → 数据库验证
```

覆盖：阶段 3（登录）、4（包 CRUD）、7（更新/删除）、8（发布/下载）

#### CLI 集成测试 (`tests/integration/`)

使用 vitest + MSW（Mock Service Worker）模拟 Server HTTP API：

```
CLI 命令 → MSW Mock HTTP → 验证 output/config
```

覆盖：阶段 3（login）、4（search/info）、5（install）、7（list/update/uninstall）、8（init/publish）

#### Web 集成测试 (`tests/integration/`)

使用 vitest + MSW 模拟后端 API：

```
Web 页面 → MSW Mock → 验证 UI 状态
```

覆盖：阶段 1（首页）、3（登录页）、4（包列表/详情）

### 3. 全链路 Playwright E2E（启动真实服务）

使用 Playwright 调用真实 Chrome/Chromium，模拟用户真实操作：

```
真实浏览器 → Web UI → HTTP → Server → MinIO (Mock)
真实终端   → CLI     → HTTP → Server → MinIO (Mock)
```

覆盖：阶段 1、2、3、4、8

**注意**：阶段 5（install 后在 Claude Code 中验证 MCP）需要真实 Agent 环境，E2E 不覆盖。

## 文件结构

```
apps/server/tests/
  ├── conftest.py              # pytest fixtures (已有)
  ├── helpers.py               # 测试辅助函数 (已有)
  ├── test_e2e_journey.py      # ⭐ 新增：Server 旅程测试
  ├── test_packages.py         # 包 API 单元
  └── ...                      # 其他单元测试

apps/cli/tests/
  ├── agents/                   # Agent 适配器单元 (已有)
  ├── commands/                # 命令单元测试 (已有)
  ├── integration/              # ⭐ 新增：CLI 集成测试
  │   ├── login.test.ts
  │   ├── search.test.ts
  │   ├── install.test.ts
  │   ├── list-update-uninstall.test.ts
  │   └── publish.test.ts
  └── vitest.config.ts         # 已添加 coverage

apps/web/tests/
  ├── integration/              # ⭐ 新增：Web 集成测试
  │   ├── home.test.tsx
  │   ├── package-list.test.tsx
  │   ├── package-detail.test.tsx
  │   └── login.test.tsx
  └── vitest.config.ts         # 已添加 coverage

e2e/
  ├── playwright.config.ts     # ⭐ Playwright 配置
  ├── package.json             # ⭐ Playwright 依赖
  └── tests/
      ├── journey.test.ts      # ⭐ 完整旅程 E2E
      └── package-flow.test.ts # ⭐ 发布→安装 E2E
```

## 覆盖率目标

| 层级 | 目标 | 当前 |
|---|---|---|
| Server 旅程测试 | 覆盖 API 80%+ | 63 行，1 个测试 |
| CLI 集成测试 | 覆盖命令 80%+ | 0（无集成测试） |
| Web 集成测试 | 覆盖页面 80%+ | 0（无集成测试） |
| 全链路 E2E | 覆盖旅程 90%+ | 文档存在，无代码 |

## 运行方式

```bash
# 全部测试
make test

# 仅 Server 旅程测试
pytest apps/server/tests/test_e2e_journey.py -v

# 仅 CLI 集成测试
cd apps/cli && pnpm test

# 仅 Web 集成测试
cd apps/web && pnpm test

# 全链路 E2E（需启动服务）
cd e2e && pnpm playwright test
```
