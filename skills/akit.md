---
name: akit
description: Agent Kit Admin - 管理团队的 MCP 和 Skills 的包管理工具
---

# akit - Agent Kit Admin CLI

## 何时使用此 Skill

当用户提到以下操作时使用此 Skill：
- 安装、下载、添加 MCP 或 Skill
- 搜索、查找可用的包
- 查看包详情、包信息
- 列出已安装的包
- 更新、升级包
- 卸载、删除、移除包
- 发布、上传包
- 初始化项目配置

## 前置条件

### 1. 检查 akit 是否安装

执行命令前，先检查 akit CLI 是否已安装：

```bash
which akit
```

如果命令不存在，提示用户安装：
```
akit CLI 未安装。请先运行：
npm install -g @agent-kit-admin/cli
```

### 2. 检查登录状态

对于需要登录的操作（安装私有包、发布），检查登录状态：

```bash
akit whoami
```

如果未登录，提示用户：
```
未登录到 Registry。请先运行：
akit login --server <server-url>
```

## 命令参考

### 登录

```bash
# OAuth 登录（打开浏览器）
akit login --server <server-url>

# Token 登录（CI/CD 场景）
akit login --server <server-url> --token <token>

# 环境变量方式
export AKIT_SERVER=<server-url>
export AKIT_TOKEN=<token>
```

### 搜索包

```bash
# 搜索关键词
akit search <keyword>

# 按类型筛选
akit search <keyword> --type mcp
akit search <keyword> --type skill

# 按 scope 筛选
akit search <keyword> --scope @team
```

### 查看包详情

```bash
# 查看包信息
akit info <package>

# 示例
akit info @team/web-search
akit info @team/pg-mcp
```

### 安装包

```bash
# 安装最新版
akit install <package>

# 安装指定版本
akit install <package>@<version>

# 安装到指定 Agent
akit install --agent claude <package>
akit install --agent codex <package>

# 示例
akit install @team/web-search
akit install @team/pg-mcp@1.2.0
akit install --agent codex @team/web-search
```

### 卸载包

```bash
# 卸载包
akit uninstall <package>

# 示例
akit uninstall @team/web-search
```

### 更新包

```bash
# 更新单个包
akit update <package>

# 更新所有包
akit update --all

# 示例
akit update @team/web-search
akit update --all
```

### 列出已安装包

```bash
# 列出所有
akit list

# 按类型筛选
akit list --type mcp
akit list --type skill
```

### 发布包

```bash
# 发布当前目录
akit publish

# 发布指定目录
akit publish <directory>

# 指定版本
akit publish --version <version>

# 干跑模式（不实际发布）
akit publish --dry-run

# 示例
akit publish
akit publish ./my-mcp
akit publish --version 1.0.1
```

### 初始化项目

```bash
# 交互式创建 akit.json
akit init
```

## 自然语言映射

根据用户的自然语言输入，识别意图并执行对应命令：

### 安装意图
- 关键词: 安装、install、下载、添加、装
- 命令: `akit install {package}`
- 示例: "帮我安装 @team/web-search" → `akit install @team/web-search`

### 搜索意图
- 关键词: 搜索、search、找、查找、有什么、有哪些
- 命令: `akit search {keyword}`
- 示例: "有什么数据库相关的 MCP？" → `akit search database --type mcp`

### 查看意图
- 关键词: 查看、info、详情、是什么、介绍
- 命令: `akit info {package}`
- 示例: "@team/pg-mcp 是什么？" → `akit info @team/pg-mcp`

### 列表意图
- 关键词: 列表、list、已安装、我安装了、装了什么
- 命令: `akit list`
- 示例: "我安装了哪些包？" → `akit list`

### 更新意图
- 关键词: 更新、update、升级
- 命令: `akit update {package}` 或 `akit update --all`
- 示例: "更新所有包" → `akit update --all`

### 卸载意图
- 关键词: 卸载、uninstall、删除、移除
- 命令: `akit uninstall {package}`
- 示例: "删除 @team/redis-mcp" → `akit uninstall @team/redis-mcp`

### 发布意图
- 关键词: 发布、publish、上传
- 命令: `akit publish`
- 示例: "发布当前项目" → `akit publish`

## 执行流程

1. **解析用户意图**
   - 识别操作类型（安装/搜索/查看/更新/卸载/发布）
   - 提取目标包名
   - 提取额外参数（版本、类型、Agent 等）

2. **检查前置条件**
   - akit CLI 是否已安装
   - 是否已登录（如需要）
   - 当前目录是否有 akit.json（发布时）

3. **执行命令**
   - 构建完整的 akit 命令
   - 执行命令
   - 捕获 stdout 和 stderr

4. **处理结果**
   - 成功：格式化输出展示给用户
   - 失败：分析错误原因，给出解决建议

## 输出格式化

### 成功操作

```
✔ {操作}成功

{详细信息}
```

### 列表结果

将输出转换为易读的表格格式：

```
已安装的包：

| 包名 | 版本 | 类型 |
|---|---|---|
| @team/web-search | 1.2.0 | MCP |
| @team/pg-mcp | 1.0.0 | MCP |
```

