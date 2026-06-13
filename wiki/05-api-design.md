# API 设计

## Base URL

```
https://your-registry.com/api/v1
```

## 认证

所有需要认证的接口使用 Bearer Token：

```
Authorization: Bearer <jwt_token>
```

## 接口列表

### 认证相关

#### OAuth 登录跳转
```
GET /auth/oauth/:provider
```

| 参数 | 说明 |
|---|---|
| provider | wechat_work / feishu / dingtalk |

Response: 302 重定向到 OAuth 授权页

#### OAuth 回调
```
GET /auth/oauth/:provider/callback
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "username": "zhangsan",
    "display_name": "张三",
    "avatar_url": "https://..."
  }
}
```

#### 获取当前用户
```
GET /auth/me
```

Response:
```json
{
  "id": "uuid",
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "display_name": "张三",
  "teams": [
    {
      "id": "uuid",
      "name": "前端团队",
      "slug": "frontend",
      "role": "admin"
    }
  ]
}
```

---

### 包管理

#### 列出包
```
GET /packages
```

Query Parameters:

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| type | string | - | mcp / skill |
| search | string | - | 搜索关键词 |
| scope | string | - | 按 scope 筛选 |
| tag | string | - | 按标签筛选 |
| sort | string | updated_at | updated_at / downloads / rating |
| order | string | desc | asc / desc |
| page | int | 1 | 页码 |
| per_page | int | 20 | 每页数量（最大 100） |

**可见性过滤逻辑：**
- 未登录用户：仅返回 `public` 包
- 已登录用户：返回 `public` 包 + 所属团队的 `team` 包 + 自己的 `private` 包
- 软删除的包（`deleted_at IS NOT NULL`）不出现在列表中

**搜索实现策略：**

| 阶段 | 方案 | 说明 |
|---|---|---|
| MVP (Phase 1) | `ILIKE` 模糊匹配 | 搜索 `packages.name`、`packages.description` 字段，简单可靠 |
| Phase 2+ | PostgreSQL 全文搜索 | 使用 `tsvector` + `GIN` 索引，支持加权排序和中文分词（详见 [21-review-issue-search.md](21-review-issue-search.md)） |

