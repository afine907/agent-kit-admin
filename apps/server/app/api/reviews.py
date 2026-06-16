"""评价 API 路由"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.package import PackageService
from app.services.review import ReviewService
from app.api.deps import get_current_user, get_current_user_optional, UserType
from app.schemas.review import ReviewCreate, ReviewUpdate, ReviewResponse, ReviewListResponse

router = APIRouter(prefix="/packages/{scope}/{name}/reviews", tags=["reviews"])


async def _get_package_for_review(scope: str, name: str, db: AsyncSession, current_user: UserType | None = None):
    """获取包并检查是否可评价

    get_package 内部已处理 deleted_at（返回 410）和 visibility（private 包返回 404）。
    """
    package_service = PackageService(db)
    return await package_service.get_package(scope, name, current_user)


@router.get("", response_model=ReviewListResponse)
async def list_reviews(
    scope: str,
    name: str,
    page: int = Query(1, ge=1, description="页码"),
    per_page: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: UserType | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """获取包的评价列表（支持 private 包的 owner 查看）"""
    package = await _get_package_for_review(scope, name, db, current_user)
    service = ReviewService(db)
    result = await service.list_reviews(str(package.id), page, per_page)
    result["stats"] = await service.get_review_stats(str(package.id))
    return result


@router.get("/stats")
async def get_review_stats(
    scope: str,
    name: str,
    current_user: UserType | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """获取包的评价统计"""
    package = await _get_package_for_review(scope, name, db, current_user)
    service = ReviewService(db)
    return await service.get_review_stats(str(package.id))


@router.post("", response_model=ReviewResponse, status_code=201)
async def create_review(
    scope: str,
    name: str,
    data: ReviewCreate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建评价（需登录，每人每包一次）"""
    package = await _get_package_for_review(scope, name, db, current_user)
    service = ReviewService(db)
    return await service.create_review(
        package_id=str(package.id),
        user_id=str(current_user.id),
        rating=data.rating,
        comment=data.comment,
        version_id=str(data.version_id) if data.version_id else None,
    )


@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(
    scope: str,
    name: str,
    review_id: str,
    data: ReviewUpdate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新自己的评价"""
    await _get_package_for_review(scope, name, db, current_user)
    service = ReviewService(db)
    return await service.update_review(
        review_id=review_id,
        user_id=str(current_user.id),
        rating=data.rating,
        comment=data.comment,
    )


@router.delete("/{review_id}", status_code=204)
async def delete_review(
    scope: str,
    name: str,
    review_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除自己的评价"""
    await _get_package_for_review(scope, name, db, current_user)
    service = ReviewService(db)
    await service.delete_review(review_id, str(current_user.id))