### 错误信息

```
✖ {错误描述}

{解决建议}
```

## 错误处理

### CLI 未安装

```
akit CLI 未安装。

请运行以下命令安装：
npm install -g @agent-kit-admin/cli

安装完成后重新执行命令。
```

### 未登录

```
未登录到 Registry。

请运行以下命令登录：
akit login --server <server-url>

或者设置环境变量：
export AKIT_SERVER=<server-url>
export AKIT_TOKEN=<token>
```

### 包不存在

```
未找到包 {package}。

可能原因：
1. 包名拼写错误
2. 包已被删除
3. 没有访问权限

建议：
- 搜索相关包：akit search {keyword}
- 检查包名拼写
- 联系包作者
```

### 版本不存在

```
版本 {version} 不存在。

可用版本：
{版本列表}

建议安装最新版：akit install {package}
```

### 网络错误

```
网络连接失败。

请检查：
1. 网络连接是否正常
2. Registry 地址是否正确
3. 是否需要配置代理

重试命令：{原始命令}
```

### 权限不足

```
没有权限执行此操作。

可能原因：
1. 未登录或 Token 已过期
2. 没有包的访问权限
3. 没有发布权限

建议：
- 重新登录：akit login --server <server-url>
- 联系管理员获取权限
```

## 示例对话

### 示例 1: 安装 MCP

**用户:** 帮我安装 @team/web-search

**Claude:**

我来帮你安装这个 MCP。

```bash
akit install @team/web-search
```

执行结果：
```
✔ Installed @team/web-search@1.2.0 successfully!
  📁 Package: ~/.akit/packages/@team/web-search/
  ⚙️  Config: ~/.claude/mcp.json
  🔄 Restart Claude Code to use the new MCP
```

安装成功！这个 MCP 提供了网页搜索功能。请重启 Claude Code 后使用。

---

### 示例 2: 搜索包

**用户:** 有什么数据库相关的 MCP？

**Claude:**

我来搜索数据库相关的 MCP。

```bash
akit search database --type mcp
```

搜索结果：

| 包名 | 版本 | 评分 | 下载量 |
|---|---|---|---|
| @team/pg-mcp | 1.2.0 | ⭐ 4.8 | 234 |
| @team/redis-mcp | 1.0.0 | ⭐ 4.5 | 156 |
| @zhangsan/sqlite-mcp | 0.3.0 | ⭐ 4.2 | 89 |

推荐安装 `@team/pg-mcp`，它是 PostgreSQL 的 MCP 工具，评分最高。

需要我帮你安装吗？

---

### 示例 3: 查看已安装包

**用户:** 我安装了哪些 MCP？

**Claude:**

```bash
akit list --type mcp
```

已安装的 MCP：

| 包名 | 版本 | 最新版本 | 状态 |
|---|---|---|---|
| @team/pg-mcp | 1.2.0 | 1.3.0 | ⚠️ 可更新 |
| @team/web-search | 1.0.0 | 1.0.0 | ✅ 最新 |
| @team/redis-mcp | 1.0.0 | 1.0.0 | ✅ 最新 |

`@team/pg-mcp` 有新版本可用。需要更新吗？

---

### 示例 4: 发布 MCP

**用户:** 我想发布当前目录的 MCP

**Claude:**

我来帮你发布。先检查一下配置。

检测到 `akit.json`：
```json
{
  "name": "my-awesome-mcp",
  "version": "1.0.0",
  "type": "mcp",
  "description": "My awesome MCP tool"
}
```

准备发布 `@xiaoming/my-awesome-mcp@1.0.0`，确认发布吗？

**用户:** 确认

**Claude:**

```bash
akit publish
```

执行结果：
```
✔ Published @xiaoming/my-awesome-mcp@1.0.0 successfully!
  📦 Package: https://registry.company.com/@xiaoming/my-awesome-mcp
  📋 Install: akit install @xiaoming/my-awesome-mcp
```

发布成功！其他人可以通过以下命令安装：
```bash
akit install @xiaoming/my-awesome-mcp
```

---

### 示例 5: 更新所有包

**用户:** 更新我所有的包

**Claude:**

```bash
akit update --all
```

更新结果：

| 包名 | 旧版本 | 新版本 | 状态 |
|---|---|---|---|
| @team/pg-mcp | 1.2.0 | 1.3.0 | ✅ 已更新 |
| @team/web-search | 1.0.0 | 1.0.0 | ⏭️ 已是最新 |
| @team/redis-mcp | 1.0.0 | 1.1.0 | ✅ 已更新 |

更新完成！2 个包已更新到最新版本。请重启 Claude Code 使更新生效。

---

## 注意事项

1. **包名格式**: 包名通常格式为 `@scope/name`，如 `@team/web-search`
2. **版本号**: 遵循 semver 规范，如 `1.0.0`
3. **Agent 检测**: 安装时会自动检测已安装的 Agent
4. **配置备份**: 写入 Agent 配置前会自动备份
5. **重启提示**: 安装/更新后需要重启 Agent 才能生效
