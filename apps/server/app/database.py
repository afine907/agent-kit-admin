"""数据库连接和会话管理"""

import uuid
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import types
from app.config import get_settings


class CompatJSONB(types.TypeDecorator):
    """兼容 PostgreSQL (JSONB) 和 SQLite (JSON) 的 JSON 类型

    PostgreSQL 使用 JSONB 获得索引支持和更好的性能。
    SQLite 回退到 JSON 类型用于测试。
    """

    impl = types.JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB

            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(types.JSON())


class CompatINET(types.TypeDecorator):
    """兼容 PostgreSQL (INET) 和 SQLite (VARCHAR) 的 IP 地址类型"""

    impl = types.String(45)  # IPv6 最大长度
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import INET

            return dialect.type_descriptor(INET())
        return dialect.type_descriptor(types.String(45))


class CompatUUID(types.TypeDecorator):
    """兼容 PostgreSQL (UUID) 和 SQLite (CHAR(36)) 的 UUID 类型

    PostgreSQL 使用原生 UUID(as_uuid=True) 类型，返回 Python uuid.UUID。
    SQLite 使用 CHAR(36) 存储十六进制字符串。
    """

    impl = types.String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PgUUID

            return dialect.type_descriptor(PgUUID(as_uuid=True))
        return dialect.type_descriptor(types.String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value  # PostgreSQL driver handles UUID natively
        # SQLite: ensure we store as string
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value  # PostgreSQL returns uuid.UUID natively
        # SQLite: return string as-is (don't convert to uuid.UUID,
        # because models compare with == and fixtures use string IDs)
        return value


settings = get_settings()

# 检测数据库类型
_db_url = settings.DATABASE_URL_RESOLVED
_is_sqlite = _db_url.startswith("sqlite")

# 创建异步引擎 - SQLite 不支持连接池参数
engine_kwargs = {
    "echo": settings.DEBUG,
}
if not _is_sqlite:
    engine_kwargs.update(
        {
            "pool_size": 20,
            "max_overflow": 10,
            "pool_pre_ping": True,
        }
    )

engine = create_async_engine(_db_url, **engine_kwargs)

# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy 声明式基类"""

    pass


async def get_db():
    """FastAPI 依赖注入 - 获取数据库会话

    注意: 会话不再自动 commit，由调用方负责提交事务。
    只在发生异常时自动 rollback。
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            # 不自动 commit - 由 service 层显式调用 session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
