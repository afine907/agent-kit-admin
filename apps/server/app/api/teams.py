"""团队管理 API 路由"""

from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.team import TeamService
from app.services.team_package import TeamPackageService
from app.api.deps import get_current_user, UserType
from app.errors import AppError, ErrorCodes
from app.schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    MemberAdd,
    MemberUpdateRole,
    TeamInviteCreate,
    TeamInviteResponse,
    TeamInviteListItem,
    TeamJoinRequest,
    TransferOwnershipRequest,
    TransferOwnershipResponse,
    TeamSettingsResponse,
    TeamSettingsUpdate,
    TeamPackagePublish,
    TeamPackageVersionPublish,
)

router = APIRouter(prefix="/teams", tags=["teams"])


# =============================================================================
# 基础团队 CRUD
# =============================================================================


@router.post("", response_model=TeamResponse, status_code=201)
async def create_team(
    data: TeamCreate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建团队"""
    service = TeamService(db)
    team = await service.create_team(
        owner_id=str(current_user.id),
        name=data.name,
        slug=data.slug,
        description=data.description,
    )
    return team


@router.get("")
async def list_teams(
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出我的团队"""
    service = TeamService(db)
    teams = await service.list_teams(str(current_user.id))
    return teams


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取团队详情（需为团队成员）"""
    service = TeamService(db)
    team = await service.get_team(team_id)
    if not await service.is_member(team_id, str(current_user.id)):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="You must be a team member to view team details",
            status_code=403,
        )
    return team


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    data: TeamUpdate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新团队"""
    service = TeamService(db)
    team = await service.update_team(
        team_id=team_id,
        user_id=str(current_user.id),
        data=data.model_dump(exclude_unset=True),
    )
    return team


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除团队"""
    service = TeamService(db)
    await service.delete_team(team_id, str(current_user.id))


# =============================================================================
# 成员管理
# =============================================================================


@router.get("/{team_id}/members")
async def list_members(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出成员（需为团队成员）"""
    service = TeamService(db)
    if not await service.is_member(team_id, str(current_user.id)):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="You must be a team member to view member list",
            status_code=403,
        )
    members = await service.list_members(team_id)
    return members


