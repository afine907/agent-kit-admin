# 用户旅程

## 概述

本文档描述一个真实用户从零开始使用 Agent Kit Admin 的完整体验。这是产品设计的"北极星"——所有功能都服务于这个旅程的顺畅。

---

## 用户画像

**小明** - 前端开发工程师
- 使用 Claude Code 进行日常开发
- 团队 10 人，想共享 Skill 工具
- 技术水平：中等，熟悉 npm/Docker

---

## 旅程阶段

```
发现 → 安装 → 注册 → 探索 → 首次安装 → 验证 → 进阶使用 → 发布 → 日常使用
```

---

## 阶段 1: 发现产品

### 场景
小明在团队群里看到同事分享了一个 Skill 工具，附带了一行命令：
```bash
akit install @team/web-search
```

### 用户心理
> "这是什么？看起来很方便，比我手动管理包文件简单多了。"

### 行动
1. 点击链接访问项目首页
2. 看到 README 介绍

### 首页展示内容
```markdown
# Agent Kit Admin

📦 一键安装团队的 Skills

## 快速开始

# 1. 安装 CLI
npm install -g @agent-kit-admin/cli

# 2. 登录
akit login --server https://your-company.com

# 3. 安装 Skill
akit install @team/web-search

就是这么简单！
```

### 体验要求
- [ ] 首页加载 < 2 秒
- [ ] 30 秒内理解产品价值
- [ ] 看到明确的"快速开始"指引

---

## 阶段 2: 安装 CLI

### 场景
小明决定试试，在终端执行安装命令。

### 用户旅程

```bash
$ npm install -g @agent-kit-admin/cli

added 1 package in 3s

$ akit --version
akit/0.1.0 darwin-arm64 node-v20.10.0
```

### 体验要求
- [ ] 安装 < 5 秒
- [ ] 安装后立即可用
- [ ] `akit --version` 输出清晰
- [ ] `akit --help` 显示所有命令和简要说明

### akit --help 输出
```
Agent Kit Admin CLI - 管理团队的 Skills

Usage: akit <command>

Commands:
  login     登录到 Registry
  logout    登出
  whoami    显示当前用户
  publish   发布包
  install   安装包
  uninstall 卸载包
  list      列出已安装的包
  search    搜索包
  info      查看包详情
  update    更新包
  init      初始化项目配置

Options:
  --version 显示版本号
  --help    显示帮助信息

Examples:
  akit login --server https://registry.example.com
  akit install @team/web-search
  akit publish ./

Documentation: https://docs.agent-kit.dev
```

---

## 阶段 3: 注册/登录

### 场景
小明需要登录公司的私有 Registry。

### 用户旅程

```bash
$ akit login --server https://registry.company.com

🔗 Opening browser for authentication...
   If browser doesn't open, visit: https://registry.company.com/auth/oauth/wechat-work?callback=http://localhost:9876

[浏览器打开]
[企微扫码登录]
[授权成功]
[页面显示"登录成功，可以关闭此窗口"]

✔ Logged in as xiaoming (xiaoming@company.com)
  Server: https://registry.company.com
  Token expires: 2024-01-16 10:30:00
```

### 体验要求
- [ ] 浏览器自动打开
- [ ] OAuth 流程 < 30 秒
- [ ] 登录成功后 CLI 立即响应
- [ ] 显示用户名和 Token 过期时间
- [ ] Token 自动保存，无需手动复制

### 异常场景

**场景 1: 浏览器未自动打开**
```bash
$ akit login --server https://registry.company.com

🔗 Opening browser for authentication...
   If browser doesn't open, visit: https://registry.company.com/auth/oauth/wechat-work?callback=http://localhost:9876

# 用户手动打开链接，完成授权
```

**场景 2: 登录超时**
```bash
$ akit login --server https://registry.company.com

🔗 Opening browser for authentication...
⏱ Waiting for authorization... (timeout in 120s)

✖ Error: Login timeout
  Please try again: akit login --server https://registry.company.com
```

**场景 3: CI/CD 环境**
```bash
# 通过环境变量
export AKIT_SERVER=https://registry.company.com
export AKIT_TOKEN=your-api-token

# 或通过参数
akit login --server https://registry.company.com --token your-api-token
```

---

## 阶段 4: 探索可用的包

