"""数据库连接和会话管理"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

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
