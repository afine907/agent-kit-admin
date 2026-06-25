# 团队技能管理 — 功能设计

## 设计原则

> **轻量优先，手动为主，好用为王**

- 不做自动同步推送，不做版本锁，不做复杂的依赖解析
- 核心：团队包的发布 + 成员感知 + 手动安装更新
- 第一次先把流程跑通，后续再补自动能力

---

## 一、数据模型

### 1.1 包归属

```
Package
  ├── scope: "personal" | "team"     ← 新增：决定包属于谁
  ├── owner_id: UUID                 ← 个人时 = user_id
  ├── owner_type: "user" | "team"   ← 新增：区分权威归属
  ├── team_id: UUID?                ← 新增：团队时必填
  └── latest_version_id: UUID?      ← 指向最新版

Version
  ├── package_id
  ├── version: semver
  ├── published_by: user_id
  └── published_at

InstalledPackage（本地记录）
  ├── user_id
  ├── package_id
  ├── version_installed
  └── updated_at
```

### 1.2 包的可见性

| scope | visibility | 谁能搜索 | 谁能安装 |
|---|---|---|---|
| personal | private | 仅本人 | 仅本人 |
| personal | public | 所有人 | 所有人 |
| team | team | 团队成员 | 团队成员 |
| — | public | 所有人 | 所有人 |

---

## 二、角色定义

### 2.1 平台角色

| 角色 | 说明 |
|---|---|
| 平台管理员 | 运维/老板，可以管理所有团队和包，审核违规内容 |
| 普通用户 | 使用、发布、安装包 |

### 2.2 团队内角色

| 角色 | 发布包 | 更新包 | 管理成员 | 管理团队设置 |
|---|---|---|---|---|
| **owner** | ✅ | ✅ | ✅（增减角色/转让） | ✅ |
| **admin** | ✅ | ✅ | ✅（添加/移除成员） | ❌ |
| **member** | ❌ | ❌ | ❌ | ❌ |

> MVP 阶段：所有团队成员都可以发布和更新团队包，不设权限门槛。owner/admin 的区别暂时只在成员管理上体现。

---

## 三、用户画像

### 3.1 平台管理员

**角色：** CTO / 运维 / 老板

**目标：** 保障平台稳定运行，管理所有团队和包

**操作场景：**
- 查看所有团队和包的列表、统计数据
- 处理违规包（删除/下架）
- 管理平台级别的设置

**关注点：** 稳定性、数据安全、审计日志

---

### 3.2 团队 Owner

**代表：** 技术负责人、Team Lead

**目标：** 建立团队内部的 MCP/Skill 市场，让成员高效复用工具

**操作场景：**
- 创建团队，设置团队名称和 slug
- 在团队主页查看团队包列表和成员
- 发布/更新团队的 MCP 和 Skill
- 添加/移除团队成员

**关注点：** 团队工具链的统一性、管理成本低

---

### 3.3 团队 Member

#### 3.3.1 程序员（后端/前端）

**代表：** 小明、后端开发

**目标：** 找到团队已有的工具，避免重复造轮子；自己开发的工具快速分享给队友

**操作场景：**
- 登录后看到团队包列表，点「安装」直接装上
- 收到通知（邮件/消息）说团队新发了某个包，自己去装
- 开发了新 MCP，执行 `akit publish` 发到团队

**关注点：** 安装快、不踩坑、更新能感知到

---

#### 3.3.2 设计师

**代表：** 小红、UI 设计

**目标：** 偶尔需要用 AI 工具辅助生成文案或图片，不关心技术细节

**操作场景：**
- 团队成员告诉她「我们有个作图 MCP，你装一下」
- 在团队页面点击安装按钮，跟着提示走
- 不太会用命令行，希望 Web UI 能完成大部分操作

**关注点：** 简单、容易上手、不用记命令

---

#### 3.3.3 产品经理

**代表：** 老王、产品

**目标：** 快速了解团队有哪些 AI 工具可用，评估是否适合自己

**操作场景：**
- 登录 Web UI 浏览团队包列表，看描述和评分
- 不安装具体包，只了解团队有什么
- 偶尔参与讨论「我们需要不要做一个客服机器人」

