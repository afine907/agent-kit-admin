# MVP 规格说明

## MVP 目标

**一句话:** 让团队能在 3 分钟内完成从零到安装第一个 MCP 的全流程。

---

## MVP 范围

### 包含功能

| 模块 | 功能 | 说明 |
|---|---|---|
| **CLI** | `akit login` | OAuth 登录 + Token 登录 |
| | `akit publish` | 发布 MCP 和 Skill |
| | `akit install` | 安装到 Claude Code + Codex |
| | `akit uninstall` | 卸载包 |
| | `akit list` | 查看已安装列表 |
| | `akit search` | 搜索包 |
| | `akit info` | 查看包详情 |
| **API** | 包管理 CRUD | 创建、查询、删除 |
| | 版本管理 | 发布版本、查询版本 |
| | 文件上传/下载 | MinIO 存储 |
| | 用户认证 | OAuth + JWT |
| **Web UI** | 包列表页 | 搜索、筛选、排序 |
| | 包详情页 | 描述、版本、安装命令 |
| | 登录页 | OAuth 登录 |
| | 个人中心 | 我的包列表 |
| **部署** | Docker Compose | 一键部署 |
| | 初始化脚本 | 自动生成配置 |

### 不包含功能

| 功能 | 推迟到 | 原因 |
|---|---|---|
| 评分/评论 | Phase 2 | 非核心流程 |
| 团队管理 | Phase 2 | 先支持个人使用 |
| 依赖管理 | Phase 3 | 增加复杂度 |
| 包签名 | Phase 3 | 安全增强 |
| Webhook | Phase 3 | 高级功能 |
| 多 Agent (Cursor 等) | Phase 2 | 先做 Claude Code + Codex |

---

## Agent 支持

### MVP 支持

| Agent | 优先级 | 配置路径 | 配置格式 |
|---|---|---|---|
| **Claude Code** | P0 | `~/.claude/mcp.json` | `{ "mcpServers": {...} }` |
| **Codex** | P0 | `~/.codex/config.toml` | `[mcp_servers]` TOML 段 |

### 后续支持 (Phase 2+)

| Agent | 配置路径 | 备注 |
|---|---|---|
| Cursor | `~/.cursor/mcp.json` | 类似 Claude Code |
| Windsurf | `~/.windsurf/mcp.json` | 类似 Claude Code |
| Cline | VS Code settings | 需要不同适配 |
| Aider | `~/.aider.conf.yml` | YAML 格式 |

---

## Agent 适配器设计

### 架构

```
┌─────────────────────────────────────────────────────┐
│                   akit CLI                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│   install command                                   │
│        │                                            │
│        ▼                                            │
│   ┌─────────────────┐                              │
│   │ Agent Detector  │  检测已安装的 Agent           │
│   └────────┬────────┘                              │
│            │                                        │
│            ▼                                        │
│   ┌─────────────────┐                              │
│   │ Adapter Registry│  根据 Agent 类型选择适配器    │
│   └────────┬────────┘                              │
│            │                                        │
│   ┌────────┴────────┐                              │
│   ▼                 ▼                              │
│ ┌──────────┐  ┌──────────┐                        │
│ │ Claude   │  │ Codex    │  ... 更多适配器         │
│ │ Adapter  │  │ Adapter  │                        │
│ └──────────┘  └──────────┘                        │
│        │            │                              │
│        ▼            ▼                              │
│   Write Config  Write Config                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 适配器接口

```typescript
// cli/src/agents/types.ts

interface AgentAdapter {
  /** Agent 名称 */
  name: string

  /** 检测是否安装 */
  detect(): Promise<boolean>

  /** 配置文件路径 */
  getConfigPath(): string

  /** 读取当前配置 */
  readConfig(): Promise<MCPConfig>

  /** 写入配置 (追加，不覆盖) */
  writeConfig(entry: MCPEntry): Promise<void>

  /** 移除配置 */
  removeConfig(packageName: string): Promise<void>

  /** 检查配置是否存在 */
  hasConfig(packageName: string): Promise<boolean>
}

interface MCPConfig {
  [key: string]: any
}

interface MCPEntry {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}
```

### Claude Code 适配器

```typescript
// cli/src/agents/claude.ts

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export class ClaudeAdapter implements AgentAdapter {
  name = 'Claude Code'

  async detect(): Promise<boolean> {
    try {
      const configPath = this.getConfigPath()
      await fs.access(configPath)
      return true
    } catch {
      return false
    }
  }

  getConfigPath(): string {
    return path.join(os.homedir(), '.claude', 'mcp.json')
  }

  async readConfig(): Promise<MCPConfig> {
    try {
      const content = await fs.readFile(this.getConfigPath(), 'utf-8')
      return JSON.parse(content)
    } catch {
      return { mcpServers: {} }
    }
  }

  async writeConfig(entry: MCPEntry): Promise<void> {
    const config = await this.readConfig()

    // 备份已有配置
    if (config.mcpServers?.[entry.name]) {
      const backupPath = this.getConfigPath() + '.bak'
      await fs.writeFile(backupPath, JSON.stringify(config, null, 2))
    }

    // 写入新配置
    config.mcpServers = config.mcpServers || {}
    config.mcpServers[entry.name] = {
      command: entry.command,
      args: entry.args,
      env: entry.env || {}
    }

    await fs.writeFile(this.getConfigPath(), JSON.stringify(config, null, 2))
  }

  async removeConfig(packageName: string): Promise<void> {
    const config = await this.readConfig()
    if (config.mcpServers?.[packageName]) {
      delete config.mcpServers[packageName]
      await fs.writeFile(this.getConfigPath(), JSON.stringify(config, null, 2))
    }
  }

  async hasConfig(packageName: string): Promise<boolean> {
    const config = await this.readConfig()
    return !!config.mcpServers?.[packageName]
  }
}
```

### Codex 适配器

**重要：Codex 使用 TOML 格式（`~/.codex/config.toml`），不是 JSON。需要引入 TOML 解析库（如 `smol-toml` 或 `@iarna/toml`）。**

```typescript
// cli/src/agents/codex.ts
import * as TOML from 'smol-toml'

