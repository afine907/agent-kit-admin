# 评论系统、Issue 系统、搜索体验设计

## 概述

本文档补充三个核心体验功能的详细设计：
1. **评论系统** — 让评论成为收集用户反馈的核心渠道
2. **Issue 系统** — 为包提供问题追踪能力，驱动包质量持续提升
3. **搜索体验** — 多维度检索，让用户快速找到需要的包

---

## 一、评论系统增强

### 设计原则

> **评论是核心价值，评分只是辅助。** 一条好的评论比 100 个五星评分更有用。

### 1.1 评论提交规则

| 字段 | 要求 | 说明 |
|---|---|---|
| `rating` | 必填，1-5 星 | 快速评价 |
| `comment` | **必填，最少 10 字** | 核心价值，必须写使用感受 |
| `version` | 推荐填 | 关联到具体版本，方便作者定位问题 |
| `pros` | 可选 | 优点标签（预设 + 自定义） |
| `cons` | 可选 | 缺点标签（预设 + 自定义） |

### 1.2 数据模型更新

```sql
-- reviews 表扩展
ALTER TABLE reviews ADD COLUMN pros JSONB DEFAULT '[]';   -- 优点标签
ALTER TABLE reviews ADD COLUMN cons JSONB DEFAULT '[]';   -- 缺点标签
ALTER TABLE reviews ADD COLUMN helpful_count INT DEFAULT 0; -- "有用"计数

-- 新增：评论"有用"投票表
CREATE TABLE review_votes (
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,  -- true=有用, false=无用
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id)
);

CREATE INDEX idx_review_votes_review ON review_votes(review_id);
```

### 1.3 预设标签

**优点标签（pros）：**
- `易安装` — 安装配置简单
- `文档全` — 文档清晰完整
- `性能好` — 运行速度快
- `功能强` — 功能丰富
- `稳定` — 运行稳定无 bug
- `活跃` — 维护频繁更新及时

**缺点标签（cons）：**
- `难配置` — 配置复杂
- `文档缺` — 文档不完整
- `有 bug` — 存在已知问题
- `性能差` — 运行慢或占用高
- `停更` — 长期未更新
- `依赖多` — 依赖项过多

### 1.4 API 更新

#### 提交评论（增强版）

```
POST /packages/:scope/:name/reviews
```

Request:
```json
{
  "rating": 4,
  "comment": "安装过程很顺利，Claude Code 自动识别了 MCP。但搜索结果有时候返回空，可能是 API 限流的问题。整体来说是一个很有用的工具。",
  "version": "1.2.0",
  "pros": ["易安装", "功能强"],
  "cons": ["有 bug"]
}
```

**校验规则：**
- `rating`: 必填，1-5 整数
- `comment`: 必填，10-2000 字符
- `version`: 可选，必须是该包已发布的版本
- `pros` / `cons`: 可选，数组，每项最多 20 字符

Response:
```json
{
  "id": "uuid",
  "user": {
    "id": "uuid",
    "username": "zhangsan",
    "avatar_url": "https://..."
  },
  "rating": 4,
  "comment": "安装过程很顺利...",
  "version": "1.2.0",
  "pros": ["易安装", "功能强"],
  "cons": ["有 bug"],
  "helpful_count": 0,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### 获取评论列表（增强版）

```
GET /packages/:scope/:name/reviews
```

Query Parameters:

| 参数 | 类型 | 说明 |
|---|---|---|
| page | int | 页码 |
| per_page | int | 每页数量 |
| sort | string | `newest` / `highest` / `lowest` / `most_helpful` |
| rating | int | 按评分筛选（1-5） |

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "user": { "id": "uuid", "username": "zhangsan", "avatar_url": "..." },
      "rating": 4,
      "comment": "安装过程很顺利...",
      "version": "1.2.0",
      "pros": ["易安装", "功能强"],
      "cons": ["有 bug"],
      "helpful_count": 12,
      "user_voted": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "average": 4.5,
    "total": 12,
    "distribution": { "5": 8, "4": 3, "3": 1, "2": 0, "1": 0 },
    "top_pros": ["易安装", "功能强", "文档全"],
    "top_cons": ["有 bug", "性能差"]
  },
  "pagination": { "page": 1, "per_page": 20, "total": 12, "total_pages": 1 }
}
```

#### 标记评论有用

```
POST /packages/:scope/:name/reviews/:review_id/vote
```

