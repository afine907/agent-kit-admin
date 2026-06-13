# Phase 2: 完善体验 SPEC

## 目标

补齐核心体验，可对外小范围测试。

## 时间

Week 4-6 (3 周)

## 前置条件

- Phase 1 MVP 完成
- 核心流程 (发布 → 安装 → 使用) 稳定

## 用户故事

| ID | 故事 | 验收标准 |
|---|---|---|
| US-006 | 作为开发者，我想查看已安装列表 (增强) | 显示版本、更新状态 |
| US-009 | 作为用户，我想搜索包 (增强) | 支持筛选、排序 |
| US-010 | 作为用户，我想查看包详情 (增强) | 显示评分、统计 |
| US-014 | 作为开发者，我想管理我的包 | 编辑描述、删除版本 |
| US-015 | 作为用户，我想评分和评论 | 1-5 星评分 + 文字评论 |
| US-016 | 作为用户，我想查看评分 | 显示平均评分和评论列表 |
| US-018 | 作为开发者，我想用 Token 认证 | CI/CD 可用 |

---

## 模块 1: CLI 增强

### 1.1 `akit update`

```
交互流程:
1. 读取已安装包列表
2. 检查每个包的最新版本
3. 显示可更新列表
4. 下载新版本
5. 更新 Agent 配置

参数:
  --all              更新所有包
  --agent <name>     指定 Agent
  --tag <tag>        版本标签

输出:
✔ Updated @scope/name 1.0.0 → 1.1.0
  Agent: Claude Code
```

**Agent 配置更新规则:**

| 场景 | 行为 |
|---|---|
| 命令变化 | 更新 command 和 args |
| 新增 env | 合并新变量 |
| 删除 env | 保留旧变量 (安全) |
| 配置冲突 | 备份后覆盖 |

### 1.2 `akit init`

```
交互流程:
1. 询问包名 (lowercase + hyphens)
2. 询问类型 (mcp/skill)
3. 询问描述
4. 生成 akit.json

输出:
✔ Created akit.json
```

### 1.3 Token 认证

```bash
# 使用 Token (CI/CD)
akit publish --token <api-key>

# 环境变量
export AKIT_TOKEN=<api-key>
akit publish
```

### 1.4 `--agent` 参数

```bash
# 安装到指定 Agent
akit install @scope/name --agent codex
akit install @scope/name --agent claude

# 更新指定 Agent
akit update --agent claude
```

---

## 模块 2: API 增强

### 2.1 评分系统

| 端点 | 方法 | 说明 | 认证 |
|---|---|---|---|
| `/api/v1/packages/:scope/:name/reviews` | POST | 提交评分 | ✅ |
| `/api/v1/packages/:scope/:name/reviews` | GET | 评分列表 | ❌ |
| `/api/v1/packages/:scope/:name/stats` | GET | 包统计 | ❌ |

**评分规则:**
- 每个用户每个包只能评分一次
- 评分范围 1-5 星
- 可选文字评论
- 可更新评分

**包统计返回:**
```json
{
  "downloads_total": 1000,
  "downloads_week": 100,
  "rating_avg": 4.5,
  "rating_count": 20
}
```

### 2.2 API Key 认证

| 端点 | 方法 | 说明 | 认证 |
|---|---|---|---|
| `/api/v1/auth/api-keys` | GET | 列出 API Key | ✅ |
| `/api/v1/auth/api-keys` | POST | 生成 API Key | ✅ |
| `/api/v1/auth/api-keys/:id` | DELETE | 删除 API Key | ✅ |

**API Key 格式:**
- 前缀: `akit_`
- 长度: 48 字符
- 存储: bcrypt 哈希

**API Key 认证:**
```
Authorization: Bearer akit_xxxxxxxxxxxx
```

### 2.3 包管理增强

| 端点 | 方法 | 说明 | 认证 |
|---|---|---|---|
| `/api/v1/packages/:scope/:name` | PATCH | 编辑包 | ✅ (owner) |
| `/api/v1/packages/:scope/:name` | DELETE | 删除包 | ✅ (owner) |

---

## 模块 3: Web UI 增强

### 3.1 评分组件

```
评分卡片:
- 星级评分 (1-5)
- 文字评论 (可选)
- 提交按钮
- 评分列表 (分页)
```

### 3.2 包统计

```
统计面板:
- 总下载量
- 本周下载量
- 平均评分
- 评分数量
- 下载趋势图 (最近 30 天)
```

### 3.3 API Key 管理

```
API Key 页面:
- 生成新 Key (显示一次)
- 列出所有 Key (隐藏完整 Key)
- 删除 Key
- 使用说明
```

### 3.4 包编辑

```
编辑页面:
- 编辑描述
- 编辑 README
- 编辑标签
- 保存按钮
```

---

## 模块 4: Agent 支持扩展

### 4.1 Cursor 适配器

```typescript
// cli/src/agents/cursor.ts
export class CursorAdapter implements AgentAdapter {
  name = 'Cursor'

  getConfigPath(): string {
    return path.join(os.homedir(), '.cursor', 'mcp.json')
  }

  // 格式与 Claude Code 相同: { "mcpServers": {...} }
}
```

---

## 模块 5: 搜索增强

### 5.1 搜索参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `search` | 关键词 | - |
| `type` | 类型筛选 | 全部 |
| `sort` | 排序方式 | relevance |
| `order` | 排序方向 | desc |
| `page` | 页码 | 1 |
| `per_page` | 每页数量 | 20 |

**排序选项:**
- `relevance` - 相关度 (默认)
- `downloads` - 下载量
- `rating` - 评分
- `updated` - 更新时间
- `created` - 创建时间

---

## 数据库变更

### 新增表

| 表 | 说明 |
|---|---|
| `reviews` | 评分评论表 |
| `api_keys` | API Key 表 |
| `download_stats` | 下载统计表 (可选) |

### 新增字段

| 表 | 字段 | 类型 | 说明 |
|---|---|---|---|
| `packages` | `rating_avg` | DECIMAL | 平均评分 |
| `packages` | `rating_count` | INTEGER | 评分数量 |
| `packages` | `downloads_total` | INTEGER | 总下载量 |

---

## 验收标准

### 功能验收

| 场景 | 验收标准 |
|---|---|
| 更新包 | `akit update` 更新到最新版本 |
| 评分 | 提交 1-5 星评分，Web UI 可见 |
| API Key | 生成 Key，CI/CD 可用 |
| 包编辑 | 编辑描述，Web UI 更新 |
| 搜索排序 | 按下载量/评分排序 |

### 性能验收

| 指标 | 目标 |
|---|---|
| 搜索响应 | < 200ms |
| 评分提交 | < 500ms |
| API Key 验证 | < 50ms |

---

## 周计划

### Week 4: CLI 增强

- [ ] `akit update` 命令
- [ ] `akit init` 命令
- [ ] Token 认证支持
- [ ] `--agent` 参数

### Week 5: API 增强

- [ ] 评分系统
- [ ] API Key 认证
- [ ] 包管理增强 (编辑/删除)
- [ ] 搜索排序

### Week 6: Web UI 增强

- [ ] 评分组件
- [ ] 包统计面板
- [ ] API Key 管理
- [ ] 包编辑页面
- [ ] Cursor 适配器
