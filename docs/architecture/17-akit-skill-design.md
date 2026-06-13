# akit Skill 设计文档

## 概述

将 `akit` CLI 封装为 Claude Code Skill，让用户可以通过自然语言在 Claude Code 中直接操作包管理。

**核心价值：**
- 用户无需记忆 CLI 命令
- 自然语言交互，降低学习成本
- Claude Code 成为包管理的统一入口

---

## 设计目标

### 1. 自然语言 → akit 命令

| 用户输入 | 映射命令 |
|---|---|
| "帮我安装 @team/web-search" | `akit install @team/web-search` |
| "搜索数据库相关的 MCP" | `akit search database --type mcp` |
| "看看我安装了哪些包" | `akit list` |
| "发布当前目录的 MCP" | `akit publish ./` |
| "更新所有已安装的包" | `akit update --all` |
| "卸载 @team/redis-mcp" | `akit uninstall @team/redis-mcp` |

### 2. 上下文感知

- 自动检测当前目录是否有 `akit.json`
- 自动判断是 MCP 还是 Skill
- 自动识别 Agent 类型（Claude Code / Codex）

### 3. 错误处理

- 命令执行失败时给出清晰提示
- 自动建议修复方案
- 网络错误时自动重试

---

## Skill 文件格式

### 文件位置

```
~/.claude/skills/akit.md
```

或项目级别：

```
<project>/.claude/skills/akit.md
```

### Skill 文件结构

```markdown
---
name: akit
description: Agent Kit Admin - 管理团队的 MCP 和 Skills
---

# akit - Agent Kit Admin CLI

## 何时使用此 Skill

当用户想要：
- 安装、卸载、更新 MCP 或 Skill
- 搜索可用的包
- 查看已安装的包
- 发布新的 MCP 或 Skill
- 管理 Agent 配置

时，使用此 Skill 来执行 `akit` 命令。

## 前置条件

确保用户已安装 akit CLI：
```bash
npm install -g @agent-kit-admin/cli
```

如果未安装，提示用户先安装。

## 命令参考

### 登录

```bash
# OAuth 登录（打开浏览器）
akit login --server <server-url>

# Token 登录（CI/CD）
akit login --server <server-url> --token <token>
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
akit info <package-name>
# 例如: akit info @team/web-search
```

### 安装包

```bash
# 安装最新版
akit install <package-name>

# 安装指定版本
akit install <package-name>@<version>

# 安装到指定 Agent
akit install --agent claude <package-name>
akit install --agent codex <package-name>
```

### 卸载包

```bash
akit uninstall <package-name>
```

### 更新包

```bash
# 更新单个包
akit update <package-name>

# 更新所有包
akit update --all
```

### 查看已安装包

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
```

### 初始化项目

```bash
# 交互式创建 akit.json
akit init
```

## 自然语言映射规则

### 安装相关

- "安装 xxx" / "install xxx" → `akit install xxx`
- "下载 xxx" → `akit install xxx`
- "添加 xxx" → `akit install xxx`

### 搜索相关

- "搜索 xxx" / "search xxx" → `akit search xxx`
- "找 xxx" / "find xxx" → `akit search xxx`
- "有什么 xxx 相关的" → `akit search xxx`
- "列出所有 MCP" → `akit list --type mcp`

### 查看相关

- "查看 xxx" / "info xxx" → `akit info xxx`
- "xxx 是什么" → `akit info xxx`
- "我安装了什么" → `akit list`
- "已安装的包" → `akit list`

### 更新相关

- "更新 xxx" / "update xxx" → `akit update xxx`
- "升级 xxx" → `akit update xxx`
- "更新所有" → `akit update --all`

### 卸载相关

- "卸载 xxx" / "uninstall xxx" → `akit uninstall xxx`
- "删除 xxx" → `akit uninstall xxx`
- "移除 xxx" → `akit uninstall xxx`

### 发布相关

- "发布" / "publish" → `akit publish`
- "发布当前项目" → `akit publish`
- "发布 xxx" → `akit publish <directory>`

## 执行流程

1. **解析用户意图**
   - 识别操作类型（安装/搜索/查看/更新/卸载/发布）
   - 提取目标包名
   - 提取参数（版本、类型等）

2. **检查前置条件**
   - akit CLI 是否已安装
   - 是否已登录
   - 当前目录是否有 akit.json（发布时）

3. **执行命令**
   - 构建 akit 命令
   - 执行命令
   - 捕获输出