Request:
```json
{
  "is_helpful": true
}
```

### 1.5 评论提交 UI 交互流程

```
┌─────────────────────────────────────────────────────────┐
│                    写评论                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  评分 *                                                 │
│  ☆ ☆ ☆ ☆ ☆    点击选择 1-5 星                          │
│                                                         │
│  使用版本                                               │
│  [v1.2.0 ▼]     自动列出已发布版本供选择                 │
│                                                         │
│  使用感受 *                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 请分享你的使用体验，帮助其他人做出选择...         │   │
│  │                                                   │   │
│  │                                                   │   │
│  │                                                   │   │
│  └─────────────────────────────────────────────────┘   │
│  0 / 2000 字  （最少 10 字）                            │
│                                                         │
│  优点（可选，点击选择或自定义）                          │
│  [易安装] [文档全] [性能好] [功能强] [稳定] [活跃]       │
│                                                         │
│  缺点（可选，点击选择或自定义）                          │
│  [难配置] [文档缺] [有 bug] [性能差] [停更] [依赖多]     │
│                                                         │
│                           [取消]  [提交评论]            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.6 CLI 评论

```bash
# 通过 CLI 提交评论
akit review @team/web-search

# 交互式引导
? Rating (1-5): 4
? Comment: 安装过程很顺利，但搜索有时候返回空...
? Version (optional): 1.2.0
? Pros (select): 易安装, 功能强
? Cons (select): 有 bug

✔ Review submitted for @team/web-search

# 查看评论摘要
akit info @team/web-search
# 输出中包含：
#   Rating: ⭐ 4.5 (12 reviews)
#   Top pros: 易安装, 功能强
#   Top cons: 有 bug
#   Latest: "安装过程很顺利..." — zhangsan (⭐4)
```

---

## 二、Issue 系统

### 设计原则

> **Issue 是包质量的驱动器。** 用户遇到问题能反馈，作者能追踪修复，包才会越来越好用。

### 2.1 数据模型

```sql
-- issues 表
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,                          -- Markdown 格式
    status VARCHAR(20) DEFAULT 'open',  -- open / closed / resolved
    labels JSONB DEFAULT '[]',          -- 标签数组
    version VARCHAR(50),                -- 关联的包版本
    upvotes INT DEFAULT 0,              -- 点赞数（表示"我也遇到这个问题"）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES users(id)
);

CREATE INDEX idx_issues_package ON issues(package_id, status, created_at DESC);
CREATE INDEX idx_issues_user ON issues(user_id);

-- issue 评论（讨论）
CREATE TABLE issue_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,                 -- Markdown 格式
    is_author BOOLEAN DEFAULT FALSE,    -- 是否是包作者的回复
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_issue_comments_issue ON issue_comments(issue_id, created_at);

-- issue 点赞（"我也遇到"）
CREATE TABLE issue_upvotes (
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (issue_id, user_id)
);
```

### 2.2 预设标签

| 标签 | 颜色 | 说明 |
|---|---|---|
| `bug` | 🔴 红 | 功能异常 |
| `feature` | 🟢 绿 | 功能请求 |
| `question` | 🔵 蓝 | 使用疑问 |
| `docs` | 🟡 黄 | 文档问题 |
| `performance` | 🟠 橙 | 性能问题 |
| `compatibility` | 🟣 紫 | 兼容性问题 |
| `wontfix` | ⚪ 灰 | 不予修复 |
| `duplicate` | ⚪ 灰 | 重复问题 |

### 2.3 API 设计

#### 列出 Issue

```
GET /packages/:scope/:name/issues
```

Query Parameters:

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| status | string | open | `open` / `closed` / `all` |
| label | string | - | 按标签筛选 |
| sort | string | newest | `newest` / `oldest` / `most_upvoted` / `recently_updated` |
| page | int | 1 | 页码 |
| per_page | int | 20 | 每页数量 |

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "搜索返回空结果",
      "body": "当搜索关键词为中文时，API 返回空数组...",
      "status": "open",
      "labels": ["bug"],
      "version": "1.2.0",
      "upvotes": 5,
      "user": {
        "id": "uuid",
        "username": "lisi"
      },
      "comment_count": 3,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-16T08:00:00Z"
    }
  ],
  "summary": {
    "open_count": 8,
    "closed_count": 15
  },
  "pagination": { "page": 1, "per_page": 20, "total": 23, "total_pages": 2 }
}
```

