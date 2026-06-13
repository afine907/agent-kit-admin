"""包管理服务"""

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.package import Package
from app.models.user import User
from app.errors import AppError, ErrorCodes


class PackageService:
    """包管理服务"""

    ALLOWED_SORT_FIELDS = {"updated_at", "created_at", "name", "downloads", "scope"}

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
                message=f"不支持的排序字段: {sort}，允许的字段: {', '.join(sorted(self.ALLOWED_SORT_FIELDS))}",
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
        sort_column = getattr(Package, sort, Package.updated_at)
        if order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

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
        result = await self.db.execute(
            select(Package).where(
                Package.scope == scope,
                Package.name == name,
                Package.deleted_at.is_(None),
            )
        )
        package = result.scalar_one_or_none()

        if not package:
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message=f"包 {scope}/{name} 不存在", status_code=404)

        # 可见性检查
        if package.visibility == "private":
            if not current_user or package.owner_id != current_user.id:
                raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message=f"包 {scope}/{name} 不存在", status_code=404)

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
                    message=f"包名 {scope}/{name} 已被占用（已删除的包名不可重新注册）",
                    status_code=409,
                )
            raise AppError(
                code=ErrorCodes.PACKAGE_ALREADY_EXISTS,
                message=f"包 {scope}/{name} 已存在",
                status_code=409,
            )

        # 创建包
        package = Package(
            name=name,
            scope=scope,
            type=type,
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