4. **处理结果**
   - 成功：显示结果
   - 失败：分析错误并给出建议

## 错误处理

### CLI 未安装

```
akit CLI 未安装。请先安装：

npm install -g @agent-kit-admin/cli

安装后重新执行命令。
```

### 未登录

```
未登录到 Registry。请先登录：

akit login --server <server-url>

或者提供 Token：
export AKIT_TOKEN=<your-token>
```

### 包不存在

```
未找到包 @team/xxx。可能原因：
1. 包名拼写错误
2. 包已被删除
3. 没有访问权限

尝试搜索：akit search xxx
```

### 网络错误

```
网络连接失败。请检查：
1. 网络连接是否正常
2. Registry 地址是否正确
3. 是否需要代理

重试命令：akit install @team/xxx
```

## 示例对话

### 示例 1: 安装 MCP

**用户:** 帮我安装 @team/web-search 这个 MCP

**Claude:** 我来帮你安装这个 MCP。

```bash
akit install @team/web-search
```

执行结果：
```
✔ Installed @team/web-search@1.2.0 successfully!
  → ~/.akit/packages/@team/web-search/
  → Claude Code config updated
```

安装成功！这个 MCP 提供了网页搜索功能。需要重启 Claude Code 才能使用。

### 示例 2: 搜索包

**用户:** 有什么数据库相关的 MCP？

**Claude:** 我来搜索数据库相关的 MCP。

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

### 示例 3: 发布 MCP

**用户:** 我想发布当前目录的 MCP

**Claude:** 我来帮你发布。先检查一下当前目录的配置。

检测到 `akit.json`：
```json
{
  "name": "my-awesome-mcp",
  "version": "1.0.0",
  "type": "mcp"
}
```

准备发布 `@xiaoming/my-awesome-mcp@1.0.0`。确认发布吗？

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

### 示例 4: 查看已安装包

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

`@team/pg-mcp` 有新版本可用，需要更新吗？

---

## 实现细节

### Skill 文件完整内容

```markdown
---
name: akit
description: Agent Kit Admin - 管理团队的 MCP 和 Skills
---

# akit - Agent Kit Admin CLI

## 概述

akit 是 Agent Kit Admin 的命令行工具，用于管理团队的 MCP (Model Context Protocol) 和 Skills。

## 何时使用此 Skill

当用户想要进行以下操作时使用此 Skill：
- 安装、卸载、更新 MCP 或 Skill
- 搜索可用的包
- 查看已安装的包
- 发布新的 MCP 或 Skill
- 管理 Agent 配置

## 前置条件检查

在执行命令前，先检查 akit 是否已安装：

```bash
which akit || npm list -g @agent-kit-admin/cli
```

如果未安装，提示用户：
```
akit CLI 未安装。请先安装：
npm install -g @agent-kit-admin/cli
```

## 命令参考

### 登录
```bash
akit login --server <server-url>
akit login --server <server-url> --token <token>
```

### 搜索
```bash
akit search <keyword>
akit search <keyword> --type mcp|skill
akit search <keyword> --scope @team
```

### 查看详情
```bash
akit info <package>
```

### 安装
```bash
akit install <package>
akit install <package>@<version>
akit install --agent claude|codex <package>
```

### 卸载
```bash
akit uninstall <package>
```

### 更新
```bash
akit update <package>
akit update --all
```

### 列表
```bash
akit list
akit list --type mcp|skill
```

### 发布
```bash
akit publish
akit publish <directory>
akit publish --version <version>
akit publish --dry-run
```

### 初始化
```bash
akit init
```

## 自然语言映射

根据用户的自然语言输入，映射到对应的 akit 命令：

| 用户意图 | 关键词 | 命令模板 |
|---|---|---|
| 安装 | 安装/install/下载/添加 | `akit install {package}` |
| 搜索 | 搜索/search/找/有什么 | `akit search {keyword}` |
| 查看 | 查看/info/是什么/详情 | `akit info {package}` |
| 列表 | 列表/list/已安装/我安装了 | `akit list` |
| 更新 | 更新/update/升级 | `akit update {package}` |
| 卸载 | 卸载/uninstall/删除/移除 | `akit uninstall {package}` |
| 发布 | 发布/publish | `akit publish` |
| 初始化 | 初始化/init/创建配置 | `akit init` |

## 执行流程

1. 解析用户意图，确定操作类型
2. 提取包名、版本、参数
3. 检查前置条件（CLI 安装、登录状态）
4. 构建并执行 akit 命令
5. 解析输出，格式化展示给用户
6. 如果出错，分析原因并给出建议

## 错误处理

### 常见错误及解决方案

**未安装 CLI:**
```
akit CLI 未安装。运行: npm install -g @agent-kit-admin/cli
```

**未登录:**
```
未登录。运行: akit login --server <server-url>
```

**包不存在:**
```
包 {package} 不存在。尝试搜索: akit search {keyword}
```

**版本冲突:**
```
版本 {version} 已存在。尝试新版本: akit publish --version {new-version}
```

**网络错误:**
```
网络连接失败，请检查网络后重试。
```

## 输出格式化

命令执行后，将输出格式化为易读的格式：

- 成功操作：显示 ✔ 和摘要
- 列表结果：转换为表格
- 错误信息：显示 ✖ 和解决建议
- 进度信息：显示进度条

## 示例

### 安装示例
用户: "帮我安装 @team/web-search"
执行: `akit install @team/web-search`
输出: 安装成功信息

### 搜索示例
用户: "有什么数据库相关的 MCP？"
执行: `akit search database --type mcp`
输出: 搜索结果列表

### 发布示例
用户: "发布当前目录的 MCP"
执行: `akit publish`
输出: 发布成功信息
```

