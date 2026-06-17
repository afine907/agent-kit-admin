"""评价服务"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.review import Review
from app.errors import AppError, ErrorCodes


class ReviewService:
    """评价管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_review(
        self,
        package_id: str,
        user_id: str,
        rating: int,
        comment: str | None = None,
        version_id: str | None = None,
    ) -> Review:
        """创建评价（每人每包一次）"""
        # 检查是否已评价
        existing = await self._get_user_review(package_id, user_id)
        if existing:
            raise AppError(
                code=ErrorCodes.PACKAGE_ALREADY_EXISTS,
                message="您已对该包发表过评价",
                status_code=409,
            )

        review = Review(
            package_id=package_id,
            user_id=user_id,
            rating=rating,
            comment=comment,
            version_id=version_id,
        )
        self.db.add(review)
        await self.db.commit()
        await self.db.refresh(review)
        return review

    async def update_review(
        self,
        review_id: str,
        user_id: str,
        rating: int | None = None,
        comment: str | None = None,
    ) -> Review:
        """更新自己的评价"""
        review = await self._get_review_by_id(review_id)
        if not review:
            raise AppError(
                code=ErrorCodes.NOT_FOUND,
                message="Review not found",
                status_code=404,
            )

        if str(review.user_id) != user_id:
            raise AppError(
                code=ErrorCodes.AUTH_FORBIDDEN,
                message="You can only update your own review",
                status_code=403,
            )

        if rating is not None:
            review.rating = rating
        if comment is not None:
            review.comment = comment

        await self.db.commit()
        await self.db.refresh(review)
        return review

    async def delete_review(self, review_id: str, user_id: str) -> None:
        """删除自己的评价"""
        review = await self._get_review_by_id(review_id)
        if not review:
            raise AppError(
                code=ErrorCodes.NOT_FOUND,
                message="Review not found",
                status_code=404,
            )

        if str(review.user_id) != user_id:
            raise AppError(
                code=ErrorCodes.AUTH_FORBIDDEN,
                message="You can only delete your own review",
                status_code=403,
            )

        await self.db.delete(review)
        await self.db.commit()

    async def list_reviews(
        self,
        package_id: str,
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        """获取包的评价列表"""
        # 总数
        count_query = select(func.count()).where(Review.package_id == package_id)
        total = (await self.db.execute(count_query)).scalar() or 0

        # 列表
        query = (
            select(Review)
            .where(Review.package_id == package_id)
            .order_by(Review.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        result = await self.db.execute(query)
        reviews = result.scalars().all()

        return {
            "data": reviews,
            "total": total,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
            },
        }

    async def get_user_review(self, package_id: str, user_id: str) -> Review | None:
        """获取用户对某包的评价"""
        return await self._get_user_review(package_id, user_id)

    async def _get_review_by_id(self, review_id: str) -> Review | None:
        """通过 ID 获取评价"""
        result = await self.db.execute(select(Review).where(Review.id == review_id))
        return result.scalar_one_or_none()

    async def _get_user_review(self, package_id: str, user_id: str) -> Review | None:
        """获取用户对某包的评价"""
        result = await self.db.execute(
            select(Review).where(
                Review.package_id == package_id,
                Review.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_review_stats(self, package_id: str) -> dict:
        """获取评价统计（平均分、总数、各星级分布）"""
        # 总数和平均分
        stats_query = select(
            func.count().label("total"),
            func.avg(Review.rating).label("average"),
        ).where(Review.package_id == package_id)
        stats_result = (await self.db.execute(stats_query)).one()
        total = stats_result.total or 0
        average = round(float(stats_result.average), 1) if stats_result.average else 0.0

        # 各星级分布
        distribution: dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        if total > 0:
            dist_query = (
                select(Review.rating, func.count().label("count"))
                .where(Review.package_id == package_id)
                .group_by(Review.rating)
            )
            dist_results = (await self.db.execute(dist_query)).all()
            for row in dist_results:
                distribution[row.rating] = row.count

        return {
            "average_rating": average,
            "total_reviews": total,
            "rating_distribution": distribution,
        }
