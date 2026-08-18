# apps/server/app/inspect/checks/freshness.py
"""E. 版本新鲜度检测 - 检查版本更新时间"""

from datetime import datetime, timezone
from app.inspect.checks.types import CheckResult

WARN_DAYS = 180  # 半年未更新 → warn


def check_freshness(package, version) -> CheckResult:
    """检查版本更新时间"""
    last_update = version.created_at or package.created_at
    if not last_update:
        return CheckResult.pass_({"last_update_days": 0})

    now = datetime.now(timezone.utc)
    if last_update.tzinfo is None:
        last_update = last_update.replace(tzinfo=timezone.utc)

    days_since = (now - last_update).days

    if days_since > WARN_DAYS:
        return CheckResult.warn({
            "last_update_days": days_since,
            "message": f"{days_since} 天未更新",
        })

    return CheckResult.pass_({"last_update_days": days_since})