### 场景
小明想看看团队里有哪些可用的 Skill。

### 用户旅程

```bash
# 搜索
$ akit search database

Found 3 packages:

  @team/pg-skill@1.2.0
    PostgreSQL skill for querying databases
    ⭐ 4.8 (12 reviews) · 📦 234 downloads
    Updated: 2024-01-10

  @team/redis-skill@1.0.0
    Redis skill for caching and key-value operations
    ⭐ 4.5 (8 reviews) · 📦 156 downloads
    Updated: 2024-01-08

  @zhangsan/sqlite-skill@0.3.0
    Lightweight SQLite skill
    ⭐ 4.2 (5 reviews) · 📦 89 downloads
    Updated: 2024-01-05

Run 'akit info <package>' for more details
```

```bash
# 查看详情
$ akit info @team/pg-skill

@team/pg-skill

  PostgreSQL skill for querying databases

  Version: 1.2.0
  Type: skill
  License: MIT
  Author: team (Team)
  Published: 2024-01-10
  Downloads: 234
  Rating: ⭐ 4.8 (12 reviews)

  Repository: https://github.com/team/pg-skill

  Skill Configuration:
    Trigger: command
    Command: pg-query
    Content: 根据自然语言执行 SQL 查询并返回结果

  Install:
    akit install @team/pg-skill
```

### 体验要求
- [ ] 搜索结果 < 1 秒返回
- [ ] 结果按相关性排序
- [ ] 显示关键信息（评分、下载量、更新时间）
- [ ] 详情页显示 Skill 触发方式和内容摘要

### Web UI 探索

```
[浏览器访问 https://registry.company.com]

┌─────────────────────────────────────────────────────────┐
│  🔍 Search packages...                          [登录]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Popular Packages                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📦 @team/pg-skill                              │   │
│  │ PostgreSQL skill                               │   │
│  │ ⭐ 4.8 · 📦 234 downloads · Updated 3 days ago│   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📦 @team/web-search                            │   │
│  │ Web search skill                               │   │
│  │ ⭐ 4.6 · 📦 189 downloads · Updated 5 days ago│   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Categories                                             │
│  [All] [Skill] [Database] [Search] [Utility]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 体验要求
- [ ] 首页展示热门包
- [ ] 分类筛选可用
- [ ] 搜索实时响应
- [ ] 点击进入详情页

---

## 阶段 5: 首次安装 Skill

### 场景
小明决定安装 `@team/pg-skill`。

### 用户旅程

```bash
$ akit install @team/pg-skill

⠋ Resolving @team/pg-skill@latest...
  Found: @team/pg-skill@1.2.0

⠋ Downloading @team/pg-skill@1.2.0...
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100% (2.3 MB)

⠋ Extracting package...
  → ~/.akit/packages/@team/pg-skill/

⠋ Recording install...
  → ~/.akit/installed.json

✔ Installed @team/pg-skill@1.2.0 successfully!

  📁 Package: ~/.akit/packages/@team/pg-skill/
  📝 Recorded in: ~/.akit/installed.json
  🔄 重启 Claude Code 后即可使用该 Skill
```

### 体验要求
- [ ] 安装 < 5 秒（10MB 包，100Mbps 网络）
- [ ] 进度条实时更新
- [ ] 自动下载、解压并记录
- [ ] 展示包信息和后续步骤

### 异常场景

**场景 1: 包已安装**
```bash
$ akit install @team/pg-skill

⚠ Package @team/pg-skill already exists
  Current version: 1.1.0
  New version: 1.2.0

? Overwrite? (y/N) y

  Backed up to: ~/.akit/packages/@team/pg-skill.bak

✔ Updated @team/pg-skill to 1.2.0
```

**场景 2: 无可用 Agent**
```bash
$ akit install @team/pg-skill

✔ Package downloaded to: ~/.akit/packages/@team/pg-skill/
  Recorded in ~/.akit/installed.json

  Skill 包已就绪。安装 Claude Code / Codex 等 Agent 后即可使用。
```

**场景 3: 网络中断**
```bash
$ akit install @team/pg-skill

⠋ Downloading @team/pg-skill@1.2.0...
  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░ 35%

⚠ Network error, retrying... (1/3)
⚠ Network error, retrying... (2/3)
⚠ Network error, retrying... (3/3)

