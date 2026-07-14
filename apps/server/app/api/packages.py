"""包管理 API 路由"""

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.package import PackageService
from app.services.storage import get_storage_service
from app.services.webhook import WebhookService
from app.api.deps import get_current_user, get_current_user_optional, UserType
from app.schemas.package import (
    PackageCreate,
    PackageUpdate,
    PackageResponse,
    PackageListResponse,
    DependencyCheckRequest,
    PackageTransferRequest,
    BatchPackageRequest,
    BatchDeprecateRequest,
    BatchResultResponse,
    BatchResultItem,
)
from app.services.dependency import DependencyResolver

logger = logging.getLogger("akit.download")

router = APIRouter(prefix="/packages", tags=["packages"])


@router.get("", response_model=PackageListResponse)
async def list_packages(
    search: str | None = Query(None, description="搜索关键词"),
    type: str | None = Query(None, description="包类型: mcp/skill"),
    scope: str | None = Query(None, description="按 scope 筛选"),
    sort: str = Query("updated_at", description="排序字段"),
    order: str = Query("desc", description="排序方向"),
    page: int = Query(1, ge=1, description="页码"),
    per_page: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: UserType | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """列出包 (支持搜索、筛选、分页)"""
    service = PackageService(db)
    result = await service.list_packages(
        search=search,
        type=type,
        scope=scope,
        sort=sort,
        order=order,
        page=page,
        per_page=per_page,
        current_user=current_user,
    )
    return result


@router.get("/{scope}/{name}", response_model=PackageResponse)
async def get_package(
    scope: str,
    name: str,
    current_user: UserType | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """获取包详情"""
    service = PackageService(db)
    package = await service.get_package(scope, name, current_user)
    return package


@router.get("/{scope}/{name}/stats")
async def get_package_stats(
    scope: str,
    name: str,
    current_user: UserType | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """获取包下载统计"""
    service = PackageService(db)
    stats = await service.get_package_stats(scope, name, current_user)
    return stats


@router.post("/check-dependencies")
async def check_dependencies(
    data: DependencyCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """检查依赖包是否存在，并检测循环依赖"""
    service = PackageService(db)
    results = await service.check_dependencies(data.dependencies)
    all_exist = all(r["exists"] for r in results)

    # P2#15: 循环依赖检测
    circular_error: str | None = None
    if data.dependencies:
        # 优先使用传入的 dependency_graph，否则从扁平 dependencies 构造
        dep_graph = data.dependency_graph
        if not dep_graph:
            # 从 {包名: 版本约束} 构造图（假设无嵌套依赖）
            dep_graph = {name: [] for name in data.dependencies}

        resolver = DependencyResolver(dep_graph)
        if resolver.has_cycle():
            cycle_path = resolver.find_cycle()
            if cycle_path:
                circular_error = f"Circular dependency detected: {' -> '.join(cycle_path)}"

    return {
        "all_exist": all_exist,
        "results": results,
        "circular_error": circular_error,
    }


@router.post("", response_model=PackageResponse, status_code=201)
async def create_package(
    data: PackageCreate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建包 (需要认证)"""
    service = PackageService(db)
    package = await service.create_package(
        name=data.name,
        scope=data.scope,
        type=data.type,
        owner_id=str(current_user.id),
        owner_type=data.owner_type,
        description=data.description,
        license=data.license,
        repository=data.repository,
        homepage=data.homepage,
        visibility=data.visibility,
    )
    return package


@router.patch("/{scope}/{name}", response_model=PackageResponse)
async def update_package(
    scope: str,
    name: str,
    data: PackageUpdate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """编辑包 (需要认证且为 owner)"""
    service = PackageService(db)
    update_data = data.model_dump(exclude_unset=True)
    package = await service.update_package(
        scope=scope,
        name=name,
        user_id=str(current_user.id),
        **update_data,
    )
    return package


@router.delete("/{scope}/{name}")
async def delete_package(
    scope: str,
    name: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除包 (软删除，需要认证且为 owner)"""
    from datetime import datetime, timezone
    from app.errors import AppError, ErrorCodes

    service = PackageService(db)
    package = await service.get_package(scope, name, current_user)

    # 软删除权限检查（使用服务层统一权限逻辑）
    if package.owner_type == "team":
        # team 包：需是团队 admin/owner
        if not await service._is_team_admin(package.owner_id, str(current_user.id)):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="只有团队管理员可以删除", status_code=403)
    else:
        # user 包：仅 owner 可删除
        if str(package.owner_id) != str(current_user.id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="只有包的所有者才能删除", status_code=403)

    # 软删除
    package.deleted_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    await db.commit()

    # 触发 webhook（仅团队包）
    if package.owner_type == "team":
        webhook_service = WebhookService(db)
        await webhook_service.fire_webhooks(
            team_id=package.owner_id,
            event="package.deleted",
            payload={
                "scope": scope,
                "name": name,
                "package_id": str(package.id),
            },
        )

    from fastapi.responses import Response

    return Response(status_code=204)


@router.post("/{scope}/{name}/transfer", response_model=PackageResponse)
async def transfer_package(
    scope: str,
    name: str,
    transfer_data: PackageTransferRequest,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """转移包所有权（owner 或 team admin）"""
    service = PackageService(db)
    package = await service.transfer_package(
        scope=scope,
        name=name,
        user_id=str(current_user.id),
        new_owner_type=transfer_data.new_owner_type,
        new_owner_id=transfer_data.new_owner_id,
        new_scope=transfer_data.new_scope,
    )
    return PackageResponse.model_validate(package)


@router.post("/batch/delete", response_model=BatchResultResponse)
async def batch_delete_packages(
    batch_data: BatchPackageRequest,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批量删除包（软删除）"""
    from app.errors import AppError, ErrorCodes

    if len(batch_data.packages) > 50:
        raise AppError(
            code=ErrorCodes.INVALID_PARAM,
            message="Maximum 50 packages per batch",
            status_code=400,
        )

    service = PackageService(db)
    success, failed = await service.batch_delete_packages(
        package_names=batch_data.packages,
        user_id=str(current_user.id),
    )
    return BatchResultResponse(
        success=success,
        failed=[BatchResultItem(**f) for f in failed],
    )


@router.post("/batch/deprecate", response_model=BatchResultResponse)
async def batch_deprecate_packages(
    batch_data: BatchDeprecateRequest,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批量废弃/取消废弃包"""
    from app.errors import AppError, ErrorCodes

    if len(batch_data.packages) > 50:
        raise AppError(
            code=ErrorCodes.INVALID_PARAM,
            message="Maximum 50 packages per batch",
            status_code=400,
        )

    service = PackageService(db)
    success, failed = await service.batch_deprecate_packages(
        package_names=batch_data.packages,
        user_id=str(current_user.id),
        deprecated=batch_data.deprecated,
    )
    return BatchResultResponse(
        success=success,
        failed=[BatchResultItem(**f) for f in failed],
    )


@router.get("/{scope}/{name}/download")
async def download_latest(
    scope: str,
    name: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: UserType | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """下载最新版本 (302 重定向到 MinIO 预签名 URL)"""
    from app.services.version import VersionService

    package_service = PackageService(db)
    package = await package_service.get_package(scope, name, current_user)

    # 获取最新版本
    version_service = VersionService(db)
    version = await version_service.get_latest_version(str(package.id))

    if not version:
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.VERSION_NOT_FOUND, message="没有可用的版本", status_code=404)

    # 生成预签名 URL
    storage = get_storage_service()
    url = await storage.get_presigned_url(str(version.tarball_path))

    # 使用 FastAPI BackgroundTasks 记录下载计数（请求完成后执行）
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    background_tasks.add_task(
        _record_download,
        str(package.id),
        str(version.id),
        ip_address,
        user_agent,
    )

    return RedirectResponse(url=url, status_code=302)


@router.get("/{scope}/{name}/versions/{version}/download")
async def download_version(
    scope: str,
    name: str,
    version: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: UserType | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """下载指定版本 (302 重定向到 MinIO 预签名 URL)"""
    from app.services.version import VersionService

    package_service = PackageService(db)
    package = await package_service.get_package(scope, name, current_user)

    # 获取指定版本
    version_service = VersionService(db)
    ver = await version_service.get_version(str(package.id), version)

    if not ver:
        from app.errors import AppError, ErrorCodes

        raise AppError(code=ErrorCodes.VERSION_NOT_FOUND, message=f"版本 {version} 不存在", status_code=404)

    # 生成预签名 URL
    storage = get_storage_service()
    url = await storage.get_presigned_url(str(ver.tarball_path))

    # 使用 FastAPI BackgroundTasks 记录下载计数
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    background_tasks.add_task(
        _record_download,
        str(package.id),
        str(ver.id),
        ip_address,
        user_agent,
    )

    return RedirectResponse(url=url, status_code=302)


async def _record_download(
    package_id: str,
    version_id: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """记录下载（后台任务）

    使用独立数据库会话和原子操作更新下载计数。
    只接收 ID 字符串，避免 ORM 对象 detached 问题。
    下载计数失败不影响用户体验。
    """
    try:
        from app.models.download import Download
        from app.models.package import Package
        from app.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            # 记录下载
            download = Download(
                package_id=package_id,
                version_id=version_id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            session.add(download)

            # 使用 SQL 原子操作更新计数，避免并发竞态
            await session.execute(
                update(Package).where(Package.id == package_id).values(downloads_count=Package.downloads_count + 1)
            )

            await session.commit()
    except Exception as e:
        # 下载计数失败只记录日志，不影响用户体验
        logger.warning("Failed to record download package_id=%s version_id=%s: %s", package_id, version_id, e)
