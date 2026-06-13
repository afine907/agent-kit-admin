# 边界场景处理

## 概述

本文档定义了各种异常和边界场景的处理方式，确保系统在非正常情况下也能给出合理的响应。

---

## EC-01: 包发布冲突

### 场景
两个用户同时发布同一个包的同一个版本。

### 复现步骤
```bash
# 终端 1
akit publish ./my-mcp  # 版本 1.0.0

# 终端 2 (几乎同时)
akit publish ./my-mcp  # 版本 1.0.0
```

### 处理方式
- 数据库 `packages` 表 `(scope, name)` 唯一约束
- 数据库 `versions` 表 `(package_id, version)` 唯一约束
- 后到的请求返回 409 Conflict

### 响应
```json
{
  "error": {
    "code": 20004,
    "message": "Version 1.0.0 already exists",
    "details": {
      "package": "@team/web-search",
      "version": "1.0.0",
      "published_at": "2024-01-15T10:30:00Z",
      "published_by": "zhangsan"
    }
  }
}
```

### CLI 提示
```
✖ Error: Version 1.0.0 already exists
  Published by zhangsan at 2024-01-15 10:30:00
  
  Try: akit publish --version 1.0.1
```

---

## EC-02: 配置文件损坏

### 场景
`~/.claude/mcp.json` 格式错误（手动编辑失误）。

### 复现步骤
```bash
# 手动编辑导致 JSON 格式错误
echo "invalid json" > ~/.claude/mcp.json

# 尝试安装
akit install @team/web-search
```

### 处理方式
1. CLI 读取配置文件
2. JSON 解析失败
3. 备份损坏文件为 `mcp.json.corrupt.20240115`
4. 创建新的空配置文件
5. 继续安装流程

### CLI 提示
```
⚠ Warning: Config file corrupted
  Backed up to: ~/.claude/mcp.json.corrupt.20240115
  Created new config file

✔ Installed @team/web-search successfully
```

---

## EC-03: 配置写入冲突

### 场景
安装的包名在配置中已存在。

### 复现步骤
```bash
# 已安装过 @team/web-search
akit install @team/web-search  # 再次安装（可能不同版本）
```

### 处理方式
1. 检测到配置已存在
2. 备份当前配置为 `mcp.json.bak`
3. 覆盖写入新配置
4. 提示用户

### CLI 提示
```
⚠ Config for @team/web-search already exists
  Backed up to: ~/.claude/mcp.json.bak
  Updated to new version

✔ Installed @team/web-search@1.2.0 successfully
```

---

## EC-04: 网络中断

### 场景
安装过程中网络中断。

### 复现步骤
```bash
# 开始安装
akit install @team/large-mcp

# 下载过程中断网
```

### 处理方式
1. HTTP 请求设置超时 (30s)
2. 下载失败自动重试 3 次
3. 重试间隔: 1s → 2s → 4s (指数退避)
4. 3 次都失败则报错

### CLI 提示
```
⠋ Downloading @team/large-mcp@1.0.0...
⚠ Network error, retrying... (1/3)
⚠ Network error, retrying... (2/3)
⚠ Network error, retrying... (3/3)
✖ Error: Download failed after 3 retries
  Please check your network and try again
```

### 断点续传 (v2)
- 记录已下载字节数
- 重试时使用 `Range` 请求头
- 合并文件

---

## EC-05: 磁盘空间不足

### 场景
服务器磁盘满，无法存储新包。

### 处理方式
1. MinIO 返回 507 Insufficient Storage
2. API 返回明确错误信息
3. CLI 展示友好提示

### API 响应
```json
{
  "error": {
    "code": 30002,
    "message": "Storage full, unable to upload package",
    "details": {
      "required_bytes": 10485760,
      "available_bytes": 1048576
    }
  }
}
```

### CLI 提示
```
✖ Error: Storage full
  Required: 10 MB
  Available: 1 MB
  
  Please contact your admin to free up space
```

---

## EC-06: Agent 未安装

