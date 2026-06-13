# Phase 3: 团队协作 SPEC

## 目标

支持团队使用，私有化部署场景。

## 时间

Week 7-9 (3 周)

## 前置条件

- Phase 2 完成
- 评分系统可用
- CI/CD Token 认证可用

## 用户故事

| ID | 故事 | 验收标准 |
|---|---|---|
| US-008 | 作为开发者，我想更新包 | `akit update` 更新到最新版本 |
| US-019 | 作为用户，我想创建团队 | 团队创建成功 |
| US-020 | 作为管理员，我想管理团队成员 | 邀请/移除成员 |

---

## 模块 1: 团队管理

### 1.1 团队 CRUD

| 端点 | 方法 | 说明 | 认证 |
|---|---|---|---|
| `/api/v1/teams` | POST | 创建团队 | ✅ |
| `/api/v1/teams` | GET | 我的团队 | ✅ |
| `/api/v1/teams/:slug` | GET | 团队详情 | ✅ |
| `/api/v1/teams/:slug` | PATCH | 编辑团队 | ✅ (owner) |
| `/api/v1/teams/:slug` | DELETE | 删除团队 | ✅ (owner) |

**创建团队:**
```json
{
  "name": "My Team",
  "slug": "my-team",
  "description": "Team description"
}
```

**团队约束:**
- slug 格式: lowercase + hyphens
- slug 唯一 (不能与用户名冲突)
- 最大成员数: 50

### 1.2 成员管理

| 端点 | 方法 | 说明 | 认证 |
|---|---|---|---|
| `/api/v1/teams/:slug/members` | GET | 成员列表 | ✅ (member) |
| `/api/v1/teams/:slug/members` | POST | 邀请成员 | ✅ (admin) |
| `/api/v1/teams/:slug/members/:username` | PATCH | 修改角色 | ✅ (owner) |
| `/api/v1/teams/:slug/members/:username` | DELETE | 移除成员 | ✅ (admin) |

**角色权限:**

| 角色 | 包管理 | 成员管理 | 团队设置 |
|---|---|---|---|
| owner | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ❌ |
| member | ❌ | ❌ | ❌ |

**邀请流程:**
1. 管理员输入用户名
2. 系统验证用户存在
3. 用户加入团队 (默认 member 角色)

### 1.3 CLI 团队命令

```bash
# 创建团队
akit team create

# 列出团队
akit team list

# 邀请成员
akit team invite @username

# 移除成员
akit team remove @username

# 查看团队
akit team info @team-slug
```

---

## 模块 2: 包可见性

### 2.1 可见性级别

| 级别 | 说明 | 谁能搜索 | 谁能安装 |
|---|---|---|---|
| public | 公开 | 所有人 | 所有人 |
| team | 团队可见 | 团队成员 | 团队成员 |
| private | 私有 | 仅作者 | 仅作者 |

### 2.2 可见性 API

```json
// 创建包时指定
{
  "name": "my-mcp",
  "scope": "@my-team",
  "type": "mcp",
  "visibility": "team"
}

// 更新可见性
PATCH /api/v1/packages/:scope/:name
{
  "visibility": "public"
}
```

### 2.3 查询过滤

- 公开包: 所有人可见
- 团队包: 仅团队成员可见
- 私有包: 仅作者可见
- 搜索结果: 只返回有权限的包

---

## 模块 3: 依赖管理 (基础)

### 3.1 依赖声明

```json
// akit.json
{
  "name": "my-mcp",
  "version": "1.0.0",
  "type": "mcp",
  "dependencies": {
    "@team/util-mcp": "^1.0.0",
    "another-mcp": "~2.0.0"
  }
}
```

### 3.2 依赖检查

**安装时检查:**
1. 解析 `dependencies`
2. 检查每个依赖是否存在
3. 检查版本是否满足约束
4. 如果缺失，报错提示

**不做:**
- ❌ 不做自动安装依赖
- ❌ 不做依赖树解析
- ❌ 不做循环依赖检测

---

## 模块 4: Web UI 团队页面

### 4.1 页面清单

| 页面 | 路由 | 说明 |
|---|---|---|
| 团队列表 | `/teams` | 我的团队 |
| 团队详情 | `/teams/:slug` | 团队信息、成员列表 |
| 团队设置 | `/teams/:slug/settings` | 编辑团队信息 |
| 成员管理 | `/teams/:slug/members` | 邀请/移除成员 |

### 4.2 组件

```
web/src/components/team/
├── TeamCard.tsx           # 团队卡片
├── MemberList.tsx         # 成员列表
├── InviteModal.tsx        # 邀请弹窗
└── RoleSelector.tsx       # 角色选择器
```

---

## 数据库变更

### 新增表

| 表 | 说明 |
|---|---|
| `teams` | 团队表 |
| `team_members` | 团队成员表 |

### 变更表

| 表 | 字段 | 类型 | 说明 |
|---|---|---|---|
| `packages` | `visibility` | VARCHAR | 可见性 (public/team/private) |
| `packages` | `dependencies` | JSONB | 依赖声明 |

---

## 验收标准

### 功能验收

| 场景 | 验收标准 |
|---|---|
| 创建团队 | 团队创建成功，slug 唯一 |
| 邀请成员 | 成员加入团队，默认 member |
| 修改角色 | 角色变更生效 |
| 团队包可见性 | 非成员不可见 |
| 依赖声明 | 格式正确，检查可用 |

### 性能验收

| 指标 | 目标 |
|---|---|
| 团队列表查询 | < 100ms |
| 成员管理操作 | < 200ms |
| 可见性过滤 | 不影响搜索性能 |

---

## 周计划

### Week 7: 团队 CRUD

- [ ] 团队创建/编辑/删除
- [ ] 成员邀请/移除
- [ ] 角色管理
- [ ] CLI 团队命令

### Week 8: 包可见性

- [ ] 可见性字段
- [ ] 查询过滤
- [ ] 搜索过滤
- [ ] CLI 可见性参数

### Week 9: 依赖管理 + Web UI

- [ ] 依赖声明
- [ ] 依赖检查
- [ ] 团队页面
- [ ] 成员管理页面
