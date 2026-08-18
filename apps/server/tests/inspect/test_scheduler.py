import pytest
from unittest.mock import AsyncMock, MagicMock
from app.inspect.scheduler import create_scheduler


def test_create_scheduler():
    """Scheduler 创建成功并注册了两个 job"""
    mock_inspector = MagicMock()
    mock_inspector.run_sampled_check = AsyncMock()
    mock_inspector.process_pending_checks = AsyncMock()

    scheduler = create_scheduler(mock_inspector)
    assert scheduler is not None

    job_ids = [job.id for job in scheduler.get_jobs()]
    assert "daily_inspection" in job_ids
    assert "pending_check_poller" in job_ids