**关注点：** 展示清晰、搜索方便、能看懂包是干啥的

---

#### 3.3.4 客服

**代表：** 小李、客服

**目标：** 用 AI 工具辅助回复客户问题，提高效率

**操作场景：**
- 在团队页面找「客服话术生成」相关的包
- 安装后配置好，直接使用
- 不关心 MCP 技术细节，只管用

**关注点：** 包的名字和描述清晰，安装过程简单

---

#### 3.3.5 运营

**代表：** 阿芳、运营

**目标：** 用 AI 工具做数据分析、生成报表

**操作场景：**
- 找团队有没有数据分析相关的 MCP
- 在 Web UI 浏览，看到包的使用说明截图
- 让程序员帮忙安装和配置

**关注点：** 说明文档清楚、截图/截图演示

---

## 四、功能设计

### 4.1 团队包发布

**前置：** 用户已登录，已有团队

**流程：**

```
1. 用户在 Publish 页面填写包信息
2. 选择发布到「个人」还是「团队」
   └── 如果选团队，出现团队下拉框（用户所属的团队列表）
3. 填写完成后点击发布
4. 系统创建 Package(scope="team", team_id=X)
5. 生成第一个版本 v0.1.0
6. 返回发布成功，展示安装命令
```

**API：**

```
POST /api/v1/teams/{team_id}/packages
Body: { name, type, description, visibility, manifest, tarball }
```

### 4.2 团队包更新

**流程：**

```
1. 用户在团队页面找到自己的包
2. 点击「发布新版本」或直接 `akit publish ./`
3. 系统检测到包已存在 → 创建新 Version
4. 其他成员在团队页面看到「有新版本」标记
```

### 4.3 成员感知版本更新

**展示方式：**

团队包列表页，每个包显示：

```
web-search-mcp    v1.2.0  [你有 v1.1.0 🔔 有更新]  安装
db-toolkit        v2.0.0  [你装了 v2.0.0 ✓]         更新
auth-skill        v0.5.0  [你没装]                    安装
```

**判断逻辑：**
- `InstalledPackage.version_installed < Package.latest_version` → 有更新 🔔
- `InstalledPackage.version_installed == Package.latest_version` → 最新 ✓
- `InstalledPackage` 不存在 → 没装

**感知方式：**
- Web UI：团队页面列表直接展示（有更新标记）
- 通知：第一次不做，等手动流程跑通后再补消息推送

### 4.4 成员安装和升级

**安装：**

```
akit install @team-slug/package-name
```

**升级：**

```
akit update @team-slug/package-name
```

**团队内共享：**

- owner/admin 发布新版本 → 成员自己执行 `akit update`
- 不强制推送，成员按需更新

### 4.5 团队包列表页

**路径：** `/teams/:slug/packages`

**内容：**
- 团队名称 + 成员数量
- 包列表（名称、版本、类型、更新时间）
- 每个包的状态标记（最新/有更新/未安装）
- 「发布包」按钮（所有成员可见，点了就走发布流程）

**筛选：**
- 全部 / MCP / Skill
- 搜索（按包名）

---

## 五、API 设计

### 5.1 团队维度

```
GET  /api/v1/teams/{team_id}/packages          ← 列出团队所有包（含成员安装状态）
POST /api/v1/teams/{team_id}/packages           ← 发布新包到团队（需团队成员身份）
```

### 5.2 包维度

```
GET    /api/v1/teams/{team_id}/packages/{package_id}      ← 包详情
PUT    /api/v1/teams/{team_id}/packages/{package_id}      ← 更新包信息（需 admin+）
DELETE /api/v1/teams/{team_id}/packages/{package_id}      ← 删除包（需 owner）
```

### 5.3 版本维度

```
GET  /api/v1/teams/{team_id}/packages/{package_id}/versions     ← 版本列表
POST /api/v1/teams/{team_id}/packages/{package_id}/versions      ← 发布新版本
```

### 5.4 成员视角

```
GET /api/v1/me/installed?team_id=X          ← 我装了团队的哪些包
```