✖ Error: Download failed after 3 retries
  Please check your network connection and try again
```

---

## 阶段 6: 验证 Skill 工作

### 场景
小明重启 Claude Code，验证新安装的 Skill 是否正常工作。

### 用户旅程

```bash
# 1. 重启 Claude Code
$ claude

# 2. 使用 Skill
> /pg-query 查询数据库中所有用户

Claude: 我来帮你查询数据库中的所有用户。

查询结果如下：
| id | name | email |
|----|------|-------|
| 1 | 张三 | zhangsan@example.com |
| 2 | 李四 | lisi@example.com |
| 3 | 王五 | wangwu@example.com |

共 3 条记录。
```

### 体验要求
- [ ] 重启后 Skill 自动加载
- [ ] 触发命令调用正常
- [ ] 错误信息清晰可操作

### 异常场景

**场景 1: 数据库连接失败**
```bash
> /pg-query 查询数据库中所有用户

Claude: 我来帮你查询数据库中的所有用户。

Error: Connection refused to localhost:5432

请检查：
1. PostgreSQL 服务是否启动
2. 连接配置是否正确
3. 网络连接是否正常
```

---

## 阶段 7: 进阶使用

### 场景
小明使用一段时间后，想了解更多功能。

### 7.1 查看已安装的包

```bash
$ akit list

Installed packages:

  @team/pg-skill@1.2.0 (latest: 1.3.0) ⚠️ update available
  @team/web-search@1.0.0
  @team/redis-skill@1.0.0
  @team/code-review@1.0.0

Total: 4 packages

Run 'akit update @team/pg-skill' to update
```

### 7.2 更新包

```bash
$ akit update @team/pg-skill

⠋ Checking for updates...
  Current: 1.2.0
  Latest: 1.3.0

? Update to 1.3.0? (Y/n) y

⠋ Downloading @team/pg-skill@1.3.0...
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%

⠋ Updating package files...

✔ Updated @team/pg-skill to 1.3.0

  Changelog:
  - Added connection pooling
  - Fixed timeout issue
  - Improved error messages
```

### 7.3 卸载包

```bash
$ akit uninstall @team/redis-skill

? Remove @team/redis-skill? (y/N) y

⠋ Removing package...
  ✓ Deleted ~/.akit/packages/@team/redis-skill/
  ✓ Removed from ~/.akit/installed.json

✔ Uninstalled @team/redis-skill successfully
```

---

## 阶段 8: 发布自己的 Skill

### 场景
小明开发了一个 Skill 工具，想分享给团队。

### 8.1 初始化项目

```bash
$ cd my-awesome-skill
$ akit init

┌─────────────────────────────────────────────┐
│         Initialize Package Configuration    │
├─────────────────────────────────────────────┤
│                                             │
│  ? Package name: my-awesome-skill           │
│  ? Scope (optional): @xiaoming              │
│  ? Version: 1.0.0                           │
│  ? Description: My awesome Skill tool       │
│  ? License: MIT                             │
│  ? Trigger: command                         │
│  ? Command: my-tool                         │
│  ? Content: 工具描述内容                     │
│                                             │
└─────────────────────────────────────────────┘

✔ Created akit.json

{
  "name": "my-awesome-skill",
  "scope": "@xiaoming",
  "version": "1.0.0",
  "type": "skill",
  "description": "My awesome Skill tool",
  "license": "MIT",
  "skill": {
    "trigger": "command",
    "command": "my-tool",
    "content": "工具描述内容"
  }
}

Next steps:
  1. Edit akit.json if needed
  2. Run 'akit publish' to publish
```

### 8.2 发布

```bash
$ akit publish

⠋ Validating akit.json...
  ✓ Name: @xiaoming/my-awesome-skill
  ✓ Version: 1.0.0
  ✓ Type: skill

⠋ Packaging...
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100% (156 KB)

⠋ Uploading...
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%

⠋ Publishing...

✔ Published @xiaoming/my-awesome-skill@1.0.0 successfully!

  📦 Package: https://registry.company.com/@xiaoming/my-awesome-skill
  📋 Install: akit install @xiaoming/my-awesome-skill

  Share with your team:
  akit install @xiaoming/my-awesome-skill
