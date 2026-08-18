"""健康检测 API 路由"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user, UserType
from app.models.package import Package
from app.models.health_check import AgentHealthCheck
from app.schemas.health_check import HealthCheckResponse, HealthOverviewResponse, DimensionResult
from app.inspect.events import mark_needs_check_by_name

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])


@router.post("/check/{scope}/{name}")
async def trigger_check(
    scope: str,
    name: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """手动触发重新检测"""
    await mark_needs_check_by_name(db, scope, name)
    await db.commit()
    return {"message": "已加入检测队列", "status": "queued"}


@router.get("/check/{scope}/{name}", response_model=HealthCheckResponse)
async def get_health_status(
    scope: str,
    name: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取最新检测结果"""
    result = await db.execute(
        select(Package).where(Package.scope == scope, Package.name == name)
    )
    package = result.scalar_one_or_none()
    if not package:
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="包不存在", status_code=404)

    check_result = await db.execute(
        select(AgentHealthCheck)
        .where(AgentHealthCheck.package_id == package.id)
        .order_by(AgentHealthCheck.created_at.desc())
        .limit(1)
    )
    check = check_result.scalar_one_or_none()

    if not check:
        return HealthCheckResponse(
            overall=package.health_status or "pending",
            compliance=DimensionResult(status="skip", detail={}),
            content=DimensionResult(status="skip", detail={}),
            functional=DimensionResult(status="skip", detail={}),
            freshness=DimensionResult(status="skip", detail={}),
        )

    return HealthCheckResponse(
        overall=check.overall_status,
        compliance=DimensionResult(status=check.compliance_status, detail=check.compliance_detail),
        content=DimensionResult(status=check.content_status, detail=check.content_detail),
        functional=DimensionResult(status=check.functional_status, detail=check.functional_detail),
        freshness=DimensionResult(status=check.freshness_status, detail=check.freshness_detail),
        checked_at=check.created_at,
        trigger=check.trigger_type,
    )


@router.get("/overview", response_model=HealthOverviewResponse)
async def get_health_overview(
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """平台健康概览"""
    result = await db.execute(
        select(Package.health_status, func.count(Package.id))
        .where(Package.type == "skill", Package.deleted_at.is_(None))
        .group_by(Package.health_status)
    )
    counts = dict(result.all())

    total = sum(counts.values())
    healthy = counts.get("healthy", 0)
    degraded = counts.get("degraded", 0)
    error = counts.get("error", 0)
    pending = counts.get("pending", 0)

    last_check = await db.execute(select(func.max(AgentHealthCheck.created_at)))
    last_run = last_check.scalar_one_or_none()

    return HealthOverviewResponse(
        total=total,
        healthy=healthy,
        degraded=degraded,
        error=error,
        pending=pending,
        last_run_at=last_run,
    )