### 5.5 响应示例

**GET /api/v1/teams/{team_id}/packages**

```json
[
  {
    "id": "pkg-001",
    "name": "web-search-mcp",
    "scope": "team",
    "team_id": "team-001",
    "latest_version": "v1.2.0",
    "type": "mcp",
    "visibility": "team",
    "downloads_count": 42,
    "updated_at": "2026-06-20T10:00:00Z",
    "my_installed_version": "v1.1.0",
    "has_update": true
  }
]
```

---

## 六、CLI 命令

```bash
# 发布包到团队（当前目录有 akit.json）
akit publish ./ --team @team-slug

# 安装团队包
akit install @team-slug/web-search-mcp

# 更新团队包
akit update @team-slug/web-search-mcp

# 列出团队包
akit team packages @team-slug

# 查看团队包详情
akit info @team-slug/web-search-mcp
```

---

## 七、不做的事（保持轻量）

| 特性 | 说明 |
|---|---|
| ~~自动推送更新通知~~ | 改为 Agent 感知 + 通知（需成员授权） |
| ~~版本锁文件~~ | 不做 lock 文件机制 |
| ~~依赖自动安装~~ | 成员手动安装依赖 |
| ~~fork 个人版~~ | 不支持个人 fork 团队包 |
| ~~发布审批流~~ | 所有人可发布 |
| ~~自动更新包~~ | Agent 只建议，成员自己确认 |
| ~~自动发布包~~ | 发布是创造性工作，不应自动执行 |

---

## 七点五、Agent 代操作定位

> **Agent = 数字同事，做「感知 + 通知 + 建议」，成员做「决策 + 确认」**

Agent Skill 分两类：

| 类型 | 定位 | 示例 |
|---|---|---|
| **触发式**（现有 akit Skill） | 用户说话 → Agent 执行 | 「帮我装 @team/web-search」 |
| **主动式**（新 akit-agent Skill） | Agent 盯着 → 主动通知 | 「有新包，要不要装？」 |

详见 [team-agent-skill.md](./team-agent-skill.md)

---

## 八、前端改动点

### 8.1 新增页面/组件

| 页面/组件 | 说明 |
|---|---|
| `/teams/:slug/packages` | 团队包列表（带安装状态标记） |
| `/teams/:slug/packages/:id` | 团队包详情（版本历史） |
| 发布页 → 加上团队选择 | 发布时选「个人」或「团队」 |
| Teams 页面 → 加上「团队包」Tab | 在成员管理旁边 |

### 8.2 状态标记组件

```tsx
// 包列表中每个包右侧的状态
{has_update && <Badge variant="update">v{latest} 🔔 有更新</Badge>}
{!has_update && installed_version && <Badge variant="ok">v{installed} ✓</Badge>}
{!installed_version && <Badge variant="neutral">未安装</Badge>}
```

---

## 九、实施顺序

### Phase A：数据模型（后端）

1. `packages` 表加 `scope`, `owner_type`, `team_id` 字段
2. 包发布 API 支持 `scope=team`
3. 包列表 API 支持按 team_id 筛选

### Phase B：CLI 支持

1. `akit publish --team @slug` 支持发布到团队
2. `akit install @team/pkg` 安装团队包
3. `akit update` 带上 team scope

### Phase C：前端团队包页面

1. 团队包列表页（含版本状态标记）
2. 发布页加上团队选择
3. Teams 页面加上团队包 Tab

### Phase D：成员感知

1. `GET /me/installed?team_id=X` 接口
2. 列表页展示「有更新」标记
3. `akit list` 带上版本对比

---

## 十、验收标准

| 场景 | 标准 |
|---|---|
| 发布包到团队 | owner 能在团队下创建包，slug 为 `@team-slug/pkg-name` |
| 团队包列表 | 成员能看到团队所有包，以及自己的安装状态 |
| 有更新标记 | 安装了旧版本的成员能看到「有更新」标记 |
| 安装团队包 | `akit install @team/pkg` 成功安装到本地 |
| 团队隔离 | 非团队成员搜索/安装该团队的包 → 报错无权限 |