### 场景
用户尝试安装 MCP，但没有安装任何支持的 Agent。

### 复现步骤
```bash
# 在没有 Claude Code 和 Codex 的机器上
akit install @team/web-search
```

### 处理方式
1. CLI 检测所有支持的 Agent
2. 没有检测到任何 Agent
3. 下载包但跳过配置写入
4. 提示用户手动配置

### CLI 提示
```
⚠ Warning: No supported Agent detected
  - Claude Code: not found
  - Codex: not found

  Package downloaded to: ~/.akit/packages/@team/web-search/
  
  To use this MCP, manually add it to your Agent config:
  
  Claude Code (~/.claude/mcp.json):
  {
    "mcpServers": {
      "web-search": {
        "command": "node",
        "args": ["~/.akit/packages/@team/web-search/index.js"]
      }
    }
  }
```

---

## EC-07: 版本不存在

### 场景
安装指定版本，但该版本不存在。

### 复现步骤
```bash
akit install @team/web-search@9.9.9
```

### 处理方式
1. API 查询版本，返回 404
2. CLI 展示可用版本列表

### CLI 提示
```
✖ Error: Version 9.9.9 not found

  Available versions:
    1.2.0 (latest)
    1.1.0
    1.0.0
  
  Try: akit install @team/web-search@1.2.0
```

---

## EC-08: 包已被删除

### 场景
安装的包已被作者删除（软删除，`deleted_at IS NOT NULL`）。

### 处理方式
1. API 返回 410 Gone (已删除)，错误码 20005
2. CLI 提示包已不可用

### API 响应
```json
{
  "error": {
    "code": 20005,
    "message": "Package @team/web-search has been removed",
    "details": {
      "deleted_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

### CLI 提示
```
✖ Error: Package @team/web-search has been removed
  This package was deleted by the author
  
  Contact the author or search for alternatives:
  akit search web-search
```

---

## EC-09: Token 过期

### 场景
CLI 使用的 JWT Token 已过期。

### 复现步骤
```bash
# Token 已过期 (24h)
akit publish ./my-mcp
```

### 处理方式
1. API 返回 401 Unauthorized
2. CLI 检测到 Token 过期
3. 提示重新登录

### CLI 提示
```
✖ Error: Session expired

  Please login again:
  akit login --server https://your-registry.com
```

---

## EC-10: 权限不足

### 场景
普通成员尝试删除其他人的包。

### 处理方式
1. API 返回 403 Forbidden
2. CLI 提示权限不足

### CLI 提示
```
✖ Error: Permission denied
  You don't have permission to delete @team/web-search
  
  Contact the package owner or team admin
```

---

## EC-11: 并发写入配置文件

### 场景
多个终端同时执行 install 命令。

### 复现步骤
```bash
# 终端 1
akit install @team/mcp-a

# 终端 2 (几乎同时)
akit install @team/mcp-b
```

### 处理方式
1. 使用文件锁 (flock / lockfile)
2. 获取锁超时 10 秒
3. 超时则报错

### CLI 提示
```
⚠ Waiting for config lock...
✖ Error: Config file is locked
  Another akit process is running
  
  If no other process is running, delete: ~/.akit/config.lock
```

---

## EC-12: 依赖包不存在

### 场景 (v2)
安装的包依赖另一个不存在的包。

### 处理方式
1. 检查依赖是否存在
2. 列出所有缺失的依赖
3. 提示用户

### CLI 提示
```
✖ Error: Missing dependencies

  @team/skill-a requires:
    @team/mcp-helper@^1.0.0 - NOT FOUND
  
  Please install missing dependencies first:
  akit install @team/mcp-helper
```

---

## EC-13: 循环依赖

### 场景 (v2)
包 A 依赖包 B，包 B 依赖包 A。

### 处理方式
1. 安装时检测循环依赖
2. 中断并提示

### CLI 提示
```
✖ Error: Circular dependency detected

  @team/a → @team/b → @team/a
  
  Please contact the package authors to resolve this
