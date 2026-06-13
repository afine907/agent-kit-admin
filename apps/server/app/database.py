"""数据库连接和会话管理"""

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
    """兼容 PostgreSQL (UUID) 和 SQLite (CHAR(32)) 的 UUID 类型

    PostgreSQL 使用原生 UUID 类型。
    SQLite 使用 CHAR(32) 存储十六进制字符串。
    """

    impl = types.Uuid
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PgUUID
            return dialect.type_descriptor(PgUUID(as_uuid=True))
        return dialect.type_descriptor(types.Uuid())

settings = get_settings()

# 创建异步引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

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
