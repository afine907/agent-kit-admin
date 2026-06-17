"""包管理服务"""

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.package import Package
from app.models.user import User
from app.errors import AppError, ErrorCodes


class PackageService:
    """包管理服务"""

    ALLOWED_SORT_FIELDS = {"updated_at", "created_at", "name", "downloads", "scope", "rating"}

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_packages(
        self,
        search: str | None = None,
        type: str | None = None,
        scope: str | None = None,
        sort: str = "updated_at",
        order: str = "desc",
        page: int = 1,
        per_page: int = 20,
        current_user: User | None = None,
    ) -> dict:
        """列出包 (支持搜索、筛选、分页)"""
        # sort 字段白名单校验
        if sort not in self.ALLOWED_SORT_FIELDS:
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message=f"Unsupported sort field: {sort}, allowed fields: {', '.join(sorted(self.ALLOWED_SORT_FIELDS))}",
                status_code=400,
            )

        query = select(Package).where(Package.deleted_at.is_(None))

        # 可见性过滤
        if current_user:
            # 已登录: public + 所属团队 team 包 + 自己的 private 包
            query = query.where(
                or_(
                    Package.visibility == "public",
                    Package.owner_id == current_user.id,
                )
            )
        else:
            # 未登录: 仅 public
            query = query.where(Package.visibility == "public")

        # 搜索 - 转义 ILIKE 通配符以防止注入
        if search:
            # 转义用户输入中的 % 和 _ 字符
            escaped_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            search_pattern = f"%{escaped_search}%"
            query = query.where(
                or_(
                    Package.name.ilike(search_pattern, escape="\\"),
                    Package.description.ilike(search_pattern, escape="\\"),
                )
            )

        # 类型筛选
        if type:
            query = query.where(Package.type == type)

        # Scope 筛选
        if scope:
            query = query.where(Package.scope == scope)

        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        # 排序
        if sort == "rating":
            from app.models.review import Review

            rating_subq = (
                select(Review.package_id, func.avg(Review.rating).label("avg_rating"))
                .group_by(Review.package_id)
                .subquery()
            )
            query = query.outerjoin(rating_subq, Package.id == rating_subq.c.package_id)
            sort_col = func.coalesce(rating_subq.c.avg_rating, 0)
        elif sort == "downloads":
            sort_col = Package.downloads_count
        else:
            sort_col = getattr(Package, sort, Package.updated_at)
        if order == "desc":
            query = query.order_by(sort_col.desc())
        else:
            query = query.order_by(sort_col.asc())

        # 分页
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await self.db.execute(query)
        packages = result.scalars().all()

        return {
            "data": packages,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": (total + per_page - 1) // per_page,
            },
        }

    async def get_package(self, scope: str, name: str, current_user: User | None = None) -> Package:
        """获取包详情"""
        # 先查所有（包括已删除），用于区分 404 和 410
        result = await self.db.execute(
            select(Package).where(
                Package.scope == scope,
                Package.name == name,
            )
        )
        package = result.scalar_one_or_none()

        if not package:
            raise AppError(
                code=ErrorCodes.PACKAGE_NOT_FOUND, message=f"Package {scope}/{name} not found", status_code=404
            )

        # 已删除的包返回 410 Gone
        if package.deleted_at:
            raise AppError(
                code=ErrorCodes.PACKAGE_DELETED, message=f"Package {scope}/{name} has been deleted", status_code=410
            )

        # 可见性检查
        if package.visibility == "private":
            if not current_user or package.owner_id != current_user.id:
                raise AppError(
                    code=ErrorCodes.PACKAGE_NOT_FOUND, message=f"Package {scope}/{name} not found", status_code=404
                )

        return package

    async def create_package(
        self,
        name: str,
        scope: str,
        type: str,
        owner_id: str,
        description: str | None = None,
        license: str = "MIT",
        repository: str | None = None,
        homepage: str | None = None,
        visibility: str = "public",
    ) -> Package:
        """创建包"""
        # 检查包名是否已存在
        existing = await self.get_by_full_name(scope, name)
        if existing:
            if existing.deleted_at:
                raise AppError(
                    code=ErrorCodes.PACKAGE_NAME_RESERVED,
                    message=f"Package name {scope}/{name} is taken (deleted package names cannot be re-registered)",
                    status_code=409,
                )
            raise AppError(
                code=ErrorCodes.PACKAGE_ALREADY_EXISTS,
                message=f"Package {scope}/{name} already exists",
                status_code=409,
            )

        # 创建包
        package = Package(
            name=name,
            scope=scope,
            type=type,
            full_name=f"{scope}/{name}",  # SQLite 不支持 GENERATED ALWAYS AS，显式设置
            description=description,
            license=license,
            repository=repository,
            homepage=homepage,
            owner_id=owner_id,
            owner_type="user",
            visibility=visibility,
        )
        self.db.add(package)
        await self.db.commit()
        await self.db.refresh(package)
        return package

    async def get_by_full_name(self, scope: str, name: str) -> Package | None:
        """通过 full_name 获取包"""
        result = await self.db.execute(
            select(Package).where(
                Package.scope == scope,
                Package.name == name,
            )
        )
        return result.scalar_one_or_none()

    async def update_package(
        self,
        scope: str,
        name: str,
        owner_id: str,
        **fields,
    ) -> Package:
        """编辑包 (仅 owner 可操作)

        fields 中的值:
        - 存在且非 None → 更新为该值
        - 存在且为 None → 清空该字段
        - 不存在 → 不修改
        """
        package = await self.get_package(scope, name)

        # 权限检查
        if str(package.owner_id) != str(owner_id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="只有包的所有者才能编辑", status_code=403)

        # 更新字段（None 表示清空）
        for key, value in fields.items():
            if hasattr(package, key):
                setattr(package, key, value)

        await self.db.commit()
        await self.db.refresh(package)
        return package

    async def check_dependencies(self, dependencies: dict[str, str]) -> list[dict]:
        """检查依赖是否存在

        Args:
            dependencies: {"@scope/name": "^1.0.0", ...}

        Returns:
            [{"name": "@scope/name", "constraint": "^1.0.0", "exists": True, "latest_version": "1.2.0"}, ...]
        """
        results = []
        for dep_name, constraint in dependencies.items():
            # 解析 @scope/name 格式
            parts = dep_name.split("/")
            if len(parts) == 2:
                scope, pkg_name = parts
            else:
                # 非标准格式，视为不存在
                results.append(
                    {
                        "name": dep_name,
                        "constraint": constraint,
                        "exists": False,
                        "latest_version": None,
                    }
                )
                continue

            package = await self.get_by_full_name(scope, pkg_name)
            exists = package is not None and package.deleted_at is None
            latest = package.latest_version if exists else None

            results.append(
                {
                    "name": dep_name,
                    "constraint": constraint,
                    "exists": exists,
                    "latest_version": latest,
                }
            )

        return results

    async def get_package_stats(self, scope: str, name: str, current_user: User | None = None) -> dict:
        """获取包下载统计"""
        package = await self.get_package(scope, name, current_user)

        from app.models.download import Download
        from app.models.version import Version

        # 按版本统计下载量（限制 top 50）
        version_stats_query = (
            select(
                Version.version,
                func.count(Download.id).label("downloads"),
            )
            .outerjoin(Download, Download.version_id == Version.id)
            .where(Version.package_id == package.id)
            .group_by(Version.version)
            .order_by(func.count(Download.id).desc())
            .limit(50)
        )
        version_stats_result = await self.db.execute(version_stats_query)
        downloads_by_version = [{"version": row.version, "downloads": row.downloads} for row in version_stats_result]

        return {
            "total_downloads": package.downloads_count,
            "downloads_by_version": downloads_by_version,
        }
