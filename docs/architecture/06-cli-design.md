# CLI 设计

## 概述

`akit` 是 Agent Kit Admin 的命令行工具，用于管理 Skills 的发布与安装。

安装方式：
```bash
npm install -g @agent-kit-admin/cli
```

## 命令列表

### akit login

登录到 Registry。

```bash
# 交互式登录（打开浏览器）
akit login --server https://your-registry.com

# 使用 Token 登录（CI/CD 场景）
akit login --server https://your-registry.com --token <token>
```

**流程：**
1. 打开浏览器访问 OAuth 授权页
2. 用户在浏览器完成认证
3. 浏览器回调本地临时服务器获取 token
4. Token 保存到 `~/.akit/config.json`

---

### akit logout

登出。

```bash
akit logout
```

---

### akit whoami

显示当前登录用户。

```bash
akit whoami
```

Output:
```
Logged in as zhangsan (zhangsan@example.com)
Server: https://your-registry.com
```

---

### akit publish

发布包到 Registry。

```bash
# 发布当前目录
akit publish

# 发布指定目录
akit publish ./my-skill

# 指定版本（覆盖 manifest 中的版本）
akit publish --version 1.2.3

# 干跑模式（不实际发布）
akit publish --dry-run

# 指定 tag
akit publish --tag beta
```

**流程：**
1. 读取 `akit.json` (manifest)
2. 验证 manifest 格式
3. 检查版本是否已存在
4. 打包为 tarball
5. 计算 hash
6. 上传到 Registry（附带 tag 信息，如 beta/alpha/rc）
7. 输出发布结果

**Manifest 文件 (akit.json):**

```json
{
  "name": "web-search",
  "version": "1.0.0",
  "type": "skill",
  "description": "Web search skill",
  "license": "MIT",
  "repository": "https://github.com/team/web-search",
  "skill": {
    "trigger": "command",
    "command": "web-search",
    "content": "## Web Search\n\n搜索网页并返回结果摘要和链接。",
    "permissions": ["network-access"]
  }
}
```

**Skill Manifest 详解:**

```json
{
  "name": "code-review",
  "version": "1.0.0",
  "type": "skill",
  "description": "Code review skill",
  "license": "MIT",
  "skill": {
    "trigger": "command",
    "command": "review",
    "content": "Review the code changes and provide feedback...",
    "hooks": ["pre-commit"],
    "permissions": ["read-files"]
  }
}
```

---

### akit init

交互式初始化项目配置，生成 `akit.json`。

```bash
# 在当前目录初始化
akit init

# 指定目录
akit init ./my-skill
```

**交互式问题清单：**

```
┌─────────────────────────────────────────────────────┐
│         Initialize Package Configuration            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ? Package name: (my-skill)                         │
│    → 小写字母、数字、连字符，基于目录名自动生成       │
│                                                     │
│  ? Scope (optional, e.g. @team): (@myusername)      │
│    → 可选，留空则发布时自动使用用户名               │
│                                                     │
│  ? Version: (1.0.0)                                 │
│    → 默认 1.0.0，必须是合法 semver                  │
│                                                     │
│  ? Description: My awesome skill                    │
│    → 包描述，最多 500 字符                          │
│                                                     │
│  ? License: (MIT)                                   │
│    → 开源协议，默认 MIT                             │
│                                                     │
│  ? Keywords: (search, web)                          │
│    → 逗号分隔的关键词                               │
│                                                     │
│  ? Trigger: (Use arrow keys)                        │
│    ❯ command (斜杠命令)                             │
│      auto (自动触发)                                │
│                                                     │
│  ? Command name: (web-search)                       │
│    → 斜杠命令名（trigger=command 时显示）           │
│                                                     │
│  ? Skill content file: (skill.md)                   │
│    → Prompt 内容文件路径                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**默认值规则：**

| 问题 | 默认值 | 来源 |
|---|---|---|
| Package name | 当前目录名 | `path.basename(process.cwd())` |
| Scope | `@{当前登录用户名}` | CLI 配置 |
| Version | `1.0.0` | 固定 |
| License | `MIT` | 固定 |
| Trigger | `command` | 固定 |
| Command name | 包名 | 固定 |
| Skill content file | `skill.md` | 固定 |

**生成结果示例：**

```bash
$ akit init

┌─────────────────────────────────────────────┐
│         Initialize Package Configuration    │
├─────────────────────────────────────────────┤
│  ? Package name: my-awesome-skill           │
│  ? Scope: @xiaoming                         │
│  ? Version: 1.0.0                           │
│  ? Description: My awesome skill            │
│  ? License: MIT                             │
│  ? Trigger: command                         │
│  ? Command name: my-skill                   │
│  ? Skill content file: skill.md             │
└─────────────────────────────────────────────┘

✔ Created akit.json

{
  "name": "my-awesome-skill",
  "scope": "@xiaoming",
  "version": "1.0.0",
  "type": "skill",
  "description": "My awesome skill",
  "license": "MIT",
  "skill": {
    "trigger": "command",
    "command": "my-skill",
    "content": "## My Awesome Skill\n\n描述该技能的行为..."
  }
}

