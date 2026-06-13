-- Agent Kit Admin - 数据库初始化脚本
-- 创建表结构、索引和测试数据
-- 权威来源: wiki/04-data-model.md

-- ============================================
-- 1. users 表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
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

CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- ============================================
-- 2. teams 表
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,  -- URL 友好的标识
    description TEXT,
    avatar_url TEXT,
    external_dept_id VARCHAR(100),  -- 企微/飞书/钉钉部门ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. team_members 表
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',  -- owner / admin / member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============================================
-- 4. packages 表
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
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
    downloads_count BIGINT DEFAULT 0,
    latest_version VARCHAR(50),
    tags JSONB DEFAULT '[]',  -- 标签数组，如 ["database", "search"]
    deleted_at TIMESTAMP WITH TIME ZONE,  -- 软删除时间，NULL 表示正常
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(scope, name)
);

CREATE INDEX IF NOT EXISTS idx_packages_full_name ON packages(full_name);
CREATE INDEX IF NOT EXISTS idx_packages_type ON packages(type);
CREATE INDEX IF NOT EXISTS idx_packages_owner ON packages(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_packages_downloads ON packages(downloads_count DESC);
CREATE INDEX IF NOT EXISTS idx_packages_tags ON packages USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_packages_deleted ON packages(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 5. versions 表
-- ============================================
CREATE TABLE IF NOT EXISTS versions (
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

CREATE INDEX IF NOT EXISTS idx_versions_package ON versions(package_id, version DESC);

-- ============================================
-- 6. downloads 表
-- ============================================
CREATE TABLE IF NOT EXISTS downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    version_id UUID REFERENCES versions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_downloads_package ON downloads(package_id, downloaded_at);
CREATE INDEX IF NOT EXISTS idx_downloads_version ON downloads(version_id);

-- ============================================
-- 7. api_keys 表（CI/CD Token 认证）
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
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

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ============================================
-- 8. reviews 表
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
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

CREATE INDEX IF NOT EXISTS idx_reviews_package ON reviews(package_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(package_id, rating);

-- ============================================
-- 测试数据
-- ============================================

-- 插入测试用户
INSERT INTO users (username, email, display_name, oauth_provider, oauth_id)
VALUES ('testuser', 'test@example.com', 'Test User', 'wechat_work', 'wx_test_001')
ON CONFLICT DO NOTHING;

-- 插入测试包
INSERT INTO packages (name, scope, type, description, owner_id, owner_type, visibility, tags, manifest)
SELECT
    'filesystem',
    '@testuser',
    'mcp',
    'File system access MCP server',
    u.id,
    'user',
    'public',
    '["filesystem", "mcp"]'::jsonb,
    '{"transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"]}'::jsonb
FROM users u WHERE u.username = 'testuser'
ON CONFLICT DO NOTHING;

-- 插入测试版本
INSERT INTO versions (package_id, version, manifest, tarball_hash, tarball_size, tarball_path, published_by, tag)
SELECT
    p.id,
    '1.0.0',
    '{"name": "filesystem", "version": "1.0.0", "type": "mcp", "mcp": {"transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"]}}'::jsonb,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    1024,
    'packages/testuser/filesystem/1.0.0.tar.gz',
    (SELECT id FROM users WHERE username = 'testuser'),
    'latest'
FROM packages p WHERE p.full_name = '@testuser/filesystem'
ON CONFLICT DO NOTHING;

-- 更新包的 latest_version
UPDATE packages SET latest_version = '1.0.0'
WHERE full_name = '@testuser/filesystem' AND latest_version IS NULL;

-- ============================================
-- 验证 JSONB 查询
-- ============================================
-- SELECT manifest->>'type' FROM packages;
-- SELECT tags FROM packages WHERE tags @> '["mcp"]'::jsonb;
