"""包管理 API 路由"""

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.package import PackageService
from app.services.storage import get_storage_service
from app.api.deps import get_current_user, get_current_user_optional, UserType
from app.schemas.package import PackageCreate, PackageResponse, PackageListResponse

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
        description=data.description,
        license=data.license,
        repository=data.repository,
        homepage=data.homepage,
        visibility=data.visibility,
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

    # 权限检查
    if str(package.owner_id) != str(current_user.id):
        raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="只有包的所有者才能删除", status_code=403)

    # 软删除
    package.deleted_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    await db.commit()

    return {"message": f"包 {scope}/{name} 已删除"}


@router.get("/{scope}/{name}/download")
async def download_latest(
    scope: str,
    name: str,
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
    # 只传递 ID 字符串，避免 ORM 对象 detached 问题
    background_tasks.add_task(
        _record_download,
        str(package.id),
        str(version.id),
    )

    return RedirectResponse(url=url, status_code=302)


@router.get("/{scope}/{name}/versions/{version}/download")
async def download_version(
    scope: str,
    name: str,
    version: str,
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
    background_tasks.add_task(
        _record_download,
        str(package.id),
        str(ver.id),
    )

    return RedirectResponse(url=url, status_code=302)


async def _record_download(
    package_id: str,
    version_id: str,
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
            )
            session.add(download)

            # 使用 SQL 原子操作更新计数，避免并发竞态
            await session.execute(
                update(Package)
                .where(Package.id == package_id)
                .values(downloads_count=Package.downloads_count + 1)
            )

            await session.commit()
    except Exception as e:
        # 下载计数失败只记录日志，不影响用户体验
        logger.warning("记录下载失败 package_id=%s version_id=%s: %s", package_id, version_id, e)