@router.post("/{team_id}/members", status_code=201)
async def add_member(
    team_id: str,
    data: MemberAdd,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """添加成员（需 admin/owner 权限）"""
    service = TeamService(db)
    await service._check_admin_permission(team_id, str(current_user.id))
    member = await service.add_member(
        team_id=team_id,
        user_id=str(data.user_id),
        role=data.role,
    )
    return member


@router.delete("/{team_id}/members/{user_id}", status_code=204)
async def remove_member(
    team_id: str,
    user_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """移除成员（需 admin/owner 权限，且不能移除自己）"""
    service = TeamService(db)
    await service._check_admin_permission(team_id, str(current_user.id))
    if user_id == str(current_user.id):
        raise AppError(
            code=ErrorCodes.INVALID_PARAM,
            message="Cannot remove yourself, use leave team instead",
            status_code=400,
        )
    await service.remove_member(team_id, user_id)


@router.post("/{team_id}/leave", status_code=204)
async def leave_team(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """退出团队（当前用户自行移除）"""
    service = TeamService(db)
    await service.leave_team(team_id, str(current_user.id))


# =============================================================================
# 邀请相关 API (Task 1)
# =============================================================================


@router.post("/{team_id}/invites", response_model=TeamInviteResponse, status_code=201)
async def create_invite(
    team_id: str,
    data: TeamInviteCreate | None = None,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建团队邀请（admin+）"""
    service = TeamService(db)
    expires_hours = data.expires_hours if data else 72
    max_uses = data.max_uses if data else 1
    result = await service.generate_invite(
        team_id=team_id,
        user_id=str(current_user.id),
        expires_hours=expires_hours,
        max_uses=max_uses,
    )
    return result


@router.get("/{team_id}/invites", response_model=list[TeamInviteListItem])
async def list_invites(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出团队有效邀请（admin+）"""
    service = TeamService(db)
    return await service.list_invites(team_id, str(current_user.id))


@router.delete("/{team_id}/invites/{token}", status_code=204)
async def revoke_invite(
    team_id: str,
    token: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """撤销邀请（admin+）"""
    service = TeamService(db)
    await service.revoke_invite(team_id, token, str(current_user.id))


@router.post("/join")
async def join_team(
    data: TeamJoinRequest,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """通过邀请码加入团队"""
    service = TeamService(db)
    return await service.accept_invite(data.token, str(current_user.id))


# =============================================================================
# 角色变更 & Ownership Transfer API (Task 2)
# =============================================================================


@router.put("/{team_id}/members/{user_id}/role")
async def change_member_role(
    team_id: str,
    user_id: str,
    data: MemberUpdateRole,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """变更成员角色（需 owner）"""
    service = TeamService(db)
    return await service.change_member_role(
        team_id=team_id,
        target_user_id=user_id,
        new_role=data.role,
        actor_user_id=str(current_user.id),
    )


@router.post("/{team_id}/transfer-ownership", response_model=TransferOwnershipResponse)
async def transfer_ownership(
    team_id: str,
    data: TransferOwnershipRequest,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发起所有权转让（需 owner）"""
    service = TeamService(db)
    return await service.initiate_ownership_transfer(
        team_id=team_id,
        from_user_id=str(current_user.id),
        to_user_id=str(data.to_user_id),
    )


@router.post("/{team_id}/accept-ownership")
async def accept_ownership(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """接受所有权转让"""
    service = TeamService(db)
    return await service.accept_ownership_transfer(team_id, str(current_user.id))


@router.delete("/{team_id}/transfer-ownership", status_code=204)
async def cancel_ownership(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """取消待处理的转让（需 owner）"""
    service = TeamService(db)
    await service.cancel_ownership_transfer(team_id, str(current_user.id))


# =============================================================================
# 团队设置 API (Task 3)
# =============================================================================


@router.get("/{team_id}/settings", response_model=TeamSettingsResponse)
async def get_team_settings(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取团队设置（成员可读）"""
    service = TeamService(db)
    if not await service.is_member(team_id, str(current_user.id)):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="You must be a team member",
            status_code=403,
        )
    settings = await service.get_settings(team_id)
    return settings


@router.put("/{team_id}/settings", response_model=TeamSettingsResponse)
async def update_team_settings(
    team_id: str,
    data: TeamSettingsUpdate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新团队设置（需 admin+）"""
    service = TeamService(db)
    settings = await service.update_settings(
        team_id=team_id,
        user_id=str(current_user.id),
        updates=data.model_dump(exclude_unset=True),
    )
    return settings


# =============================================================================
# /me 端点（静态路径，优先于 /{team_id} 匹配）
# =============================================================================


@router.get("/me/installed")
async def list_my_installed(
    team_id: str | None = None,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户已安装的包（可按 team_id 筛选）"""
    service = TeamPackageService(db)
    packages = await service.list_installed(str(current_user.id), team_id)
    return {"data": packages, "total": len(packages)}


# =============================================================================
# 团队包管理 API
# =============================================================================


@router.get("/{team_id}/packages")
async def list_team_packages(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出团队所有包（含当前用户的安装状态）"""
    service = TeamPackageService(db)
    packages = await service.list_team_packages(team_id, str(current_user.id))
    return packages


@router.post("/{team_id}/packages", status_code=201)
async def publish_team_package(
    team_id: str,
    data: TeamPackagePublish,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发布新包到团队"""
    service = TeamPackageService(db)
    pkg = await service.publish_package(
        team_id=team_id,
        user_id=str(current_user.id),
        name=data.name,
        type=data.type,
        description=data.description,
        manifest=data.manifest,
        tarball_b64=data.tarball,
    )
    return {
        "id": str(pkg.id),
        "name": pkg.name,
        "scope": pkg.scope,
        "full_name": pkg.full_name,
        "type": pkg.type,
        "description": pkg.description,
        "visibility": pkg.visibility,
        "owner_type": pkg.owner_type,
        "downloads_count": pkg.downloads_count,
        "latest_version": pkg.latest_version,
        "created_at": str(pkg.created_at),
        "updated_at": str(pkg.updated_at),
        "my_installed_version": None,
        "has_update": False,
    }


@router.get("/{team_id}/packages/{package_id}")
async def get_team_package(
    team_id: str,
    package_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取团队包详情"""
    service = TeamPackageService(db)
    return await service.get_package(team_id, package_id, str(current_user.id))


@router.delete("/{team_id}/packages/{package_id}", status_code=204)
async def delete_team_package(
    team_id: str,
    package_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除团队包"""
    service = TeamPackageService(db)
    await service.delete_package(team_id, package_id, str(current_user.id))


@router.get("/{team_id}/packages/{package_id}/versions")
async def list_team_package_versions(
    team_id: str,
    package_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出包的所有版本"""
    service = TeamPackageService(db)
    versions, total = await service.list_versions(team_id, package_id, str(current_user.id))
    return {
        "data": [
            {
                "id": str(v.id),
                "version": v.version,
                "manifest": v.manifest,
                "tarball_hash": v.tarball_hash,
                "tarball_size": v.tarball_size,
                "tag": v.tag,
                "deprecated": v.deprecated,
                "yanked": v.yanked,
                "published_at": str(v.published_at),
            }
            for v in versions
        ],
        "total": total,
    }


@router.post("/{team_id}/packages/{package_id}/versions", status_code=201)
async def publish_team_package_version(
    team_id: str,
    package_id: str,
    data: TeamPackageVersionPublish,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发布新版本"""
    service = TeamPackageService(db)
    ver = await service.publish_version(
        team_id=team_id,
        package_id=package_id,
        user_id=str(current_user.id),
        version=data.version,
        manifest=data.manifest,
        tarball_b64=data.tarball,
    )
    return {
        "id": str(ver.id),
        "version": ver.version,
        "manifest": ver.manifest,
        "tarball_hash": ver.tarball_hash,
        "tarball_size": ver.tarball_size,
        "tag": ver.tag,
        "deprecated": ver.deprecated,
        "yanked": ver.yanked,
        "published_at": str(ver.published_at),
    }


@router.get("/{team_id}/packages/{package_id}/download")
async def download_team_package_latest(
    team_id: str,
    package_id: str,
    background_tasks: BackgroundTasks,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """下载团队包最新版本 (302 重定向到 MinIO 预签名 URL)"""
    from app.services.storage import get_storage_service

    service = TeamPackageService(db)
    version = await service.get_latest_version(team_id, package_id, str(current_user.id))

    if not version or not version.tarball_path:
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.VERSION_NOT_FOUND, message="没有可用的版本", status_code=404)

    storage = get_storage_service()
    url = await storage.get_presigned_url(str(version.tarball_path))

    background_tasks.add_task(
        _record_team_download,
        team_id,
        package_id,
        str(version.id),
    )

    return RedirectResponse(url=url, status_code=302)


@router.get("/{team_id}/packages/{package_id}/versions/{version}/download")
async def download_team_package_version(
    team_id: str,
    package_id: str,
    version: str,
    background_tasks: BackgroundTasks,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """下载团队包指定版本 (302 重定向到 MinIO 预签名 URL)"""
    from app.services.storage import get_storage_service

    service = TeamPackageService(db)
    ver = await service.get_version_by_tag(team_id, package_id, str(current_user.id), version)

    if not ver or not ver.tarball_path:
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.VERSION_NOT_FOUND, message=f"版本 {version} 不存在", status_code=404)

    storage = get_storage_service()
    url = await storage.get_presigned_url(str(ver.tarball_path))

    background_tasks.add_task(
        _record_team_download,
        team_id,
        package_id,
        str(ver.id),
    )

    return RedirectResponse(url=url, status_code=302)


async def _record_team_download(team_id: str, package_id: str, version_id: str):
    """后台任务：记录团队包下载计数"""
    from app.database import AsyncSessionLocal
    from app.models.package import Package

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Package).where(Package.id == package_id).values(downloads_count=Package.downloads_count + 1)
        )
        await db.commit()


@router.post("/{team_id}/packages/{package_id}/install", status_code=201)
async def install_team_package(
    team_id: str,
    package_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """安装团队包（记录本地安装状态）"""
    service = TeamPackageService(db)
    installed = await service.install_package(team_id, package_id, str(current_user.id))
    return {
        "package_id": str(installed.package_id),
        "version_installed": str(installed.version_installed),
        "installed_at": str(installed.installed_at),
    }


@router.delete("/{team_id}/packages/{package_id}/install", status_code=204)
async def uninstall_team_package(
    team_id: str,
    package_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """卸载团队包（删除安装记录）"""
    service = TeamPackageService(db)
    await service.uninstall_package(team_id, package_id, str(current_user.id))
