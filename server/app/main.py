"""Agent Kit Admin - FastAPI 主入口"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import get_settings
from app.errors import AppError, app_error_handler
from app.middleware import RequestIDMiddleware, LoggingMiddleware
from app.api import auth, packages, versions

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("akit")

settings = get_settings()

# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Agent Kit Admin - AI Agent 包注册中心",
    docs_url="/docs",
    redoc_url="/redoc",
)

# 注册异常处理器
app.add_exception_handler(AppError, app_error_handler)

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

# 路由注册
app.include_router(auth.router, prefix="/api/v1")
app.include_router(packages.router, prefix="/api/v1")
app.include_router(versions.router, prefix="/api/v1")


# 缓存 StorageService 实例，避免健康检查每次创建新连接
_storage_service_instance = None


def _get_storage_service():
    global _storage_service_instance
    if _storage_service_instance is None:
        from app.services.storage import StorageService
        _storage_service_instance = StorageService()
    return _storage_service_instance


@app.get("/api/health")
async def health_check():
    """健康检查端点 - 包含服务状态"""
    services = {}

    # 检查数据库
    try:
        from app.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        services["database"] = "ok"
    except Exception as e:
        services["database"] = f"error: {str(e)}"

    # 检查 MinIO
    try:
        storage = _get_storage_service()
        storage.client.list_buckets()
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
