"""版本管理 API 路由"""

import json
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.package import PackageService
from app.services.version import VersionService
from app.services.webhook import WebhookService
from app.api.deps import get_current_user, get_current_user_optional, UserType
from app.schemas.package import VersionResponse, VersionListResponse

router = APIRouter(prefix="/packages/{scope}/{name}/versions", tags=["versions"])


@router.get("", response_model=VersionListResponse)
async def list_versions(
    scope: str,
    name: str,
    db: AsyncSession = Depends(get_db),
):
    """列出版本"""
    package_service = PackageService(db)
    package = await package_service.get_package(scope, name)

    version_service = VersionService(db)
    versions = await version_service.list_versions(str(package.id))

    return {
        "data": versions,
        "total": len(versions),
    }


@router.get("/{version}", response_model=VersionResponse)
async def get_version(
    scope: str,
    name: str,
    version: str,
    current_user: UserType | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """获取版本详情"""
    package_service = PackageService(db)
    package = await package_service.get_package(scope, name, current_user)

    version_service = VersionService(db)
    ver = await version_service.get_version(str(package.id), version)

    if not ver:
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.VERSION_NOT_FOUND, message=f"版本 {version} 不存在", status_code=404)

    return ver


@router.post("", response_model=VersionResponse, status_code=201)
async def publish_version(
    scope: str,
    name: str,
    version: str = Form(..., description="版本号 (semver)"),
    manifest: str = Form(..., description="akit.json 内容 (JSON 字符串)"),
    tarball: UploadFile = File(..., description="包文件 (.tar.gz)"),
    tag: str = Form(None, description="版本标签"),
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发布新版本 (需要认证)"""
    # 解析 manifest
    try:
        manifest_data = json.loads(manifest)
    except json.JSONDecodeError:
        from app.errors import AppError, ErrorCodes

        raise AppError(
            code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
            message="manifest 不是有效的 JSON",
            status_code=400,
        )

    # 获取包
    package_service = PackageService(db)
    package = await package_service.get_package(scope, name, current_user)

    # 权限检查 - 只有包的 owner 才能发布新版本
    if str(package.owner_id) != str(current_user.id):
        from app.errors import AppError, ErrorCodes

        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="只有包的所有者才能发布新版本",
            status_code=403,
        )

    # 发布版本 - 使用流式上传，避免将整个 tarball 读入内存
    version_service = VersionService(db)
    ver = await version_service.publish_version_streaming(
        package_id=str(package.id),
        version=version,
        manifest=manifest_data,
        tarball_file=tarball,
        tag=tag,
        published_by=str(current_user.id),
    )

    # 触发 webhook（仅团队包）
    if package.owner_type == "team":
        webhook_service = WebhookService(db)
        await webhook_service.fire_webhooks(
            team_id=package.owner_id,
            event="package.published",
            payload={
                "scope": scope,
                "name": name,
                "version": version,
                "package_id": str(package.id),
                "manifest": manifest_data,
            },
        )

    return ver


@router.post("/{version}/deprecate", response_model=VersionResponse)
async def deprecate_version(
    scope: str,
    name: str,
    version: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """标记版本为 deprecated"""
    package_service = PackageService(db)
    package = await package_service.get_package(scope, name)

    if str(package.owner_id) != str(current_user.id):
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="只有包的所有者才能操作", status_code=403)

    version_service = VersionService(db)
    ver = await version_service.set_deprecated(str(package.id), version, True)
    return ver


@router.delete("/{version}/deprecate", response_model=VersionResponse)
async def undeprecate_version(
    scope: str,
    name: str,
    version: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """取消版本废弃标记"""
    package_service = PackageService(db)
    package = await package_service.get_package(scope, name)

    if str(package.owner_id) != str(current_user.id):
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="只有包的所有者才能操作", status_code=403)

    version_service = VersionService(db)
    ver = await version_service.set_deprecated(str(package.id), version, False)
    return ver


@router.post("/{version}/yank", response_model=VersionResponse)
async def yank_version(
    scope: str,
    name: str,
    version: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """撤回版本（yank）"""
    package_service = PackageService(db)
    package = await package_service.get_package(scope, name)

    if str(package.owner_id) != str(current_user.id):
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="只有包的所有者才能操作", status_code=403)

    version_service = VersionService(db)
    ver = await version_service.set_yanked(str(package.id), version, True)

    # 触发 webhook（仅团队包）
    if package.owner_type == "team":
        webhook_service = WebhookService(db)
        await webhook_service.fire_webhooks(
            team_id=package.owner_id,
            event="version.yanked",
            payload={
                "scope": scope,
                "name": name,
                "version": version,
                "package_id": str(package.id),
            },
        )

    return ver


@router.delete("/{version}/yank", response_model=VersionResponse)
async def unyank_version(
    scope: str,
    name: str,
    version: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """取消撤回"""
    package_service = PackageService(db)
    package = await package_service.get_package(scope, name)

    if str(package.owner_id) != str(current_user.id):
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="只有包的所有者才能操作", status_code=403)

    version_service = VersionService(db)
    ver = await version_service.set_yanked(str(package.id), version, False)
    return ver
