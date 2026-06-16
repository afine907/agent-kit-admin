"""Agent Kit Admin - FastAPI 主入口"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import get_settings
from app.errors import AppError, app_error_handler
from app.middleware import RequestIDMiddleware, LoggingMiddleware
from app.api import auth, packages, versions, admin, reviews, teams

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("akit")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期 - 启动时创建数据库表和初始化管理员"""
    from app.database import engine, Base
    from app.models import user, package, version, download, review, team  # noqa: F401

    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    # 初始化管理员
    if settings.INIT_ADMIN_EMAIL and settings.INIT_ADMIN_PASSWORD:
        from app.cli import create_admin

        await create_admin(
            email=settings.INIT_ADMIN_EMAIL,
            password=settings.INIT_ADMIN_PASSWORD,
        )
        logger.info(f"Admin user initialized: {settings.INIT_ADMIN_EMAIL}")

    yield

    # 关闭引擎
    await engine.dispose()


# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Agent Kit Admin - AI Agent 包注册中心",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# 注册异常处理器
app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]

# 中间件（按顺序注册，后注册的先执行）
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 中间件 - 限流（在 CORS 之后、路由之前）
from app.middleware.rate_limit import RateLimitMiddleware  # noqa: E402

app.add_middleware(RateLimitMiddleware)

# 路由注册
app.include_router(auth.router, prefix="/api/v1")
app.include_router(packages.router, prefix="/api/v1")
app.include_router(versions.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/api/health")
async def health_check():
    """健康检查端点 - 包含服务状态"""
    from app.services.storage import get_storage_service

    services = {}

    # 检查数据库
    try:
        from app.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        services["database"] = "ok"
    except Exception as e:
        services["database"] = f"error: {str(e)}"

    # 检查 MinIO - 使用 run_in_executor 避免阻塞事件循环
    try:
        storage = get_storage_service()
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, storage.client.list_buckets)
        services["minio"] = "ok"
    except Exception as e:
        services["minio"] = f"error: {str(e)}"

    # 确定整体状态
    all_ok = all(v == "ok" for v in services.values())

    return {
        "status": "ok" if all_ok else "degraded",
        "version": settings.APP_VERSION,
        "services": services,
    }


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Agent Kit Admin API",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/v1/config")
async def get_config():
    """获取前端配置 - 包含 OAuth 提供商信息"""
    return {
        "data": {
            "oauth_provider": settings.OAUTH_PROVIDER,
        }
    }


def main():
    """启动服务器"""
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )


if __name__ == "__main__":
    main()
