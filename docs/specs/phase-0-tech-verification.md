# Phase 0: 技术验证 SPEC

## 目标

验证核心链路可行性：发布 → 下载 → 配置 → 使用。

## 时间

Week 0 (1 周)

## 范围

最小化验证，不追求代码质量，不写测试，不要求架构正确。

## 验证链路

```
手动打包 MCP → 上传 MinIO → 手动下载 → 写入 Claude Code 配置 → 验证 MCP 可用
```

## 交付物

### 1. MinIO 手动验证

- [ ] 启动 MinIO (Docker)
- [ ] 创建 `packages` bucket
- [ ] 手动上传一个 `.tar.gz` MCP 包
- [ ] 生成预签名下载 URL
- [ ] 验证 URL 可下载

### 2. MCP 包准备

- [ ] 选择一个简单 MCP Server (如 `@modelcontextprotocol/server-filesystem`)
- [ ] 打包为 `.tar.gz`，包含 `akit.json`
- [ ] `akit.json` 格式：
  ```json
  {
    "name": "filesystem",
    "version": "1.0.0",
    "type": "mcp",
    "mcp": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
  ```

### 3. Claude Code 配置验证

- [ ] 手动下载包到本地
- [ ] 手动编辑 `~/.claude/mcp.json`，添加 MCP 配置
- [ ] 重启 Claude Code
- [ ] 验证 MCP 工具可用（如 `list_files`）

### 4. PostgreSQL 表结构验证

- [ ] 启动 PostgreSQL (Docker)
- [ ] 手动执行建表 SQL (参考 `wiki/04-data-model.md`)
- [ ] 手动 INSERT 一条包记录
- [ ] 手动查询验证

## 验收标准

- [ ] 完整的 发布 → 下载 → 配置 → 使用 流程跑通
- [ ] MCP 在 Claude Code 中可正常调用
- [ ] 记录验证过程和遇到的问题

## 技术决策记录

验证过程中需要确认的技术决策：

| 决策项 | 验证内容 |
|---|---|
| MinIO 预签名 URL | 302 重定向 vs 直接返回 URL |
| MCP 包格式 | `.tar.gz` 目录结构 |
| Claude Code 配置格式 | `mcpServers` JSON 结构 |
| PostgreSQL JSONB | manifest 字段存储验证 |

## 不做

- ❌ 不写 API 代码
- ❌ 不写 CLI 代码
- ❌ 不写前端
- ❌ 不写测试
- ❌ 不要求架构正确
