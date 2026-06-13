# 数据库迁移指南

## 概述

Agent Kit Admin 使用 [Alembic](https://alembic.sqlalchemy.org/) 管理 PostgreSQL 数据库迁移。本文档定义迁移规范、初始脚本和运维操作。

---

## Alembic 配置

### 目录结构

```
server/
├── alembic/
│   ├── env.py              # 迁移环境配置
│   ├── script.py.mako      # 迁移脚本模板
│   └── versions/           # 迁移版本文件
│       ├── 001_initial_schema.py
│       └── ...
├── alembic.ini             # Alembic 配置文件
└── app/
    ├── database.py          # 数据库连接
    └── models/              # SQLAlchemy 模型
```

### alembic.ini

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

### env.py

```python
# server/alembic/env.py
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from app.database import Base
from app.models import user, package, version, review, download, api_key  # 导入所有模型

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式迁移（生成 SQL 脚本）"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """异步模式迁移"""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """在线模式迁移"""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

---

## 初始迁移脚本

### 001_initial_schema.py

```python
"""初始数据库 Schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === users 表 ===
    op.create_table(
        "users",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True),
        sa.Column("display_name", sa.String(100)),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("oauth_provider", sa.String(20), nullable=False),
        sa.Column("oauth_id", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("oauth_provider", "oauth_id", name="uq_users_oauth"),
    )
    op.create_index("idx_users_oauth", "users", ["oauth_provider", "oauth_id"])

    # === teams 表 ===
    op.create_table(
        "teams",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(50), unique=True, nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("external_dept_id", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # === team_members 表 ===
    op.create_table(
        "team_members",
        sa.Column("team_id", UUID(), sa.ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_team_members_user", "team_members", ["user_id"])

    # === packages 表 ===
    op.create_table(
        "packages",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("scope", sa.String(50), nullable=False),
        sa.Column("full_name", sa.String(150), sa.Computed("scope || '/' || name", persisted=True)),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("owner_id", UUID(), nullable=False),
        sa.Column("owner_type", sa.String(10), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("license", sa.String(50), server_default="MIT"),
        sa.Column("repository", sa.Text()),
        sa.Column("homepage", sa.Text()),
        sa.Column("visibility", sa.String(10), server_default="public"),
        sa.Column("downloads_count", sa.BigInteger(), server_default="0"),
        sa.Column("latest_version", sa.String(50)),
        sa.Column("tags", JSONB(), server_default="'[]'"),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("scope", "name", name="uq_packages_scope_name"),
    )
    op.create_index("idx_packages_full_name", "packages", ["full_name"])
    op.create_index("idx_packages_type", "packages", ["type"])
    op.create_index("idx_packages_owner", "packages", ["owner_id", "owner_type"])
    op.create_index("idx_packages_downloads", "packages", [sa.text("downloads_count DESC")])
    op.create_index("idx_packages_tags", "packages", ["tags"], postgresql_using="gin")
    op.create_index(
        "idx_packages_deleted",
        "packages",
        ["deleted_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # === versions 表 ===
    op.create_table(
        "versions",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("package_id", UUID(), sa.ForeignKey("packages.id", ondelete="CASCADE")),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("manifest", JSONB(), nullable=False),
        sa.Column("tarball_hash", sa.String(64), nullable=False),
        sa.Column("tarball_size", sa.BigInteger(), nullable=False),
        sa.Column("tarball_path", sa.String(500), nullable=False),
        sa.Column("dependencies", JSONB(), server_default="'{}'"),
        sa.Column("published_by", UUID(), sa.ForeignKey("users.id")),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deprecated", sa.Boolean(), server_default="false"),
        sa.Column("yanked", sa.Boolean(), server_default="false"),
        sa.Column("tag", sa.String(50)),
        sa.UniqueConstraint("package_id", "version", name="uq_versions_package_version"),
    )
    op.create_index("idx_versions_package", "versions", ["package_id", sa.text("version DESC")])

    # === reviews 表 ===
    op.create_table(
        "reviews",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("package_id", UUID(), sa.ForeignKey("packages.id", ondelete="CASCADE")),
        sa.Column("version_id", UUID(), sa.ForeignKey("versions.id", ondelete="SET NULL")),
        sa.Column("user_id", UUID(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("package_id", "user_id", name="uq_reviews_package_user"),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating"),
    )
    op.create_index("idx_reviews_package", "reviews", ["package_id"])
    op.create_index("idx_reviews_rating", "reviews", ["package_id", "rating"])

    # === downloads 表 ===
    op.create_table(
        "downloads",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("package_id", UUID(), sa.ForeignKey("packages.id", ondelete="CASCADE")),
        sa.Column("version_id", UUID(), sa.ForeignKey("versions.id", ondelete="CASCADE")),
        sa.Column("user_id", UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("ip_address", INET()),
        sa.Column("user_agent", sa.Text()),
        sa.Column("downloaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_downloads_package", "downloads", ["package_id", "downloaded_at"])
    op.create_index("idx_downloads_version", "downloads", ["version_id"])

    # === api_keys 表 ===
    op.create_table(
        "api_keys",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("key_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("key_prefix", sa.String(10), nullable=False),
        sa.Column("permissions", JSONB(), server_default="'[\"read\", \"write\"]'"),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_api_keys_user", "api_keys", ["user_id"])
    op.create_index("idx_api_keys_hash", "api_keys", ["key_hash"])

    # === 下载量自动更新触发器 ===
    op.execute("""
        CREATE OR REPLACE FUNCTION update_download_count()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE packages SET downloads_count = downloads_count + 1
            WHERE id = NEW.package_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_download_count
        AFTER INSERT ON downloads
        FOR EACH ROW EXECUTE FUNCTION update_download_count();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_download_count ON downloads;")
    op.execute("DROP FUNCTION IF EXISTS update_download_count();")
    op.drop_table("api_keys")
    op.drop_table("downloads")
    op.drop_table("reviews")
    op.drop_table("versions")
    op.drop_table("packages")
    op.drop_table("team_members")
    op.drop_table("teams")
    op.drop_table("users")
```

---

## 迁移命名规范

```
<序号>_<描述>.py
```

示例：
- `001_initial_schema.py`
- `002_add_package_tags.py`
- `003_add_api_keys_table.py`
- `004_add_download_stats_view.py`

---

## 常用操作

### 创建新迁移

```bash
# 自动生成迁移（对比模型与数据库的差异）
cd server
alembic revision --autogenerate -m "add package tags"

# 手动创建空迁移
alembic revision -m "add custom index"
```

### 执行迁移

```bash
# 升级到最新版本
alembic upgrade head

# 升级一个版本
alembic upgrade +1

# 降级一个版本
alembic downgrade -1

# 降级到指定版本
alembic downgrade 001

# 查看当前版本
alembic current

# 查看迁移历史
alembic history --verbose
```

### Docker 环境迁移

```bash
# 在 Docker 中执行迁移
docker compose exec server alembic upgrade head

# 查看当前版本
docker compose exec server alembic current
```

---

## 迁移最佳实践

### 1. 先备份再迁移

```bash
# 生产环境迁移前必须备份
docker compose exec db pg_dump -U agentkit agentkit > backup_$(date +%Y%m%d_%H%M%S).sql

# 然后执行迁移
docker compose exec server alembic upgrade head
```

### 2. 迁移脚本必须可逆

每个 `upgrade()` 都必须有对应的 `downgrade()`：

```python
def upgrade():
    op.add_column("packages", sa.Column("tags", JSONB(), server_default="'[]'"))

def downgrade():
    op.drop_column("packages", "tags")
```

### 3. 数据迁移与 Schema 迁移分离

```python
def upgrade():
    # 1. 先加列（允许 NULL）
    op.add_column("packages", sa.Column("category", sa.String(50)))

    # 2. 填充数据
    op.execute("UPDATE packages SET category = 'general' WHERE category IS NULL")

    # 3. 再加约束
    op.alter_column("packages", "category", nullable=False)
```

### 4. 大表迁移注意事项

对于 `downloads` 等大表：
- 使用 `batch_alter_table` 避免长时间锁表
- 分批更新数据
- 在低峰期执行

```python
def upgrade():
    with op.batch_alter_table("downloads") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(20)))
