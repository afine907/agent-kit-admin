import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone
from app.inspect.checks.freshness import check_freshness


def _make_pkg_ver(days_since_update):
    now = datetime.now(timezone.utc)
    mock_pkg = MagicMock()
    mock_ver = MagicMock()
    mock_ver.created_at = now - timedelta(days=days_since_update)
    mock_ver.version = "1.0.0"
    return mock_pkg, mock_ver


def test_freshness_recent():
    pkg, ver = _make_pkg_ver(30)
    result = check_freshness(pkg, ver)
    assert result.status == "pass"
    assert result.detail["last_update_days"] == 30


def test_freshness_stale():
    pkg, ver = _make_pkg_ver(200)
    result = check_freshness(pkg, ver)
    assert result.status == "warn"
    assert "200 天未更新" in result.detail["message"]


def test_freshness_exactly_at_threshold():
    pkg, ver = _make_pkg_ver(180)
    result = check_freshness(pkg, ver)
    assert result.status == "pass"


def test_freshness_one_day_over():
    pkg, ver = _make_pkg_ver(181)
    result = check_freshness(pkg, ver)
    assert result.status == "warn"