#### 创建 Issue

```
POST /packages/:scope/:name/issues
```

Request:
```json
{
  "title": "搜索返回空结果",
  "body": "## 环境\n- akit 版本: 1.0.0\n- 包版本: 1.2.0\n\n## 复现步骤\n1. 执行 `akit search 中文关键词`\n2. 返回 0 条结果\n\n## 期望行为\n应该返回匹配的包",
  "labels": ["bug"],
  "version": "1.2.0"
}
```

**校验规则：**
- `title`: 必填，5-200 字符
- `body`: 可选，最多 10000 字符，支持 Markdown
- `labels`: 可选，最多 5 个标签
- `version`: 可选，必须是已发布版本

#### 获取 Issue 详情

```
GET /packages/:scope/:name/issues/:issue_id
```

Response:
```json
{
  "id": "uuid",
  "title": "搜索返回空结果",
  "body": "## 环境\n...",
  "status": "open",
  "labels": ["bug"],
  "version": "1.2.0",
  "upvotes": 5,
  "user_has_upvoted": false,
  "user": { "id": "uuid", "username": "lisi" },
  "comments": [
    {
      "id": "uuid",
      "body": "我也遇到了同样的问题...",
      "is_author": false,
      "user": { "id": "uuid", "username": "wangwu" },
      "created_at": "2024-01-15T12:00:00Z"
    },
    {
      "id": "uuid",
      "body": "感谢反馈，已在 1.2.1 中修复...",
      "is_author": true,
      "user": { "id": "uuid", "username": "zhangsan" },
      "created_at": "2024-01-16T08:00:00Z"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-16T08:00:00Z",
  "closed_at": null,
  "closed_by": null
}
```

#### 添加 Issue 评论

```
POST /packages/:scope/:name/issues/:issue_id/comments
```

Request:
```json
{
  "body": "感谢反馈！已在 v1.2.1 中修复此问题。"
}
```

**注意：** 包作者的评论自动标记 `is_author: true`，方便识别官方回复。

#### 更新 Issue 状态

```
PATCH /packages/:scope/:name/issues/:issue_id
```

Request:
```json
{
  "status": "resolved",
  "comment": "已在 v1.2.1 中修复"
}
```

**权限：** 只有包作者、团队 admin/owner 可以关闭 Issue。Issue 创建者也可以关闭自己的 Issue。

#### Issue 点赞

```
POST /packages/:scope/:name/issues/:issue_id/upvote
```

Response:
```json
{
  "upvotes": 6,
  "user_has_upvoted": true
}
```

### 2.4 CLI 设计

```bash
# 列出 Issue
akit issues @team/web-search

# 输出
Issues for @team/web-search (8 open, 15 closed)

  #12 搜索返回空结果 [bug] ↑5
     opened by lisi · 2 days ago · 3 comments

  #11 支持 streamable-http transport [feature] ↑3
     opened by wangwu · 5 days ago · 1 comment

  #10 安装时报错 ENOENT [bug] ↑2
     opened by zhaoliu · 1 week ago · 0 comments

# 筛选
akit issues @team/web-search --status open --label bug
akit issues @team/web-search --sort most_upvoted

# 创建 Issue
akit issues @team/web-search create

# 交互式引导
? Title: 搜索返回空结果
? Labels: bug
? Version: 1.2.0
? Description:
  (打开编辑器，输入 Markdown)

✔ Issue #12 created

# 查看 Issue 详情
akit issues @team/web-search #12

# 添加评论
akit issues @team/web-search #12 comment

? Comment: 感谢反馈，已在 1.2.1 中修复

✔ Comment added to #12
```

### 2.5 Issue UI 页面

#### Issue 列表页

```
┌─────────────────────────────────────────────────────────┐
│  @team/web-search > Issues                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [New Issue]              筛选: [All] [Open] [Closed]   │
│                           排序: [Newest ▼]              │
│                           标签: [All ▼]                 │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔴 #12 搜索返回空结果                           │   │
│  │    [bug] · lisi · 2 days ago · ↑5 · 💬3         │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 🟢 #11 支持 streamable-http transport           │   │
│  │    [feature] · wangwu · 5 days ago · ↑3 · 💬1   │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 🔴 #10 安装时报错 ENOENT                        │   │
│  │    [bug] · zhaoliu · 1 week ago · ↑2 · 💬0      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ← 1 2 3 →                                             │
└─────────────────────────────────────────────────────────┘
```

