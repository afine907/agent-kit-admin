"""管理员 API 路由"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.database import get_db
from app.models.user import User
from app.models.package import Package
from app.api.deps import require_admin, require_super_admin
from app.errors import AppError, ErrorCodes
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================
# Schemas
# ============================================

class UserStatusUpdate(BaseModel):
    """用户状态更新请求"""
    status: str  # active / suspended / banned


class UserRoleUpdate(BaseModel):
    """用户角色更新请求"""
    role: str  # admin / member


class PackageStatusUpdate(BaseModel):
    """包状态更新请求"""
    status: str  # active / suspended
    reason: str | None = None


# ============================================
# 包管理
# ============================================

@router.get("/packages")
async def list_packages(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """获取包列表（管理员）"""
    query = select(Package)

    # 筛选条件
    if not include_deleted:
        query = query.where(Package.deleted_at.is_(None))
    if type:
        query = query.where(Package.type == type)

    # 计算总数
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # 分页
    query = query.offset((page - 1) * per_page).limit(per_page)
    query = query.order_by(Package.created_at.desc())

    result = await db.execute(query)
    packages = result.scalars().all()

    return {
        "data": [
            {
                "id": str(p.id),
                "name": p.name,
                "scope": p.scope,
                "full_name": p.full_name,
                "type": p.type,
                "description": p.description,
                "visibility": p.visibility,
                "admin_status": p.admin_status,
                "downloads_count": p.downloads_count,
                "latest_version": p.latest_version,
                "deleted_at": p.deleted_at.isoformat() if p.deleted_at else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in packages
        ],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total or 0,
            "total_pages": ((total or 0) + per_page - 1) // per_page,
        },
    }


@router.patch("/packages/{package_id}/status")
async def update_package_status(
    package_id: str,
    data: PackageStatusUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """修改包状态（管理员）"""
    # 验证状态值
    if data.status not in ("active", "suspended"):
        raise AppError(code=ErrorCodes.INVALID_PARAM, message="无效的状态值", status_code=422)

    package = await db.get(Package, package_id)
    if not package:
        raise AppError(code=ErrorCodes.NOT_FOUND, message="包不存在", status_code=404)

    package.admin_status = data.status
    package.admin_note = data.reason
    await db.commit()
    await db.refresh(package)

    return {
        "id": str(package.id),
        "name": package.name,
        "status": package.admin_status,
    }


@router.delete("/packages/{package_id}")
async def hard_delete_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """硬删除包（仅超级管理员）"""
    package = await db.get(Package, package_id)
    if not package:
        raise AppError(code=ErrorCodes.NOT_FOUND, message="包不存在", status_code=404)

    await db.delete(package)
    await db.commit()

    return {"message": "包已删除"}


# ============================================
# 用户管理
# ============================================

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: str | None = Query(None),
    status: str | None = Query(None),
    keyword: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """获取用户列表（管理员）"""
    query = select(User)

    # 筛选条件
    if role:
        query = query.where(User.role == role)
    if status:
        query = query.where(User.status == status)
    if keyword:
        query = query.where(
            or_(
                User.username.ilike(f"%{keyword}%"),
                User.email.ilike(f"%{keyword}%"),
                User.display_name.ilike(f"%{keyword}%"),
            )
        )

    # 计算总数
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # 分页
    query = query.offset((page - 1) * per_page).limit(per_page)
    query = query.order_by(User.created_at.desc())

    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "data": [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
                "role": u.role,
                "status": u.status,
                "oauth_provider": u.oauth_provider,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total or 0,
            "total_pages": ((total or 0) + per_page - 1) // per_page,
        },
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """获取用户详情（管理员）"""
    user = await db.get(User, user_id)
    if not user:
        raise AppError(code=ErrorCodes.NOT_FOUND, message="用户不存在", status_code=404)

    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "role": user.role,
        "status": user.status,
        "oauth_provider": user.oauth_provider,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    data: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """修改用户状态（管理员）"""
    # 验证状态值
    if data.status not in ("active", "suspended", "banned"):
        raise AppError(code=ErrorCodes.INVALID_PARAM, message="无效的状态值", status_code=422)

    user = await db.get(User, user_id)
    if not user:
        raise AppError(code=ErrorCodes.NOT_FOUND, message="用户不存在", status_code=404)

    # 不能修改自己
    if str(user.id) == str(admin.id):
        raise AppError(code=ErrorCodes.INVALID_PARAM, message="不能修改自己的状态", status_code=400)

    user.status = data.status
    await db.commit()
    await db.refresh(user)

    return {
        "id": str(user.id),
        "username": user.username,
        "status": user.status,
    }


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    data: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """修改用户角色（仅超级管理员）"""
    # 验证角色值
    if data.role not in ("admin", "member"):
        raise AppError(code=ErrorCodes.INVALID_PARAM, message="无效的角色值", status_code=422)

    user = await db.get(User, user_id)
    if not user:
        raise AppError(code=ErrorCodes.NOT_FOUND, message="用户不存在", status_code=404)

    # 不能修改自己
    if str(user.id) == str(admin.id):
        raise AppError(code=ErrorCodes.INVALID_PARAM, message="不能修改自己的角色", status_code=400)

    # 不能提升为 super_admin
    if data.role == "super_admin":
        raise AppError(code=ErrorCodes.INVALID_PARAM, message="不能提升为超级管理员", status_code=400)

    user.role = data.role
    await db.commit()
    await db.refresh(user)

    return {
        "id": str(user.id),
        "username": user.username,
        "role": user.role,
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """删除用户（仅超级管理员，软删除）"""
    user = await db.get(User, user_id)
    if not user:
        raise AppError(code=ErrorCodes.NOT_FOUND, message="用户不存在", status_code=404)

    # 不能删除自己
    if str(user.id) == str(admin.id):
        raise AppError(code=ErrorCodes.INVALID_PARAM, message="不能删除自己", status_code=400)

    # 软删除 - 设置状态为 deleted
    user.status = "deleted"
    await db.commit()

    return {"message": "用户已删除"}


# ============================================
# 系统统计
# ============================================

@router.get("/stats")
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """获取系统统计（管理员）"""
    # 用户统计
    total_users = await db.scalar(select(func.count()).where(User.status != "deleted"))
    active_users = await db.scalar(select(func.count()).where(User.status == "active"))

    # 包统计
    total_packages = await db.scalar(select(func.count()).where(Package.deleted_at.is_(None)))

    return {
        "total_users": total_users or 0,
        "active_users": active_users or 0,
        "total_packages": total_packages or 0,
    }


@router.get("/stats/downloads")
async def get_download_trends(
    days: int = Query(30, ge=1, le=90, description="统计天数"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """获取下载趋势（管理员）

    返回最近 N 天每天的下载量。
    """
    from app.models.download import Download
    from datetime import datetime, timedelta, timezone

    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # 按日期分组统计下载量
    stmt = (
        select(
            func.date(Download.downloaded_at).label("date"),
            func.count().label("count"),
        )
        .where(Download.downloaded_at >= start_date)
        .group_by(func.date(Download.downloaded_at))
        .order_by(func.date(Download.downloaded_at))
    )

    result = await db.execute(stmt)
    rows = result.all()

    # 构建完整的日期序列（填充缺失日期为 0）
    trends = []
    current_date = start_date.date()
    end_date = datetime.now(timezone.utc).date()
    row_dict = {str(row.date): row.count for row in rows}

    while current_date <= end_date:
        date_str = current_date.isoformat()
        trends.append({
            "date": date_str,
            "downloads": row_dict.get(date_str, 0),
        })
        current_date += timedelta(days=1)

    return {"trends": trends, "days": days}
