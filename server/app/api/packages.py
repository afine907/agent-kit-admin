"""包管理 API 路由"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.package import PackageService
from app.services.storage import StorageService
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.package import PackageCreate, PackageResponse, PackageListResponse

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
    current_user: User | None = Depends(get_current_user_optional),
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
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """获取包详情"""
    service = PackageService(db)
    package = await service.get_package(scope, name, current_user)
    return package


@router.post("", response_model=PackageResponse, status_code=201)
async def create_package(
    data: PackageCreate,
    current_user: User = Depends(get_current_user),
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


@router.get("/{scope}/{name}/download")
async def download_latest(
    scope: str,
    name: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """下载最新版本 (302 重定向到 MinIO 预签名 URL)"""
    from app.services.version import VersionService
    from app.models.version import Version
    from sqlalchemy import select

    package_service = PackageService(db)
    package = await package_service.get_package(scope, name, current_user)

    # 获取最新版本
    version_service = VersionService(db)
    version = await version_service.get_latest_version(package.id)

    if not version:
        from app.errors import AppError, ErrorCodes
        raise AppError(code=ErrorCodes.VERSION_NOT_FOUND, message="没有可用的版本", status_code=404)

    # 生成预签名 URL
    storage = StorageService()
    url = await storage.get_presigned_url(version.tarball_path)

    return RedirectResponse(url=url, status_code=302)


@router.get("/{scope}/{name}/versions/{version}/download")
async def download_version(
    scope: str,
    name: str,
    version: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """下载指定版本 (302 重定向到 MinIO 预签名 URL)"""
    from app.services.version import VersionService

    package_service = PackageService(db)
    package = await package_service.get_package(scope, name, current_user)

    # 获取指定版本
    version_service = VersionService(db)
    ver = await version_service.get_version(package.id, version)

    if not ver:
        from app.errors import AppError, ErrorCodes
        raise AppError(code=ErrorCodes.VERSION_NOT_FOUND, message=f"版本 {version} 不存在", status_code=404)

    # 生成预签名 URL
    storage = StorageService()
    url = await storage.get_presigned_url(ver.tarball_path)

    return RedirectResponse(url=url, status_code=302)
