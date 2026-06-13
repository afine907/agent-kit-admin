# 数据模型

## ER 图

```
┌─────────────┐       ┌─────────────┐
│    User     │       │    Team     │
├─────────────┤       ├─────────────┤
│ id          │◄──┐   │ id          │
│ username    │   │   │ name        │
│ email       │   │   │ external_id │  (企微/飞书/钉钉部门ID)
│ avatar_url  │   │   │ created_at  │
│ oauth_provider│ │   └──────┬──────┘
│ oauth_id    │   │          │
│ created_at  │   │   ┌──────┴──────┐
└─────────────┘   │   │ TeamMember  │
                  │   ├─────────────┤
                  ├───│ team_id     │
                  │   │ user_id     │
                  │   │ role        │  (owner/admin/member)
                  │   └─────────────┘
                  │
┌─────────────────┴───────────────────────┐
│              Package                    │
├─────────────────────────────────────────┤
│ id                                      │
│ name              (包名，不含 scope)    │
│ scope             (如 @team)           │
│ full_name         (如 @team/web-mcp)   │
│ type              (mcp / skill)        │
│ owner_id          (User 或 Team)       │
│ owner_type        (user / team)        │
│ description                             │
│ license                                 │
│ repository        (git 地址)           │
│ homepage                                │
│ visibility        (public/team/private)│
│ downloads_count   (总下载量，由触发器或异步任务维护) │
│ tags              (JSON: 标签数组)    │
│ deleted_at        (软删除，NULL=正常) │
│ created_at                            │
│ updated_at                            │
└─────────────────┬───────────────────────┘
                  │
                  │ 1:N
                  ▼
┌─────────────────────────────────────────┐
│              Version                   │
├─────────────────────────────────────────┤
│ id                                      │
│ package_id                              │
│ version           (semver: 1.2.3)      │
│ manifest          (JSON: akit.json)    │
│ tarball_hash      (SHA256)             │
│ tarball_size      (bytes)              │
│ tarball_path      (MinIO path)         │
│ dependencies      (JSON: {name: ver})  │
│ published_by      (User ID)            │
│ published_at                            │
│ deprecated        (bool)               │
│ yanked            (bool, 已撤回)       │
└─────────────────┬───────────────────────┘
                  │
                  │ 1:N
                  ▼
┌─────────────────────────────────────────┐
│              Review                     │
├─────────────────────────────────────────┤
│ id                                      │
│ package_id                              │
│ version_id        (可选，关联版本)      │
│ user_id                                 │
│ rating            (1-5)                │
│ comment                                 │
│ created_at                            │
│ updated_at                            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│              Download                   │
├─────────────────────────────────────────┤
│ id                                      │
│ package_id                              │
│ version_id                              │
│ user_id                                 │
│ ip_address                            │
│ user_agent                            │
│ downloaded_at                         │
└─────────────────────────────────────────┘
```

## SQL Schema

### users 表

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    oauth_provider VARCHAR(20) NOT NULL,  -- wechat_work / feishu / dingtalk
    oauth_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(oauth_provider, oauth_id)
);

CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
```

### teams 表

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,  -- URL 友好的标识
    description TEXT,
    avatar_url TEXT,
    external_dept_id VARCHAR(100),  -- 企微/飞书/钉钉部门ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### team_members 表

```sql
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',  -- owner / admin / member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members(user_id);
```

### packages 表

```sql
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    scope VARCHAR(50) NOT NULL,  -- @team 或 @username
    full_name VARCHAR(150) GENERATED ALWAYS AS (scope || '/' || name) STORED,
    type VARCHAR(10) NOT NULL,   -- mcp / skill
    owner_id UUID NOT NULL,
    owner_type VARCHAR(10) NOT NULL,  -- user / team
    description TEXT,
    license VARCHAR(50) DEFAULT 'MIT',
    repository TEXT,
    homepage TEXT,
    visibility VARCHAR(10) DEFAULT 'public',  -- public / team / private
    downloads_count BIGINT DEFAULT 0,  -- 由数据库触发器或定时任务从 downloads 表聚合更新
    latest_version VARCHAR(50),
    tags JSONB DEFAULT '[]',  -- 标签数组，如 ["database", "search"]
    deleted_at TIMESTAMP WITH TIME ZONE,  -- 软删除时间，NULL 表示正常
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(scope, name)
);

CREATE INDEX idx_packages_full_name ON packages(full_name);
CREATE INDEX idx_packages_type ON packages(type);
CREATE INDEX idx_packages_owner ON packages(owner_id, owner_type);
CREATE INDEX idx_packages_downloads ON packages(downloads_count DESC);
CREATE INDEX idx_packages_tags ON packages USING GIN (tags);
CREATE INDEX idx_packages_deleted ON packages(deleted_at) WHERE deleted_at IS NULL;