MVP 阶段的 SQL 示例：
```sql
WHERE (p.name ILIKE '%' || :search || '%'
    OR p.description ILIKE '%' || :search || '%')
AND p.deleted_at IS NULL
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "web-search",
      "scope": "@team",
      "full_name": "@team/web-search",
      "type": "mcp",
      "description": "Web search MCP tool",
      "license": "MIT",
      "downloads_count": 1234,
      "rating_avg": 4.5,
      "rating_count": 12,
      "latest_version": "1.2.0",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

#### 获取包详情
```
GET /packages/:scope/:name
```

Response:
```json
{
  "id": "uuid",
  "name": "web-search",
  "scope": "@team",
  "full_name": "@team/web-search",
  "type": "mcp",
  "description": "Web search MCP tool",
  "license": "MIT",
  "repository": "https://github.com/team/web-search",
  "homepage": "https://team.dev/web-search",
  "visibility": "public",
  "owner": {
    "id": "uuid",
    "name": "前端团队",
    "type": "team"
  },
  "downloads_count": 1234,
  "rating_avg": 4.5,
  "rating_count": 12,
  "latest_version": "1.2.0",
  "versions": [
    {
      "version": "1.2.0",
      "tag": "latest",
      "published_at": "2024-01-15T10:30:00Z",
      "deprecated": false,
      "yanked": false
    },
    {
      "version": "1.1.0",
      "tag": null,
      "published_at": "2024-01-10T08:00:00Z",
      "deprecated": false,
      "yanked": false
    }
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

#### 创建包
```
POST /packages
```

Request:
```json
{
  "name": "web-search",
  "scope": "@team",
  "type": "mcp",
  "description": "Web search MCP tool",
  "license": "MIT",
  "repository": "https://github.com/team/web-search",
  "visibility": "public"
}
```

#### 删除包
```
DELETE /packages/:scope/:name
```

---

### 版本管理

#### 列出版本
```
GET /packages/:scope/:name/versions
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "version": "1.2.0",
      "manifest": { ... },
      "tarball_hash": "sha256:abc123...",
      "tarball_size": 12345,
      "tag": "latest",
      "published_by": {
        "id": "uuid",
        "username": "zhangsan"
      },
      "published_at": "2024-01-15T10:30:00Z",
      "deprecated": false,
      "yanked": false
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 15,
    "total_pages": 1
  }
}
```

#### 获取版本详情
```
GET /packages/:scope/:name/versions/:version
```

#### 发布新版本
```
POST /packages/:scope/:name/versions
```

Request (multipart/form-data):

| 字段 | 类型 | 说明 |
|---|---|---|
| version | string | 版本号 (semver) |
| manifest | string | akit.json 内容 |
| tarball | file | 包文件 |
| tag | string | 版本标签（可选：latest / beta / alpha / rc） |

Response:
```json
{
  "id": "uuid",
  "version": "1.3.0",
  "tarball_url": "https://minio.internal/packages/...",
  "published_at": "2024-01-16T12:00:00Z"
}
```

**版本标签（Tag）分配规则：**

| 规则 | 说明 |
|---|---|
| 首次发布 | 无论是否指定 tag，自动设为 `latest` |
| 指定 pre-release tag | 发布 `--tag beta/alpha/rc` 时，仅设置该 tag，**不改变**现有的 `latest` 指向 |
| 发布正式版本 | 版本号无 pre-release 后缀（如 `1.2.0`）时，自动将 `latest` 指向新版本 |
| `latest` 唯一性 | 每个包同一时间只有一个 `latest` 版本 |
| `akit install`（无版本） | 默认安装 `latest` tag 指向的版本 |
| yanked 版本 | `akit install` 跳过 yanked 版本，提示用户并建议替代版本 |

**Tag 解析优先级（`akit install @scope/name`）：**
1. 查找 `latest` tag 的版本
2. 如果该版本被 yanked，查找最近一个未 yanked 的版本
3. 如果无可用版本，返回错误

#### 下载版本
```
GET /packages/:scope/:name/versions/:version/download
```

**鉴权规则：**
- `public` 包：允许匿名下载（无需 Token）
- `team` 包：需要认证，且用户必须是团队成员
- `private` 包：需要认证，且用户必须是包作者

**认证方式：**
- Header: `Authorization: Bearer <token>`（JWT 或 API Key）
- Query 参数: `?token=<token>`（CLI 场景，用于浏览器直接下载）

Response: **302 重定向**到 MinIO 预签名 URL
- 预签名 URL 有效期：**15 分钟**
- 记录下载统计（user_id 可为 NULL 表示匿名下载）

#### 获取最新版本下载
```
GET /packages/:scope/:name/download
```

Response: 302 重定向（同上）

---

### 评分系统

#### 获取评分列表
```
GET /packages/:scope/:name/reviews
```

Query Parameters:

| 参数 | 类型 | 说明 |
|---|---|---|
| page | int | 页码 |
| per_page | int | 每页数量 |

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "username": "zhangsan",
        "avatar_url": "https://..."
      },
      "rating": 5,
      "comment": "很好用的 MCP 工具",
      "version": "1.2.0",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "average": 4.5,
    "total": 12,
    "distribution": {
      "5": 8,
      "4": 3,
      "3": 1,
      "2": 0,
      "1": 0
    }
  }
}
```

#### 提交评分
```
POST /packages/:scope/:name/reviews
```

Request:
```json
{
  "rating": 5,
  "comment": "很好用的 MCP 工具",
  "version": "1.2.0"
}
```

#### 更新评分
```
PUT /packages/:scope/:name/reviews
```

#### 删除评分
```
DELETE /packages/:scope/:name/reviews
```

---

### 统计

#### 获取包统计
```
GET /packages/:scope/:name/stats
```

Response:
```json
{
  "downloads": {
    "total": 1234,
    "daily": [
      { "date": "2024-01-15", "count": 50 },
      { "date": "2024-01-14", "count": 45 }
    ]
  },
  "rating": {
    "average": 4.5,
    "count": 12
  }
}
```

---

### 团队管理

#### 列出我的团队
```
GET /teams
```

#### 获取团队详情
```
GET /teams/:slug
```

#### 获取团队成员
```
GET /teams/:slug/members
```

#### 邀请成员
```
POST /teams/:slug/members
```

Request:
```json
{
  "user_id": "uuid",
  "role": "member"
}
```

#### 更新成员角色
```
PUT /teams/:slug/members/:user_id
```

#### 移除成员
```
DELETE /teams/:slug/members/:user_id
```

---

### API Key 管理（CI/CD Token）

#### 列出我的 API Key
```
GET /auth/api-keys
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "CI/CD Pipeline",
      "key_prefix": "akit_abc...",
      "permissions": ["read", "write"],
      "last_used_at": "2024-01-15T10:30:00Z",
      "expires_at": "2024-07-15T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### 创建 API Key
```
POST /auth/api-keys
```

Request:
```json
{
  "name": "CI/CD Pipeline",
  "permissions": ["read", "write"],
  "expires_at": "2024-07-15T00:00:00Z"
}
```

Response:
```json
{
  "id": "uuid",
  "name": "CI/CD Pipeline",
  "key": "akit_abcdefgh1234567890",  // 仅此处返回完整 key
  "key_prefix": "akit_abc...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**注意：** 完整 key 仅在创建时返回一次，之后无法再查看。用户需妥善保存。

#### 删除 API Key
```
DELETE /auth/api-keys/:id
```

#### 使用 API Key 认证
API Key 可替代 JWT Token 使用，通过 Header 传递：
```
Authorization: Bearer akit_abcdefgh1234567890
```

---

## 错误响应

所有错误返回统一格式：

```json
{
  "error": {
    "code": 20003,
    "message": "Package @team/web-search not found",
    "details": {}
  }
}
```

### 错误码

| HTTP Status | Code | 说明 |
|---|---|---|
| 200 | 10000 | 成功 |
| 400 | 20000 | 参数错误 / 验证失败 |
| 401 | 20001 | 未认证 / Token 过期 |
| 403 | 20002 | 无权限 |
| 404 | 20003 | 资源不存在 |
| 409 | 20004 | 资源冲突（如包名已存在） |
| 410 | 20005 | 资源已删除 |
| 429 | 20006 | 请求过于频繁 |
| 500 | 30000 | 内部错误 |
| 500 | 30001 | 数据库错误 |
| 503 | 30002 | 存储服务不可用 |
| 507 | 30003 | 存储空间不足 |

## 限流

| 接口 | 限制 |
|---|---|
| 认证相关 | 10 次/分钟 |
| 包列表/详情 | 60 次/分钟 |
| 下载 | 100 次/分钟 |
| 发布 | 10 次/分钟 |
| 评分 | 5 次/分钟 |

限流使用 Redis 或内存存储，返回 `429 Too Many Requests`：

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```
