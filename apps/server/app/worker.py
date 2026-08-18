"""Inspector Worker - 独立进程入口

启动: python -m app.worker
"""

import asyncio
import logging
import signal
import sys

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.services.storage import get_storage_service
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


def _create_inspector():
    """创建带有独立 session 的 InspectorService"""
    db = AsyncSessionLocal()
    storage = get_storage_service()
    return InspectorService(db, storage)


async def _run_sampled_check():
    """每次执行时创建新 session，避免 session 复用导致关闭问题"""
    inspector = _create_inspector()
    try:
        await inspector.run_sampled_check()
    finally:
        await inspector.db.close()


async def _process_pending_checks():
    """每次执行时创建新 session"""
    inspector = _create_inspector()
    try:
        await inspector.process_pending_checks()
    finally:
        await inspector.db.close()


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

    # 创建 scheduler（使用 factory 函数，每次 job 创建新 session）
    from app.inspect.scheduler import create_scheduler

    # 创建一个 scheduler inspector，使用 factory 模式
    class _SessionScopedInspector:
        """包装器：每次调用方法时创建新 session"""

        async def run_sampled_check(self):
            await _run_sampled_check()

        async def process_pending_checks(self):
            await _process_pending_checks()

    scheduler = create_scheduler(_SessionScopedInspector())
    scheduler.start()
    logger.info("Scheduler started. Running inspection loop...")

    # 优雅关闭：监听取消信号
    stop_event = asyncio.Event()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            # Windows 不支持 add_signal_handler
            pass

    # 主循环：等待停止信号
    try:
        while not stop_event.is_set():
            await asyncio.sleep(5)
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