-- Scope 命名空间约束（硬性规则）：
-- 用户 scope = @username（创建用户时自动生成）
-- 团队 scope = @team-slug（创建团队时指定）
-- 两者共享同一命名空间，不允许冲突
-- 示例：用户注册 "frontend" 作为用户名 → scope 为 @frontend
--       之后团队不能再使用 "frontend" 作为 slug
-- 实现：创建团队时必须检查 slug 与所有用户名不冲突，反之亦然
```

### 软删除策略

**级联规则：**

| 操作 | packages | versions | downloads | reviews |
|---|---|---|---|---|
| 删除包 | 软删除（设置 `deleted_at`） | 不删除，保留历史 | 不删除，保留统计 | 不删除，保留评价 |
| 删除版本 | 不影响 | yanked=true 或删除 | 不删除 | 不删除 |

**包名回收规则：**
- 软删除的包名**不可重新注册**（`deleted_at IS NOT NULL` 的记录仍占命名空间）
- 如需彻底删除包名，需管理员执行硬删除（物理删除记录）
- 理由：防止恶意用户删除包后立即抢注同名包进行钓鱼

**CLI 已安装包的处理：**
- 用户已安装的包被删除后，`akit list` 仍显示该包（标记为 `[removed]`）
- `akit update` 检测到远端包已删除时，提示用户并建议卸载
- `akit install` 遇到已删除的包返回 410 Gone（见 [13-edge-cases.md](13-edge-cases.md) EC-08）

**API 查询规则：**
- 所有列表接口默认过滤 `deleted_at IS NULL`
- 管理员接口可通过 `?include_deleted=true` 查看已删除的包
- 包详情接口对已删除的包返回 410 Gone
```

### versions 表

```sql
CREATE TABLE versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    manifest JSONB NOT NULL,  -- akit.json 的完整内容
    tarball_hash VARCHAR(64) NOT NULL,  -- SHA256
    tarball_size BIGINT NOT NULL,
    tarball_path VARCHAR(500) NOT NULL,  -- MinIO 路径
    dependencies JSONB DEFAULT '{}',
    published_by UUID REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deprecated BOOLEAN DEFAULT FALSE,
    yanked BOOLEAN DEFAULT FALSE,
    tag VARCHAR(50),  -- 版本标签，如 latest / beta / alpha / rc

    UNIQUE(package_id, version)
);

CREATE INDEX idx_versions_package ON versions(package_id, version DESC);
```

### reviews 表

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    version_id UUID REFERENCES versions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(package_id, user_id)  -- 每个用户每个包只能评一次
);

CREATE INDEX idx_reviews_package ON reviews(package_id);
CREATE INDEX idx_reviews_rating ON reviews(package_id, rating);
```

### downloads 表

```sql
CREATE TABLE downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    version_id UUID REFERENCES versions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_downloads_package ON downloads(package_id, downloaded_at);
CREATE INDEX idx_downloads_version ON downloads(version_id);

-- 按月分区（可选，数据量大时）
-- CREATE TABLE downloads_2024_01 PARTITION OF downloads
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- 下载量聚合：建议使用定时任务或物化视图预聚合每日下载量
-- 避免每次 API 请求都 COUNT 查询 downloads 表
-- CREATE MATERIALIZED VIEW download_stats_daily AS
--   SELECT package_id, DATE(downloaded_at) AS date, COUNT(*) AS count
--   FROM downloads GROUP BY package_id, DATE(downloaded_at);

-- 自动更新 packages.downloads_count 的触发器
-- CREATE OR REPLACE FUNCTION update_download_count()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   UPDATE packages SET downloads_count = downloads_count + 1
--   WHERE id = NEW.package_id;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER trg_download_count
-- AFTER INSERT ON downloads
-- FOR EACH ROW EXECUTE FUNCTION update_download_count();
```

### api_keys 表（CI/CD Token 认证）

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,  -- 描述名称，如 "CI/CD Pipeline"
    key_hash VARCHAR(128) NOT NULL,  -- SHA256 哈希，不存储明文
    key_prefix VARCHAR(10) NOT NULL,  -- 前缀用于展示，如 "akit_abc..."
    permissions JSONB DEFAULT '["read", "write"]',  -- 权限范围
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,  -- 过期时间，NULL 表示永不过期
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(key_hash)
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

## JSONB Manifest 结构

### 存储策略

- **MCP Manifest**：完整存储在 `versions.manifest` JSONB 字段中
- **Skill Manifest**：`content` 字段（Prompt 内容）如果超过 **10KB**，存储为独立文件到 MinIO，manifest 中用 `content_url` 字段引用；小于 10KB 的直接存储在 JSONB 中
- 安装时 CLI 根据 `content_url` 是否存在决定从数据库还是 MinIO 读取 Skill 内容

> **关于 content 大小限制：**
> - **存储阈值**：10KB — 决定 content 存在数据库还是 MinIO（本文档定义）
> - **绝对上限**：50KB — manifest schema 中 `content` 字段的 maxLength（见 [18-manifest-schema.md](18-manifest-schema.md)）
> - 超过 50KB 的内容会被 CLI 校验拒绝，不允许发布
> - 10KB~50KB 的 content 会被自动存储到 MinIO，manifest 中替换为 `content_url`

### MCP Manifest

```json
{
  "type": "mcp",
  "transport": "stdio",
  "command": "node",
  "args": ["index.js"],
  "env": [
    {
      "name": "API_KEY",
      "required": true,
      "description": "API key for the service"
    }
  ],
  "capabilities": ["tools", "resources"],
  "tools": [
    {
      "name": "search",
      "description": "Search the web"
    }
  ]
}
```

### Skill Manifest

```json
{
  "type": "skill",
  "trigger": "command",
  "command": "review",
  "description": "Code review skill",
  "content": "...",
  "hooks": ["pre-commit"],
  "permissions": ["read-files"]
}
```