#### Issue 详情页

```
┌─────────────────────────────────────────────────────────┐
│  #12 搜索返回空结果                        [Open] [bug] │
│  lisi opened 2 days ago · v1.2.0 · ↑5                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ## 环境                                                │
│  - akit 版本: 1.0.0                                     │
│  - 包版本: 1.2.0                                        │
│                                                         │
│  ## 复现步骤                                            │
│  1. 执行 `akit search 中文关键词`                       │
│  2. 返回 0 条结果                                       │
│                                                         │
│  ## 期望行为                                            │
│  应该返回匹配的包                                       │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  💬 wangwu · 1 day ago                                 │
│  我也遇到了同样的问题，英文关键词正常，中文不行。        │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ✅ zhangsan (author) · 8 hours ago                     │
│  感谢反馈！已在 v1.2.1 中修复，中文搜索改用 PostgreSQL  │
│  全文检索。请更新后验证。                                │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  [Add a comment...]                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                   │   │
│  └─────────────────────────────────────────────────┘   │
│  [Comment]  [Close Issue]                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.6 Issue 与评论的关系

| 维度 | 评论 (Review) | Issue |
|---|---|---|
| **目的** | 综合评价，帮助他人选择 | 具体问题追踪，驱动改进 |
| **内容** | 使用感受、优缺点 | bug 报告、功能请求、使用疑问 |
| **交互** | 一次性，可修改 | 持续讨论，有状态流转 |
| **权限** | 仅作者可改 | 包作者可关闭、标记 |
| **数量** | 每用户每包 1 条 | 不限 |
| **排序** | 按时间/有用度 | 按状态/时间/点赞数 |

---

## 三、搜索体验

### 设计原则

> **3 秒内找到想要的包。** 搜索不是模糊匹配，是多维度的精准发现。

### 3.1 搜索字段

| 字段 | 搜索方式 | 权重 | 说明 |
|---|---|---|---|
| `full_name` | 前缀匹配 + 全文 | ⭐⭐⭐⭐⭐ | 包名最重要 |
| `description` | 全文检索 | ⭐⭐⭐⭐ | 描述是主要搜索目标 |
| `tags` | 精确匹配 | ⭐⭐⭐⭐ | 标签筛选 |
| `keywords` | 全文检索 | ⭐⭐⭐ | manifest 中的 keywords |
| `type` | 精确匹配 | ⭐⭐⭐ | mcp / skill |
| `scope` | 精确匹配 | ⭐⭐⭐ | @team / @username |
| `owner` | 模糊匹配 | ⭐⭐ | 作者名 |
| `mcp.tools.name` | 全文检索 | ⭐⭐⭐ | MCP 工具名 |
| `mcp.tools.description` | 全文检索 | ⭐⭐ | MCP 工具描述 |
| `mcp.capabilities` | 精确匹配 | ⭐⭐ | tools / resources / prompts |

### 3.2 搜索 API

#### 包搜索（增强版）

```
GET /packages
```

Query Parameters:

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| q | string | - | 全文搜索关键词 |
| type | string | - | `mcp` / `skill` |
| scope | string | - | 按 scope 筛选 |
| tag | string | - | 按标签筛选 |
| tags | string | - | 多标签筛选（逗号分隔，AND 逻辑） |
| capability | string | - | MCP 能力：`tools` / `resources` / `prompts` |
| transport | string | - | MCP 传输协议：`stdio` / `sse` / `streamable-http` |
| has_env | boolean | - | 是否需要环境变量 |
| min_rating | float | - | 最低评分（1.0-5.0） |
| min_downloads | int | - | 最低下载量 |
| license | string | - | 开源协议筛选 |
| author | string | - | 按作者名筛选 |
| sort | string | relevance | `relevance` / `downloads` / `rating` / `updated` / `newest` / `issues` |
| order | string | desc | `asc` / `desc` |
| page | int | 1 | 页码 |
| per_page | int | 20 | 每页数量（最大 100） |

**搜索逻辑：**

```
用户输入 q="database"
    │
    ▼