Next steps:
  1. Edit akit.json if needed
  2. Run 'akit publish' to publish
```

**异常场景：**

```bash
# akit.json 已存在
$ akit init

⚠ akit.json already exists
? Overwrite? (y/N)

# 目录名不合法（含大写或特殊字符）
$ akit init

? Package name: (My-Skill-Tool) my-skill-tool
  → 自动转为小写和连字符格式
```

---

### akit install

安装包。

```bash
# 安装最新版
akit install @team/web-search

# 安装指定版本
akit install @team/web-search@1.2.0
```

**流程：**
1. 查询包信息和版本
2. 下载 tarball
3. 解压到 `~/.akit/packages/@team/web-search/`
4. 记录到已安装列表 `~/.akit/installed.json`
5. 输出安装结果

**安装目录结构:**

```
~/.akit/
├── config.json              # CLI 配置（server, token）
├── packages/
│   └── @team/
│       └── web-search/
│           ├── akit.json    # manifest
│           ├── index.js
│           ├── lib/
│           └── README.md
└── installed.json           # 已安装包记录
```

---

### akit uninstall

卸载包。

```bash
akit uninstall @team/web-search
```

---

### akit update

更新包到最新版本。

```bash
# 更新单个包
akit update @team/web-search

# 更新指定版本
akit update @team/web-search@1.3.0

# 更新所有已安装的包
akit update --all
```

**更新流程：**
1. 查询远端最新版本（或指定版本）
2. 与本地已安装版本比较
3. 如果已是最新，提示无需更新
4. 下载新版本 tarball
5. 解压覆盖到 `~/.akit/packages/@team/web-search/`
6. 更新 `~/.akit/installed.json` 中的版本记录

**更新规则：**

| 场景 | 处理方式 |
|---|---|
| 仅版本号变化 | 用新版本覆盖本地包文件，更新版本记录 |
| 包已被远端删除 | 提示包已不可用，建议 `akit uninstall` |

**`--all` 模式：**
- 遍历 `~/.akit/installed.json` 中的所有包
- 逐个检查更新并安装
- 跳过已是最新版本的包
- 汇总输出更新结果

---

### akit list

列出已安装的包。

```bash
# 列出所有
akit list

# 按类型筛选
akit list --type skill
```

Output:
```
Installed packages:

  @team/web-search@1.2.0
  @team/database-query@2.0.1
  @team/code-review@1.0.0
  @zhangsan/api-test@0.3.0
```

---

### akit search

搜索 Registry 中的包。

```bash
# 搜索
akit search "database"

# 按类型筛选
akit search "search" --type skill

# 按 scope 筛选
akit search "api" --scope @team
```

Output:
```
Found 5 packages:

  @team/web-search@1.2.0
    Web search skill
    ⭐ 4.5 (12 reviews) · 📦 1.2k downloads

  @team/database-query@2.0.1
    Database query skill
    ⭐ 4.8 (8 reviews) · 📦 856 downloads
```

---

### akit info

查看包详细信息。

```bash
akit info @team/web-search
```

Output:
```
@team/web-search

  Web search skill

  Version: 1.2.0
  Type: skill
  License: MIT
  Published: 2024-01-15
  Downloads: 1,234
  Rating: ⭐ 4.5 (12 reviews)

  Repository: https://github.com/team/web-search
```

---

### akit config

管理 CLI 配置。

```bash
# 查看配置
akit config get

# 设置配置
akit config set server https://your-registry.com

# 查看所有配置
akit config list
```

**配置文件 (~/.akit/config.json):**

```json
{
  "server": "https://your-registry.com",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "defaultAgent": "claude",
  "registry": {
    "timeout": 30000,
    "retries": 3
  }
}
```

---

## 配置文件位置

| 文件 | 位置 | 说明 |
|---|---|---|
| CLI 配置 | `~/.akit/config.json` | server, token 等 |
| 已安装记录 | `~/.akit/installed.json` | 已安装包列表 |
| 包缓存 | `~/.akit/packages/` | 已下载的包 |

---

## 输出格式

### 成功

```
✔ Package @team/web-search@1.2.0 installed successfully
  → ~/.akit/packages/@team/web-search/
  → Recorded in ~/.akit/installed.json
```

### 错误

```
✖ Error: Package not found
  @team/web-search does not exist on this registry
```

### 进度

```
⠋ Installing @team/web-search@1.2.0...
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%
✔ Installed successfully
```

---

## 环境变量

| 变量 | 说明 |
|---|---|
| `AKIT_SERVER` | Registry 地址 |
| `AKIT_TOKEN` | 认证 Token |
| `AKIT_DEFAULT_AGENT` | 默认 Agent |
| `AKIT_NO_COLOR` | 禁用颜色输出 |

---

## 退出码

| 码 | 说明 |
|---|---|
| 0 | 成功 |
| 1 | 一般错误 |
| 2 | 参数错误 |
| 3 | 认证失败 |
| 4 | 网络错误 |
| 5 | 包不存在 |
| 6 | 版本冲突 |
