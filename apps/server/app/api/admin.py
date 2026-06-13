"""管理员 API 路由"""

import logging
import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.database import get_db
from app.models.user import User
from app.models.package import Package
from app.models.version import Version
from app.models.download import Download
from app.models.api_key import APIKey
from app.api.deps import require_admin, require_super_admin
from app.errors import AppError, ErrorCodes
from app.services.storage import get_storage_service
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def _escape_like_pattern(value: str) -> str:
    """转义 ILIKE 通配符，防止 % 和 _ 被当作模式匹配使用"""
    value = value.replace("\\", "\\\\")
    value = value.replace("%", "\\%")
    value = value.replace("_", "\\_")
    return value


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
    """硬删除包（仅超级管理员）

    级联清理: versions 记录 -> downloads 记录 -> MinIO 存储文件 -> 包记录
    """
    package = await db.get(Package, package_id)
    if not package:
        raise AppError(code=ErrorCodes.NOT_FOUND, message="包不存在", status_code=404)

    storage = get_storage_service()
    deleted_files = 0
    failed_files = 0

    # 1. 查询该包的所有版本
    versions_result = await db.execute(
        select(Version).where(Version.package_id == package_id)
    )
    versions = versions_result.scalars().all()

    # 2. 删除每个版本的 MinIO tarball 文件
    for version in versions:
        try:
            await storage.delete_tarball(version.tarball_path)
            deleted_files += 1
        except Exception as e:
            # 存储删除失败不阻塞数据库清理，记录警告继续
            failed_files += 1
            logger.warning(
                "删除 MinIO 文件失败 (package=%s, version=%s, path=%s): %s",
                package.full_name,
                version.version,
                version.tarball_path,
                e,
            )

    # 3. 删除下载记录（数据库外键 ondelete=CASCADE 会处理，但显式删除更安全）
    downloads_result = await db.execute(
        select(Download).where(Download.package_id == package_id)
    )
    downloads = downloads_result.scalars().all()
    for download in downloads:
        await db.delete(download)

    # 4. 删除版本记录
    for version in versions:
        await db.delete(version)

    # 5. 最后删除包本身
    await db.delete(package)
    await db.commit()

    if failed_files:
        logger.warning(
            "包 %s 硬删除完成: %d 个文件成功删除, %d 个文件删除失败",
            package.full_name, deleted_files, failed_files,
        )

    return {
        "message": "包已删除",
        "versions_deleted": len(versions),
        "downloads_deleted": len(downloads),
        "files_deleted": deleted_files,
        "files_failed": failed_files,
    }


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
        escaped = _escape_like_pattern(keyword)
        query = query.where(
            or_(
                User.username.ilike(f"%{escaped}%", escape="\\"),
                User.email.ilike(f"%{escaped}%", escape="\\"),
                User.display_name.ilike(f"%{escaped}%", escape="\\"),
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
    """删除用户（仅超级管理员，软删除）

    安全处理:
    - 删除所有 API Key，立即失效 API 认证
    - 清除用户缓存，使 JWT token 在下次验证时重新检查数据库状态
    - 设置 status=deleted，后续 verify_token 会因账号状态异常而拒绝
    """
    user = await db.get(User, user_id)
    if not user:
        raise AppError(code=ErrorCodes.NOT_FOUND, message="用户不存在", status_code=404)

    # 不能删除自己
    if str(user.id) == str(admin.id):
        raise AppError(code=ErrorCodes.INVALID_PARAM, message="不能删除自己", status_code=400)

    # 1. 删除该用户的所有 API Key（立即失效 API 认证）
    api_keys_result = await db.execute(
        select(APIKey).where(APIKey.user_id == user_id)
    )
    api_keys = api_keys_result.scalars().all()
    for api_key in api_keys:
        await db.delete(api_key)

    # 2. 软删除 - 设置状态为 deleted
    user.status = "deleted"
    await db.commit()

    # 3. 清除用户缓存，使已颁发的 JWT token 在下次使用时重新查库验证
    # verify_token 会重新从 DB 读取用户，发现 status=deleted 后拒绝请求
    from app.services.auth import AuthService
    AuthService.invalidate_user_cache(user_id)

    return {"message": "用户已删除", "api_keys_invalidated": len(api_keys)}


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