┌─────────────────────────────────────────────────┐
│ 1. 全文检索 (PostgreSQL tsvector)               │
│    - full_name          权重 A                  │
│    - description        权重 B                  │
│    - tags               权重 C                  │
│    - manifest.keywords  权重 D                  │
│    - mcp.tools.name     权重 E                  │
│    - mcp.tools.desc     权重 F                  │
│                                                  │
│ 2. 应用筛选条件                                  │
│    - type=mcp → 仅 MCP 包                       │
│    - tag=database → tags 包含 "database"        │
│    - capability=tools → mcp.capabilities 含     │
│                                                  │
│ 3. 排序                                          │
│    - relevance: ts_rank + 下载量 + 评分加权      │
│    - downloads: 按下载量降序                     │
│    - rating: 按评分降序                          │
│    - updated: 按更新时间降序                     │
│                                                  │
│ 4. 返回结果 + facets（聚合统计）                 │
└─────────────────────────────────────────────────┘
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "pg-mcp",
      "scope": "@team",
      "full_name": "@team/pg-mcp",
      "type": "mcp",
      "description": "PostgreSQL MCP tool for querying databases",
      "license": "MIT",
      "tags": ["database", "sql", "postgresql"],
      "downloads_count": 1234,
      "rating_avg": 4.8,
      "rating_count": 12,
      "latest_version": "1.2.0",
      "updated_at": "2024-01-15T10:30:00Z",
      "highlight": {
        "description": "PostgreSQL MCP tool for querying <em>databases</em>"
      }
    }
  ],
  "facets": {
    "type": [
      { "value": "mcp", "count": 15 },
      { "value": "skill", "count": 3 }
    ],
    "tags": [
      { "value": "database", "count": 8 },
      { "value": "sql", "count": 5 },
      { "value": "postgresql", "count": 3 }
    ],
    "capabilities": [
      { "value": "tools", "count": 12 },
      { "value": "resources", "count": 4 }
    ],
    "transport": [
      { "value": "stdio", "count": 14 },
      { "value": "sse", "count": 1 }
    ]
  },
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 18,
    "total_pages": 1
  }
}
```

#### 搜索建议（自动补全）

```
GET /packages/suggest
```

Query Parameters:

| 参数 | 类型 | 说明 |
|---|---|---|
| q | string | 前缀关键词 |
| limit | int | 返回数量（默认 5，最大 10） |

Response:
```json
{
  "suggestions": [
    { "type": "package", "text": "@team/pg-mcp", "description": "PostgreSQL MCP tool" },
    { "type": "package", "text": "@team/redis-mcp", "description": "Redis MCP tool" },
    { "type": "tag", "text": "database", "count": 8 },
    { "type": "tag", "text": "datadog", "count": 2 }
  ]
}
```

#### 热门搜索

```
GET /packages/trending
```

Query Parameters:

| 参数 | 类型 | 说明 |
|---|---|---|
| period | string | `day` / `week` / `month`（默认 week） |
| type | string | `mcp` / `skill` |
| limit | int | 返回数量（默认 10） |

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "full_name": "@team/pg-mcp",
      "type": "mcp",
      "description": "PostgreSQL MCP tool",
      "downloads_count": 1234,
      "trending_downloads": 156,
      "rating_avg": 4.8
    }
  ]
}
```

### 3.3 数据库搜索支持

#### PostgreSQL 全文检索配置

```sql
-- 包搜索向量（合并多个字段）
ALTER TABLE packages ADD COLUMN search_vector tsvector;

-- 创建 GIN 索引
CREATE INDEX idx_packages_search ON packages USING GIN (search_vector);

-- 触发器：自动更新搜索向量
CREATE OR REPLACE FUNCTION update_package_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.scope, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.tags::text, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_packages_search_vector
BEFORE INSERT OR UPDATE ON packages
FOR EACH ROW EXECUTE FUNCTION update_package_search_vector();

-- 对于 manifest 中的 keywords 和 tools，需要在版本发布时更新
-- 通过 application 层在发布版本时重新计算 search_vector
```

#### 搜索查询示例

```sql
-- 全文搜索 + 筛选 + 排序
SELECT
    p.*,
    ts_rank(p.search_vector, query) AS rank,
    ts_headline('simple', COALESCE(p.description, ''), query,
        'StartSel=<em>, StopSel=</em>, MaxWords=50') AS highlight
FROM
    packages p,
    plainto_tsquery('simple', 'database') query
WHERE
    p.search_vector @@ query
    AND p.deleted_at IS NULL
    AND p.visibility = 'public'
    AND p.type = 'mcp'
ORDER BY
    rank DESC,
    p.downloads_count DESC
LIMIT 20 OFFSET 0;

-- 标签筛选
SELECT * FROM packages
WHERE tags ?| ARRAY['database', 'sql']
AND deleted_at IS NULL
ORDER BY downloads_count DESC;

-- 搜索建议（前缀匹配）
SELECT DISTINCT name, scope, description
FROM packages
WHERE name ILIKE 'data%' OR scope ILIKE 'data%'
AND deleted_at IS NULL
ORDER BY downloads_count DESC
LIMIT 5;
```