```

---

## 回滚操作

### 回滚到指定版本

```bash
# 查看历史
alembic history

# 回滚到特定版本
alembic downgrade 001

# 回滚全部
alembic downgrade base
```

### 从备份恢复

```bash
# 停止服务
docker compose stop server

# 恢复数据库
docker compose exec -T db psql -U agentkit -d agentkit < backup_20240115_120000.sql

# 重新执行迁移
docker compose start server
docker compose exec server alembic upgrade head
```

---

## CI/CD 集成

### GitHub Actions

```yaml
# .github/workflows/migrate.yml
name: Database Migration

on:
  push:
    branches: [main]
    paths:
      - 'server/alembic/**'
      - 'server/app/models/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test_agentkit
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd server
          pip install -e ".[dev]"

      - name: Run migrations
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test_agentkit
        run: |
          cd server
          alembic upgrade head

      - name: Verify schema
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test_agentkit
        run: |
          cd server
          python -c "
          import asyncio
          from app.database import engine
          async def check():
              async with engine.connect() as conn:
                  result = await conn.execute('SELECT table_name FROM information_schema.tables WHERE table_schema = \\'public\\'')
                  tables = [r[0] for r in result]
                  print(f'Tables: {tables}')
                  assert 'users' in tables
                  assert 'packages' in tables
                  assert 'versions' in tables
          asyncio.run(check())
          "
```
