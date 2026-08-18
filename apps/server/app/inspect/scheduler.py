"""APScheduler 配置"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from app.config import get_settings

settings = get_settings()


def create_scheduler(inspector) -> AsyncIOScheduler:
    """创建并配置 APScheduler"""
    scheduler = AsyncIOScheduler()

    # 每日凌晨定时巡检
    scheduler.add_job(
        inspector.run_sampled_check,
        trigger=CronTrigger(
            hour=settings.INSPECTOR_CRON_HOUR,
            minute=settings.INSPECTOR_CRON_MINUTE,
        ),
        id="daily_inspection",
        replace_existing=True,
    )

    # 轮询 needs_check
    scheduler.add_job(
        inspector.process_pending_checks,
        trigger=IntervalTrigger(seconds=settings.INSPECTOR_POLL_INTERVAL),
        id="pending_check_poller",
        replace_existing=True,
    )

    return scheduler