### 3.4 前端搜索 UI

#### 首页搜索栏

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  🔍 Search MCP and Skills...                    [搜索]  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ @team/pg-mcp              PostgreSQL MCP tool    │   │
│  │ @team/redis-mcp           Redis MCP tool         │   │
│  │ #database                 8 packages             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  热门: [database] [search] [git] [docker] [api]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 搜索结果页

```
┌─────────────────────────────────────────────────────────┐
│  🔍 database                                    [搜索]  │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  筛选        │  找到 18 个结果                          │
│              │                                          │
│  类型        │  排序: [相关度 ▼]                        │
│  ☑ MCP (15) │                                          │
│  ☐ Skill (3)│  ┌─────────────────────────────────────┐ │
│              │  │ 📦 @team/pg-mcp                    │ │
│  标签        │  │ PostgreSQL MCP tool for querying... │ │
│  ☑ database │  │ ⭐ 4.8 · 📦 1.2k downloads         │ │
│  ☐ sql (5)  │  │ [database] [sql] [postgresql]       │ │
│  ☐ postgres │  │ Updated 3 days ago                  │ │
│              │  └─────────────────────────────────────┘ │
│  能力        │  ┌─────────────────────────────────────┐ │
│  ☑ tools    │  │ 📦 @team/redis-mcp                  │ │
│  ☐ resources│  │ Redis MCP tool for caching...       │ │
│              │  │ ⭐ 4.5 · 📦 856 downloads          │ │
│  评分        │  │ [database] [redis] [cache]          │ │
│  ⭐ 4+ [──] │  │ Updated 5 days ago                  │ │
│              │  └─────────────────────────────────────┘ │
│  协议        │                                          │
│  ☑ MIT (12) │  ← 1 2 →                                │
│  ☐ Apache(3)│                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

#### CLI 搜索增强

```bash
# 基础搜索
akit search "database"

# 多条件筛选
akit search "database" --type mcp --tag sql --min-rating 4

# 按能力筛选
akit search "api" --capability tools --transport stdio

# 按作者筛选
akit search --author @team

# 排序
akit search "database" --sort downloads
akit search "database" --sort rating
akit search "database" --sort newest

# 输出
Found 18 packages:

  @team/pg-mcp@1.2.0
    PostgreSQL MCP tool for querying databases
    ⭐ 4.8 (12 reviews) · 📦 1.2k downloads
    [database] [sql] [postgresql]
    Tools: query, list_tables, describe_table

  @team/redis-mcp@1.0.0
    Redis MCP tool for caching and key-value operations
    ⭐ 4.5 (8 reviews) · 📦 856 downloads
    [database] [redis] [cache]
    Tools: get, set, delete, keys

Refine your search:
  akit search "database" --type mcp --tag sql
```

### 3.5 搜索性能优化

| 策略 | 说明 | 优先级 |
|---|---|---|
| tsvector + GIN 索引 | PostgreSQL 原生全文检索，亚秒级响应 | P0 |
| search_vector 触发器 | 写入时自动更新，查询零成本 | P0 |
| facets 缓存 | 筛选项聚合结果缓存 5 分钟 | P1 |
| 搜索建议缓存 | 热门前缀缓存 1 分钟 | P1 |
| ES 外置搜索引擎 | 包量超 10 万时考虑迁移到 Elasticsearch | P3 |

---

## 四、实施优先级

| 功能 | 优先级 | 阶段 | 工作量 |
|---|---|---|---|
| 评论必填 + 标签 | P0 | Phase 1 | 2 天 |
| Issue CRUD | P1 | Phase 2 | 3 天 |
| Issue CLI | P1 | Phase 2 | 1 天 |
| 搜索全文检索 | P0 | Phase 1 | 2 天 |
| 搜索多字段筛选 | P0 | Phase 1 | 1 天 |
| 搜索建议 | P1 | Phase 2 | 1 天 |
| 热门搜索 | P2 | Phase 2 | 0.5 天 |
| facets 聚合 | P1 | Phase 2 | 1 天 |