export class CodexAdapter implements AgentAdapter {
  name = 'Codex'

  async detect(): Promise<boolean> {
    try {
      const configPath = this.getConfigPath()
      await fs.access(configPath)
      return true
    } catch {
      return false
    }
  }

  getConfigPath(): string {
    return path.join(os.homedir(), '.codex', 'config.toml')
  }

  async readConfig(): Promise<MCPConfig> {
    try {
      const content = await fs.readFile(this.getConfigPath(), 'utf-8')
      return TOML.parse(content)
    } catch {
      return { mcp_servers: {} }
    }
  }

  async writeConfig(entry: MCPEntry): Promise<void> {
    const config = await this.readConfig()

    // Codex MCP 配置在 [mcp_servers.name] 段下
    config.mcp_servers = config.mcp_servers || {}
    config.mcp_servers[entry.name] = {
      command: entry.command,
      args: entry.args,
      enabled: true,
      env: entry.env || {}
    }

    await fs.writeFile(this.getConfigPath(), TOML.stringify(config))
  }

  async removeConfig(packageName: string): Promise<void> {
    const config = await this.readConfig()
    if (config.mcp_servers?.[packageName]) {
      delete config.mcp_servers[packageName]
      await fs.writeFile(this.getConfigPath(), TOML.stringify(config))
    }
  }

  async hasConfig(packageName: string): Promise<boolean> {
    const config = await this.readConfig()
    return !!config.mcp_servers?.[packageName]
  }
}
```

### 适配器注册

```typescript
// cli/src/agents/registry.ts

export class AgentRegistry {
  private adapters: Map<string, AgentAdapter> = new Map()

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.name.toLowerCase(), adapter)
  }

  get(name: string): AgentAdapter | undefined {
    return this.adapters.get(name.toLowerCase())
  }

  async detectAll(): Promise<AgentAdapter[]> {
    const detected: AgentAdapter[] = []
    for (const adapter of this.adapters.values()) {
      if (await adapter.detect()) {
        detected.push(adapter)
      }
    }
    return detected
  }
}

// 初始化
export const agentRegistry = new AgentRegistry()
agentRegistry.register(new ClaudeAdapter())
agentRegistry.register(new CodexAdapter())
```

---

## 扩展新 Agent

添加新 Agent 只需 3 步：

### 1. 创建适配器文件

```typescript
// cli/src/agents/cursor.ts

export class CursorAdapter implements AgentAdapter {
  name = 'Cursor'

  detect(): Promise<boolean> { ... }
  getConfigPath(): string { ... }
  readConfig(): Promise<MCPConfig> { ... }
  writeConfig(entry: MCPEntry): Promise<void> { ... }
  removeConfig(packageName: string): Promise<void> { ... }
  hasConfig(packageName: string): Promise<boolean> { ... }
}
```

### 2. 注册到 Registry

```typescript
// cli/src/agents/registry.ts
agentRegistry.register(new CursorAdapter())
```

### 3. 添加测试

```typescript
// cli/src/agents/__tests__/cursor.test.ts
describe('CursorAdapter', () => {
  // ...
})
```

**不需要修改核心代码！**

---

## MVP 验收标准

### 功能验收

| 场景 | 验收标准 | 测试方法 |
|---|---|---|
| 新用户注册 | OAuth 登录成功，获取 JWT Token | 手动测试 |
| 发布 MCP | `akit publish` 成功，Web UI 可见 | 手动测试 |
| 安装 MCP | `akit install` 成功，Agent 可用 | 手动测试 |
| 搜索包 | `akit search` 返回结果 | 手动测试 |
| Docker 部署 | `docker compose up` 一键启动 | 脚本测试 |

### 性能验收

| 指标 | 目标 | 测试方法 |
|---|---|---|
| CLI 安装 (10MB 包) | < 5s | 计时测试 |
| API 响应时间 | P95 < 200ms | 压力测试 |
| Web 首屏加载 | < 2s | Lighthouse |
| Docker 启动时间 | < 30s | 计时测试 |

### 体验验收

| 场景 | 目标 |
|---|---|
| 零到安装第一个 MCP | < 3 分钟 |
| 首次 Docker 部署 | < 5 分钟 |
| 学习成本 | 看 README 即可上手 |

---

## MVP 时间表

```
Week 1: 基础搭建
├── 项目脚手架 (server/cli/web)
├── 数据库 Schema
├── API 基础框架
└── Docker Compose 基础配置

Week 2: 核心功能
├── CLI: login, publish, install
├── API: 包 CRUD + 版本管理
├── Agent 适配器: Claude Code
└── Web UI: 登录 + 包列表

Week 3: 完善和测试
├── Agent 适配器: Codex
├── CLI: list, search, info, uninstall
├── Web UI: 包详情 + 个人中心
├── 集成测试
└── 文档编写
```

---

## 成功指标

| 指标 | 目标 | 衡量方式 |
|---|---|---|
| 内部使用 | 3 人持续使用 1 周 | 用户反馈 |
| 核心流程 bug | 0 个 blocker | Bug 追踪 |
| 新用户上手时间 | < 3 分钟 | 用户测试 |
| Docker 部署成功率 | 100% | 自动化测试 |