```

### 8.3 更新版本

```bash
# 修改代码后，更新版本号
$ vim akit.json  # version: "1.0.1"

$ akit publish

⚠ Version 1.0.0 exists, publishing 1.0.1

⠋ Validating...
⠋ Packaging...
⠋ Uploading...

✔ Published @xiaoming/my-awesome-skill@1.0.1 successfully!

  Changelog: (not provided)
  Add changelog: akit publish --changelog "Fixed bug in ..."
```

### 体验要求
- [ ] 初始化交互式引导 < 1 分钟
- [ ] 发布 < 10 秒
- [ ] 版本冲突有明确提示
- [ ] 发布后立即可搜索到

---

## 阶段 9: 日常使用

### 场景
小明已经熟悉了工具，日常开发中频繁使用。

### 9.1 典型工作流

```bash
# 早上开始工作
$ akit list
# 查看已安装的包和可用更新

$ akit update --all
# 更新所有包到最新版本

# 开发新功能
$ akit search authentication
# 搜索相关的 Skill

$ akit install @team/auth-skill
# 安装需要的 Skill

# 开发自己的 Skill
$ cd my-new-skill
$ akit init
$ akit publish

# 分享给同事
# "你可以用 akit install @xiaoming/my-new-skill 安装"
```

### 9.2 团队协作场景

```bash
# 同事在群里说：新发布了一个 Skill
# @xiaoming/web-scraper-skill - 网页抓取工具

$ akit install @xiaoming/web-scraper-skill

# 使用后觉得不错，给个好评
$ akit info @xiaoming/web-scraper-skill
# → 在 Web UI 上评分
```

### 9.3 CI/CD 集成

```yaml
# .github/workflows/publish-skill.yml
name: Publish Skill

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @agent-kit-admin/cli
      - run: akit publish
        env:
          AKIT_SERVER: ${{ secrets.AKIT_SERVER }}
          AKIT_TOKEN: ${{ secrets.AKIT_TOKEN }}
```

---

## 旅程地图总结

```
阶段          关键行动                        耗时      情感
─────────────────────────────────────────────────────────────
发现          看到同事分享命令                 5s       好奇
安装          npm install -g                   3s       轻松
登录          akit login                       30s      顺畅
探索          akit search                      10s      兴奋
首次安装      akit install                     5s       满意
验证          重启 Agent，测试                 2min     开心
进阶          list/update/uninstall            -        熟练
发布          akit init + akit publish         2min     成就感
日常使用      频繁 install/publish             -        习惯
```

---

## 关键体验指标

| 指标 | 目标 | 衡量方式 |
|---|---|---|
| 首次安装时间 | < 3 分钟 | 用户测试 |
| 首次发布时间 | < 2 分钟 | 用户测试 |
| 安装成功率 | > 99% | 错误日志 |
| 发布成功率 | > 99% | 错误日志 |
| 用户留存率 | > 70% (7天) | 使用统计 |
| NPS | > 50 | 用户调研 |

---

## 体验检查清单

### 首次使用
- [ ] 30 秒内理解产品价值
- [ ] 安装 CLI < 5 秒
- [ ] 登录流程 < 30 秒
- [ ] 首次安装 < 3 分钟
- [ ] 安装后立即可用

### 日常使用
- [ ] 命令响应 < 1 秒
- [ ] 错误信息清晰可操作
- [ ] 进度反馈实时
- [ ] 配置写入安全（备份）

### 进阶使用
- [ ] 版本管理清晰
- [ ] 更新提示及时
- [ ] 卸载干净彻底

### 发布流程
- [ ] 初始化引导友好
- [ ] 发布流程简单
- [ ] 版本冲突提示明确
- [ ] 发布后立即可搜索

---

## 旅程中的痛点和解决方案

| 痛点 | 解决方案 |
|---|---|
| 不知道有哪些 Skill 可用 | Web UI 首页推荐 + 搜索 |
| 手动管理包文件太麻烦 | CLI 自动下载解压并记录 |
| 包文件格式记不住 | CLI 自动处理，无需记忆 |
| 不知道 Skill 需要什么配置 | 安装时提示 |
| 团队 Skill 版本不一致 | akit update --all |
| 发布流程复杂 | akit init + akit publish 两步完成 |
| 不知道 Skill 是否工作正常 | 安装后提示验证方法 |