---

## 安装方式

### 方式 1: 手动安装

```bash
# 复制 Skill 文件到 Claude Code 配置目录
cp akit.md ~/.claude/skills/akit.md
```

### 方式 2: 通过 akit 安装

```bash
# akit CLI 自动安装 Skill
akit setup-claude-skill
```

### 方式 3: 项目级别安装

```bash
# 在项目中创建 Skill
mkdir -p .claude/skills
cp akit.md .claude/skills/akit.md
```

---

## 扩展性

### 支持更多 Agent

未来可以扩展支持：
- Cursor Skill
- Codex Skill
- Windsurf Skill

### 自定义映射

用户可以自定义自然语言映射规则：

```yaml
# ~/.akit/skill-config.yaml
mappings:
  - keywords: ["装", "install"]
    command: "akit install"
  - keywords: ["搜", "search"]
    command: "akit search"
```

---

## 与 akit CLI 的关系

```
┌─────────────────────────────────────────────────────┐
│                   Claude Code                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│   用户输入: "帮我安装 @team/web-search"             │
│                    │                                │
│                    ▼                                │
│   ┌─────────────────────────────┐                  │
│   │      akit Skill             │                  │
│   │  (自然语言 → 命令映射)      │                  │
│   └─────────────┬───────────────┘                  │
│                 │                                   │
│                 ▼                                   │
│   ┌─────────────────────────────┐                  │
│   │   akit CLI                  │                  │
│   │  (执行包管理操作)           │                  │
│   └─────────────┬───────────────┘                  │
│                 │                                   │
│                 ▼                                   │
│   ┌─────────────────────────────┐                  │
│   │   Agent Kit Admin Server    │                  │
│   │  (API 服务)                 │                  │
│   └─────────────────────────────┘                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Skill 是 CLI 的"自然语言接口"，不直接调用 API，而是通过 CLI 执行。

---

## 测试用例

### 功能测试

| 测试场景 | 用户输入 | 预期命令 | 预期结果 |
|---|---|---|---|
| 安装 MCP | "安装 @team/web-search" | `akit install @team/web-search` | 安装成功 |
| 搜索 MCP | "搜索数据库" | `akit search database` | 返回结果列表 |
| 查看详情 | "@team/pg-mcp 是什么" | `akit info @team/pg-mcp` | 显示包详情 |
| 列出已安装 | "我安装了什么" | `akit list` | 显示已安装列表 |
| 更新包 | "更新 @team/pg-mcp" | `akit update @team/pg-mcp` | 更新成功 |
| 卸载包 | "删除 @team/redis-mcp" | `akit uninstall @team/redis-mcp` | 卸载成功 |
| 发布 | "发布当前项目" | `akit publish` | 发布成功 |

### 边界测试

| 测试场景 | 用户输入 | 预期行为 |
|---|---|---|
| CLI 未安装 | "安装 xxx" | 提示安装 CLI |
| 未登录 | "安装 xxx" | 提示登录 |
| 包不存在 | "安装 @team/xxx" | 提示包不存在 |
| 网络错误 | "安装 xxx" | 提示网络错误 |
| 版本冲突 | "发布" | 提示版本冲突 |