```

---

## EC-14: 包体积超限

### 场景
发布的包超过大小限制 (100MB)。

### 处理方式
1. CLI 本地检测包大小
2. 超限则阻止上传

### CLI 提示
```
✖ Error: Package too large
  Size: 150 MB
  Limit: 100 MB
  
  Reduce package size or contact admin to increase limit
```

---

## EC-15: manifest 格式错误

### 场景
`akit.json` 格式不正确。

### 复现步骤
```json
// akit.json - 缺少必填字段
{
  "name": "web-search"
  // 缺少 version, type 等
}
```

### 处理方式
1. CLI 本地校验 manifest
2. 列出所有错误

### CLI 提示
```
✖ Error: Invalid manifest (akit.json)

  Missing required fields:
    - version
    - type
  
  Invalid fields:
    - transport: must be one of [stdio, sse, streamable-http]
  
  See: https://docs.agent-kit.dev/manifest
```

---

## EC-16: 数据库连接失败

### 场景
服务启动时数据库不可用。

### 处理方式
1. 启动时检查数据库连接
2. 连接失败则启动失败
3. Docker 健康检查失败，自动重启

### 日志
```json
{
  "level": "ERROR",
  "message": "Database connection failed",
  "error": "connection refused",
  "retries": 3
}
```

### API 响应 (运行中连接断开)
```json
{
  "error": {
    "code": 30001,
    "message": "Database unavailable, please try again later"
  }
}
```

---

## EC-17: MinIO 连接失败

### 场景
包下载时 MinIO 不可用。

### 处理方式
1. API 返回 503 Service Unavailable
2. CLI 提示稍后重试

### CLI 提示
```
✖ Error: Storage service unavailable
  Please try again later
```

---

## EC-18: 用户名冲突

### 场景
OAuth 登录时，用户名已被占用。

### 复现步骤
1. 用户 A 用企微登录，用户名 "zhangsan"
2. 用户 B 用飞书登录，也叫 "zhangsan"

### 处理方式
1. 检测用户名冲突
2. 自动添加数字后缀
3. 允许用户后续修改

### 自动处理
```
用户 A: zhangsan
用户 B: zhangsan-2
```

---

## EC-19: 包名保留字

### 场景
用户尝试注册保留字作为包名。

### 保留字列表
- `admin`
- `api`
- `system`
- `root`
- `test`
- `official`

### 处理方式
1. CLI 本地校验
2. API 二次校验

### CLI 提示
```
✖ Error: "admin" is a reserved name
  Please choose a different package name
```

---

## EC-20: 并发版本号递增

### 场景
用户希望自动递增版本号。

### 处理方式
1. CLI 查询最新版本
2. 自动递增 patch 版本
3. 允许用户覆盖

### CLI 提示
```
Latest version: 1.2.0

? Next version: (1.2.1) › 
```

---

## 错误码汇总

| 场景 | HTTP Status | 错误码 | CLI 提示 |
|---|---|---|---|
| 版本冲突 | 409 | 20004 | Version already exists |
| 配置损坏 | - | - | Config corrupted, backed up |
| 网络中断 | - | - | Network error, retrying |
| 磁盘满 | 507 | 30003 | Storage full |
| Agent 未安装 | - | - | No Agent detected |
| 版本不存在 | 404 | 20003 | Version not found |
| 包已删除 | 410 | 20005 | Package removed |
| Token 过期 | 401 | 20001 | Session expired |
| 权限不足 | 403 | 20002 | Permission denied |
| 配置锁冲突 | - | - | Config locked |
| 依赖缺失 | 400 | 20000 | Missing dependencies |
| 循环依赖 | 400 | 20000 | Circular dependency |
| 包太大 | 400 | 20000 | Package too large |
| manifest 错误 | 400 | 20000 | Invalid manifest |
| 数据库错误 | 500 | 30001 | Database error |
| 存储错误 | 503 | 30002 | Storage unavailable |
