# apps/server/app/inspect/inspector.py
"""Inspector 主服务 - 编排四维检测"""

import asyncio
import logging
import random
from datetime import datetime, timezone
from sqlalchemy import select, update

from app.config import get_settings
from app.models.package import Package
from app.models.version import Version
from app.models.health_check import AgentHealthCheck
from app.services.storage import get_storage_service
from app.inspect.checks.types import CheckResult
from app.inspect.checks.compliance import check_compliance
from app.inspect.checks.content import check_content
from app.inspect.checks.functional import check_functional
from app.inspect.checks.freshness import check_freshness

logger = logging.getLogger(__name__)
settings = get_settings()


def overall_status(results: list[CheckResult]) -> str:
    """根据四维结果计算综合状态"""
    statuses = [r.status for r in results]
    if "error" in statuses:
        return "error"
    if "fail" in statuses:
        return "degraded"
    if "warn" in statuses:
        return "degraded"
    return "healthy"


class InspectorService:
    """健康检测编排服务"""

    def __init__(self, db, storage=None):
        self.db = db
        self.storage = storage or get_storage_service()

    async def run_check(
        self, package: Package, version: Version | None = None, trigger: str = "scheduled"
    ) -> AgentHealthCheck:
        """对单个包执行四维检测"""
        if version is None:
            version = await self._get_latest_version(str(package.id))

        if version is None:
            # 无版本 → 记录空结果
            check = AgentHealthCheck(
                package_id=str(package.id),
                version="none",
                overall_status="error",
                trigger_type=trigger,
                compliance_status="error",
                compliance_detail={"error": "无已发布版本"},
                content_status="skip",
                functional_status="skip",
                freshness_status="skip",
            )
            self.db.add(check)
            await self.db.flush()
            await self._update_package_status(str(package.id), "error")
            return check

        # 四维检测（并发执行，单个维度异常不影响其他）
        async def _safe_check(fn, *args):
            try:
                result = await fn(*args)
                # 同步函数（compliance/freshness）直接返回 CheckResult
                # 异步函数需要 await
                return result
            except asyncio.TimeoutError:
                return CheckResult.error({"error": "检测超时 (60s)"})
            except Exception as e:
                logger.exception("check failed: %s", fn.__name__)
                return CheckResult.error({"error": str(e)})

        # compliance 和 freshness 是同步函数，用 to_thread 包装
        loop = asyncio.get_event_loop()
        results = await asyncio.gather(
            loop.run_in_executor(None, check_compliance, version.manifest or {}),
            _safe_check(check_content, package, version, self.storage),
            _safe_check(check_functional, package, version, self.db),
            loop.run_in_executor(None, check_freshness, package, version),
        )

        # 构建结果对象
        compliance = results[0]
        content = results[1]
        functional = results[2]
        freshness = results[3]

        check = AgentHealthCheck(
            package_id=str(package.id),
            version=version.version,
            compliance_status=compliance.status,
            compliance_detail=compliance.detail,
            content_status=content.status,
            content_detail=content.detail,
            functional_status=functional.status,
            functional_detail=functional.detail,
            freshness_status=freshness.status,
            freshness_detail=freshness.detail,
            overall_status=overall_status(results),
            trigger_type=trigger,
        )
        self.db.add(check)
        await self.db.flush()

        # 更新包状态缓存
        await self._update_package_status(str(package.id), check.overall_status)

        return check

    async def _update_package_status(self, package_id: str, status: str):
        """更新包健康状态缓存"""
        await self.db.execute(
            update(Package)
            .where(Package.id == package_id)
            .values(
                health_status=status,
                needs_check=False,
                last_check_at=datetime.now(timezone.utc),
            )
        )
        await self.db.flush()

    async def _get_latest_version(self, package_id: str) -> Version | None:
        result = await self.db.execute(
            select(Version)
            .where(Version.package_id == package_id, Version.yanked.is_(False))
            .order_by(Version.published_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_all_skill_packages(self) -> list[Package]:
        """获取所有未删除的 skill 包"""
        result = await self.db.execute(select(Package).where(Package.type == "skill", Package.deleted_at.is_(None)))
        return list(result.scalars().all())

    async def run_sampled_check(self):
        """调度触发：采样检测"""
        packages = await self.get_all_skill_packages()
        if not packages:
            return

        sample_size = max(1, int(len(packages) * settings.INSPECTOR_SAMPLE_RATE))
        sampled = random.sample(packages, min(sample_size, len(packages)))

        llm_count = 0
        for pkg in sampled:
            if llm_count >= settings.INSPECTOR_MAX_LLM_PER_RUN:
                logger.info("LLM limit reached, skipping remaining packages")
                break
            try:
                await self.run_check(pkg, trigger="scheduled")
                llm_count += 1
                await self.db.commit()
            except Exception:
                logger.exception("sampled check failed for %s", pkg.full_name)
                await self.db.rollback()

    async def process_pending_checks(self):
        """处理 needs_check=true 的包"""
        result = await self.db.execute(
            select(Package)
            .where(Package.needs_check.is_(True), Package.deleted_at.is_(None))
            .limit(10)  # 每次最多处理 10 个
        )
        packages = list(result.scalars().all())

        for pkg in packages:
            try:
                await self.run_check(pkg, trigger="manual")
                await self.db.commit()
            except Exception:
                logger.exception("pending check failed for %s", pkg.full_name)
                await self.db.rollback()
