---
name: akit-agent
description: Agent Kit Admin - 主动管理团队工具包（Agent 代操作 Skill）
trigger: auto
---

# akit-agent - Agent 代操作 Skill

> **定位：** Agent 做感知 + 通知 + 建议，成员做决策 + 确认。
> 与 `akit.md`（触发式）不同，本 Skill 是**主动式**，持续监控团队工具包状态。

## 何时使用此 Skill

当用户开启主动模式后，Agent 持续监控团队工具包状态，在以下时机主动通知：

1. **登录时**：检查是否有团队包更新
2. **用户问「团队有什么新工具」**：展示最近新增的包
3. **用户需要 xxx 相关工具**：推荐团队已有工具
4. **用户问「大家都在用什么」**：展示团队工具统计
5. **用户说「帮我装 xxx」**：执行安装并确认
6. **用户说「发布这个 MCP」**：辅助发布确认

---

## 前置条件

### 1. 检查 akit 是否安装

```bash
which akit
```

如果命令不存在，提示用户安装：
```
akit CLI 未安装。请先运行：
npm install -g @agent-kit-admin/cli
```

### 2. 检查登录状态

```bash
akit whoami
```

如果未登录，提示用户：
```
未登录到 Registry。请先运行：
akit login --server <server-url>
```

---

## 能力 1：检查团队包更新

### 触发条件
- 用户说「开启团队工具监控」→ 开启后，每次登录时检查
- 用户说「检查更新」

### 执行逻辑

```bash
# 检查指定团队包更新
akit list --team @frontend --json
```

### 输出示例

```
📦 团队 @frontend 有 1 个工具包可以更新：

🔔 db-toolkit: v1.5.0 → v1.6.0
   数据库查询性能优化，修复了连接池问题

输入「更新 db-toolkit」我来帮你更新。
```

### 成员确认后执行

```
用户: 更新 db-toolkit
Agent: ⚡ 正在更新 db-toolkit...

✅ 更新成功！
   v1.5.0 → v1.6.0
   配置已更新: ~/.claude/mcp.json

⚠️  需要重启 Claude Code：/restart
```

---

## 能力 2：发现团队新工具

### 触发条件
- 用户登录时（主动模式开启后）
- 用户说「团队有什么新工具」

### 执行逻辑

```bash
# 列出团队最近发布的包
akit list --team @frontend --json
# 然后筛选出最近 7 天内发布的
```

### 输出示例

```
🆕 团队 @frontend 最近新增的工具包：

📦 @frontend/llm-summary  v0.1.0  (今天)
   长文本摘要工具，支持 10 万字
   安装次数：3

📦 @frontend/img-gen  v0.2.0  (3天前)
   图片生成工具，支持 Stable Diffusion API
   安装次数：7

要安装哪个？
```

---

## 能力 3：工具推荐

### 触发条件
- 用户说「我需要 xxx 相关的工具」「有没有 xxx」
- 用户问「做 xxx 用什么工具好」

### 执行逻辑

```bash
akit search <keyword> --scope @team
```

### 输出示例

```
🔍 搜索「客服」相关工具...

在 @frontend 找到了：

💬 客服话术生成  v0.5.0
   根据问题生成回复话术
   安装 15 次  ⭐ 4.8

💬 投诉处理助手  v0.3.0
   辅助处理投诉流程
   安装 8 次

是否安装？输入「安装 客服话术生成」
```

---

## 能力 4：团队工具统计

### 触发条件
- 用户问「大家都在用什么」「团队工具使用情况」

### 执行逻辑

```bash
# 团队包列表
akit list --team @frontend --json
```

### 输出示例

```
📊 团队 @frontend 工具包统计：

安装排行：
1. @frontend/web-search  (23次安装)
2. @frontend/db-toolkit  (18次安装)
3. @frontend/auth-skill  (12次安装)

最近更新：
- @frontend/img-gen  v0.2.0 (3天前)
- @frontend/llm-summary  v0.1.0 (今天)

你的安装情况：
- 已安装 4 个
- 有 1 个可以更新
```

---

## 能力 5：安装确认

### 触发条件
- 用户说「帮我装 xxx」「安装 xxx」

### 执行逻辑

1. 执行 `akit install @team/xxx`
2. 成功后展示结果和后续步骤

### 输出示例

```
✅ 安装成功！

📦 @frontend/web-search-mcp  v1.2.0
   配置已写入: ~/.claude/mcp.json

⚠️  需要重启 Claude Code 才能生效：
   /restart

重启后即可使用网页搜索功能。
```

---

## 能力 6：发布辅助

### 触发条件
- 用户在项目目录说「发布这个 MCP」「发布当前工具包」

### 执行逻辑

1. 检测当前目录是否有 `akit.json`
2. 检查是否已登录
3. 显示发布预览，确认后执行

### 输出示例

```
检测到工具包项目：

📦 @frontend/my-tool  v0.1.0
   类型: MCP
   描述: 我的工具

确认发布到团队 @frontend？
输入「确认」或「取消」
```

用户确认后：
```
用户: 确认
Agent: ⚡ 正在发布 @frontend/my-tool...

✅ 发布成功！
   版本 v0.1.0 已同步到团队 @frontend
   安装命令: akit install @frontend/my-tool
```

---

## 主动模式开关

### 开启方式

```
用户: 开启团队工具监控
Agent: ✅ 已开启！请告诉我你的团队 slug：

用户: @frontend
Agent: ✅ 已绑定团队 @frontend！
   你可以在任何时候问我：
   - 「团队有什么新工具」
   - 「帮我更新所有包」
   - 「搜索 xxx 相关的工具」
```

### 关闭方式

```
用户: 关闭团队工具监控
Agent: ✅ 已关闭主动监控。
   你仍然可以用以下命令：
   - akit install @team/pkg
   - akit list --team @slug
```

---

## 命令扩展（供 Agent 调用）

这些是 CLI 命令扩展，支持 Agent 的主动能力：

```bash
# 检查更新的包（Agent 主动通知用）
akit list --team @slug --json

# 最近发布的包（Agent 发现新工具用）
akit list --team @frontend --json
# Agent 端筛选 --recent days:7

# 团队统计
akit list --team @slug --json
# Agent 端计算安装次数排行
```

---

## 错误处理

### 团队不存在

```
❌ 团队 @xxx 不存在，请检查名字是否正确。
```

### 安装失败

```
❌ 安装失败：没有权限安装此工具包。
请联系团队管理员。
```

### 未登录

```
❌ 未登录到 Registry。
请先运行：akit login --server <server-url>
```

---

## 与 akit Skill 的关系

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code                              │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │   akit Skill     │    │  akit-agent Skill │              │
│  │  (触发式)        │    │   (主动式)        │              │
│  │                  │    │                  │              │
│  │ 用户说 → 我做    │    │ 我盯着 → 通知你  │              │
│  └──────────────────┘    └──────────────────┘              │
│           │                        │                        │
│           └──────────┬─────────────┘                        │
│                      ▼                                      │
│             ┌────────────────┐                              │
│             │   akit CLI     │                              │
│             └────────┬───────┘                              │
│                      ▼                                      │
│             ┌────────────────┐                              │
│             │  Registry API  │                              │
│             └────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

两个 Skill 共用同一个 CLI 底层，只是交互模式不同：
- **akit**：用户触发 → Agent 执行
- **akit-agent**：Agent 主动监控 → 通知用户 → 用户确认 → Agent 执行
