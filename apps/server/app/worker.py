"""Inspector Worker - 独立进程入口

启动: python -m app.worker
"""

import asyncio
import logging
import sys

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.services.storage import get_storage_service
from app.inspect.scheduler import create_scheduler
from app.inspect.inspector import InspectorService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("akit.worker")
settings = get_settings()


async def _ensure_tables():
    """确保数据库表存在（复用 server 的 create_all 逻辑）"""
    from app.database import engine, Base
    from app.models import user, package, version, download, review, team  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified")


async def main():
    """Worker 主循环"""
    logger.info("Starting Inspector Worker...")
    logger.info(
        "Sample rate: %s, Cron: %02d:%02d, Max LLM: %d, Poll: %ds",
        settings.INSPECTOR_SAMPLE_RATE,
        settings.INSPECTOR_CRON_HOUR,
        settings.INSPECTOR_CRON_MINUTE,
        settings.INSPECTOR_MAX_LLM_PER_RUN,
        settings.INSPECTOR_POLL_INTERVAL,
    )

    # 确保表存在
    await _ensure_tables()

    # 创建 inspector（使用独立 session）
    async with AsyncSessionLocal() as db:
        storage = get_storage_service()
        inspector = InspectorService(db, storage)
        scheduler = create_scheduler(inspector)

    scheduler.start()
    logger.info("Scheduler started. Running inspection loop...")

    # 主循环：保持进程存活
    try:
        while True:
            await asyncio.sleep(60)
            logger.debug("Worker alive, jobs: %s", [j.id for j in scheduler.get_jobs()])
    except asyncio.CancelledError:
        logger.info("Worker cancelled")
    finally:
        scheduler.shutdown()
        logger.info("Scheduler shutdown")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
        sys.exit(0)
