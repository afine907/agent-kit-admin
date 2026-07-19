"""包管理服务 — Workspace 隔离版本"""

import logging

from sqlalchemy import select, func, or_, and_, String
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.package import Package
from app.models.user import User
from app.models.team import TeamMember
from app.errors import AppError, ErrorCodes

logger = logging.getLogger(__name__)


class PackageService:
    """包管理服务"""

    ALLOWED_SORT_FIELDS = {"updated_at", "created_at", "name", "downloads", "scope", "rating"}

    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------------------
    # 辅助方法
    # -------------------------------------------------------------------------

    async def _get_user_team_ids(self, user_id) -> list:
        """获取用户所在所有团队的 ID"""
        result = await self.db.execute(select(TeamMember.team_id).where(TeamMember.user_id == user_id))
        return [row[0] for row in result.fetchall()]

    async def _is_team_member(self, team_id, user_id) -> bool:
        """检查用户是否是团队成员"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def _is_team_admin(self, team_id, user_id) -> bool:
        """检查用户是否是团队 admin/owner"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
                TeamMember.role.in_(["owner", "admin"]),
            )
        )
        return result.scalar_one_or_none() is not None

    async def _get_package_raw(self, scope: str, name: str) -> Package | None:
        """获取包原始记录（含 deleted_at），不抛 404/410"""
        result = await self.db.execute(
            select(Package).where(
                Package.scope == scope,
                Package.name == name,
            )
        )
        return result.scalar_one_or_none()

    async def _can_access_package(self, package: Package, current_user: User | None) -> bool:
        """判断当前用户是否可以访问包"""
        if package.visibility == "public":
            return True

        if not current_user:
            return False

        # user 包：owner_id 是用户 UUID
        if package.owner_type == "user":
            return str(package.owner_id) == str(current_user.id)

        # team 包：owner_id 是团队 UUID
        if package.visibility == "team":
            # team 可见性：任何团队成员可读
            return await self._is_team_member(package.owner_id, current_user.id)

        # visibility == "private" + team 包：仅 owner/admin 可读（不是普通 member）
        return await self._is_team_admin(package.owner_id, current_user.id)

    # -------------------------------------------------------------------------
    # 列表
    # -------------------------------------------------------------------------

    async def list_packages(
        self,
        search: str | None = None,
        type: str | None = None,
        scope: str | None = None,
        category: str | None = None,
        tag: str | None = None,
        sort: str = "updated_at",
        order: str = "desc",
        page: int = 1,
        per_page: int = 20,
        current_user: User | None = None,
    ) -> dict:
        """列出包 (支持搜索、筛选、分页)

        可见性规则:
          public  — 任何人可见
          team    — 仅团队成员可见（owner_type=team 的团队）
          private — 仅包 owner 可见
        """
        if sort not in self.ALLOWED_SORT_FIELDS:
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message=f"Unsupported sort field: {sort}, allowed fields: {', '.join(sorted(self.ALLOWED_SORT_FIELDS))}",
                status_code=400,
            )

        query = select(Package).where(Package.deleted_at.is_(None))

        # --- 可见性过滤 ---
        if current_user:
            user_id = str(current_user.id)
            user_team_ids = await self._get_user_team_ids(user_id)

            conditions = [Package.visibility == "public"]

            # private 包：仅 owner 本人
            conditions.append(
                and_(
                    Package.visibility == "private",
                    Package.owner_id == current_user.id,
                )
            )

            # team 包（owner_type=team）：团队成员 OR owner/admin 本人
            if user_team_ids:
                conditions.append(
                    and_(
                        Package.owner_type == "team",
                        Package.owner_id.in_(user_team_ids),
                    )
                )

            query = query.where(or_(*conditions))
        else:
            query = query.where(Package.visibility == "public")

        # --- 搜索 ---
        if search:
            escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            query = query.where(
                or_(
                    Package.name.ilike(pattern, escape="\\"),
                    Package.description.ilike(pattern, escape="\\"),
                )
            )

        # --- 筛选 ---
        if type:
            query = query.where(Package.type == type)
        if scope:
            query = query.where(Package.scope == scope)
        if category:
            query = query.where(Package.category == category)
        if tag:
            query = query.where(Package.tags.cast(String).contains(f'"{tag}"'))

        # --- 总数 ---
        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        # --- 排序 ---
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

        # --- 分页 ---
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

    # -------------------------------------------------------------------------
    # 详情
    # -------------------------------------------------------------------------

    async def get_package(self, scope: str, name: str, current_user: User | None = None) -> Package:
        """获取包详情（带可见性检查）"""
        package = await self._get_package_raw(scope, name)

        if not package:
            raise AppError(
                code=ErrorCodes.PACKAGE_NOT_FOUND,
                message=f"Package {scope}/{name} not found",
                status_code=404,
            )

        if package.deleted_at:
            raise AppError(
                code=ErrorCodes.PACKAGE_DELETED,
                message=f"Package {scope}/{name} has been deleted",
                status_code=410,
            )

        if not await self._can_access_package(package, current_user):
            raise AppError(
                code=ErrorCodes.PACKAGE_NOT_FOUND,
                message=f"Package {scope}/{name} not found",
                status_code=404,
            )

        return package

    # -------------------------------------------------------------------------
    # 创建
    # -------------------------------------------------------------------------

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
        owner_type: str = "user",
        category: str | None = None,
    ) -> Package:
        """创建包

        Args:
            owner_type: "user" 或 "team"
            visibility: "public", "team", "private"

        权限规则:
            - 创建 @username scope 包：必须是该 username 对应的用户本人
            - 创建 @team-slug scope 包：必须是该团队的成员
        """
        # visibility=team 时 owner_type 必须=team
        if visibility == "team" and owner_type != "team":
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="visibility=team requires owner_type=team",
                status_code=400,
            )

        # scope 格式检查：@ 开头
        if scope.startswith("@"):
            # 解析 scope slug（去掉 @）
            scope_slug = scope[1:]
            # 如果 scope 对应的 owner 不是当前用户，检查团队成员身份
            if str(owner_id) != scope_slug:
                # 非用户 scope，需要验证团队成员身份
                # 先查团队
                from app.models.team import Team

                team_result = await self.db.execute(select(Team).where(Team.slug == scope_slug))
                team_obj = team_result.scalar_one_or_none()
                if team_obj:
                    if not await self._is_team_member(str(team_obj.id), owner_id):
                        raise AppError(
                            code=ErrorCodes.AUTH_FORBIDDEN,
                            message=f"Must be a member of @{scope_slug} to create packages in this scope",
                            status_code=403,
                        )
                # 如果 team 不存在（scope slug 不对），后续唯一约束会报 409

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

        package = Package(
            name=name,
            scope=scope,
            type=type,
            full_name=f"{scope}/{name}",
            description=description,
            license=license,
            repository=repository,
            homepage=homepage,
            owner_id=owner_id,
            owner_type=owner_type,
            visibility=visibility,
            category=category,
        )
        self.db.add(package)
        await self.db.commit()
        await self.db.refresh(package)
        return package

    # -------------------------------------------------------------------------
    # 辅助
    # -------------------------------------------------------------------------

    async def get_by_full_name(self, scope: str, name: str) -> Package | None:
        """通过 full_name 获取包"""
        result = await self.db.execute(
            select(Package).where(
                Package.scope == scope,
                Package.name == name,
            )
        )
        return result.scalar_one_or_none()

    # -------------------------------------------------------------------------
    # 更新
    # -------------------------------------------------------------------------

    async def update_package(
        self,
        scope: str,
        name: str,
        user_id: str,
        **fields,
    ) -> Package:
        """编辑包

        权限规则:
            - user 包：仅 owner 可编辑
            - team 包：owner（用户本人）或 admin/owner 角色的团队成员可编辑
        """
        package = await self._get_package_raw(scope, name)
        if not package or package.deleted_at:
            raise AppError(
                code=ErrorCodes.PACKAGE_NOT_FOUND,
                message=f"Package {scope}/{name} not found",
                status_code=404,
            )

        if package.visibility == "private":
            if str(package.owner_id) != user_id:
                raise AppError(
                    code=ErrorCodes.AUTH_FORBIDDEN,
                    message="Only the package owner can edit this package",
                    status_code=403,
                )
        elif package.visibility == "team" and package.owner_type == "team":
            # team 包：owner 本人或团队 admin/owner 可编辑
            is_owner = str(package.owner_id) == user_id
            is_admin = await self._is_team_admin(package.owner_id, user_id)
            if is_owner or is_admin:
                pass  # 有权限
            elif await self._is_team_member(package.owner_id, user_id):
                # 是团队成员但不是 owner/admin：禁止编辑（403）而非 404（能看到包）
                raise AppError(
                    code=ErrorCodes.AUTH_FORBIDDEN,
                    message="Only team owner or admin can edit this package",
                    status_code=403,
                )
            else:
                # 非团队成员：不可见（404）
                raise AppError(
                    code=ErrorCodes.PACKAGE_NOT_FOUND,
                    message=f"Package {scope}/{name} not found",
                    status_code=404,
                )
        else:
            # public 包：仅 owner
            if str(package.owner_id) != user_id:
                raise AppError(
                    code=ErrorCodes.AUTH_FORBIDDEN,
                    message="Only the package owner can edit this package",
                    status_code=403,
                )

        # 更新字段
        for key, value in fields.items():
            if hasattr(package, key):
                setattr(package, key, value)

        await self.db.commit()
        await self.db.refresh(package)
        return package

    # -------------------------------------------------------------------------
    # 依赖检查
    # -------------------------------------------------------------------------

    async def check_dependencies(self, dependencies: dict[str, str]) -> list[dict]:
        """检查依赖是否存在（不做权限检查，仅检查包是否存在）"""
        results = []
        for dep_name, constraint in dependencies.items():
            parts = dep_name.split("/")
            if len(parts) == 2:
                scope, pkg_name = parts
            else:
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

            # 检查版本约束
            constraint_satisfied = False
            if exists and latest and constraint:
                from app.services.dependency import DependencyResolver

                try:
                    constraint_satisfied = DependencyResolver.check_constraint(latest, constraint)
                except (ValueError, Exception):
                    constraint_satisfied = False

            results.append(
                {
                    "name": dep_name,
                    "constraint": constraint,
                    "exists": exists,
                    "latest_version": latest,
                    "constraint_satisfied": constraint_satisfied if exists else None,
                }
            )

        return results

    # -------------------------------------------------------------------------
    # 统计
    # -------------------------------------------------------------------------

    async def get_package_stats(self, scope: str, name: str, current_user: User | None = None) -> dict:
        """获取包下载统计"""
        package = await self.get_package(scope, name, current_user)

        from app.models.download import Download
        from app.models.version import Version

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

    # --------------------------------------------------------------------------
    # 转移所有权
    # --------------------------------------------------------------------------

    async def transfer_package(
        self,
        scope: str,
        name: str,
        user_id: str,
        new_owner_type: str,  # "user" | "team"
        new_owner_id: str,
        new_scope: str,
    ) -> Package:
        """转移包所有权

        Args:
            scope: 当前 scope（@team 或 @username）
            name: 包名
            user_id: 当前用户 ID
            new_owner_type: "user" | "team"
            new_owner_id: 新 owner 的 UUID
            new_scope: 新的 scope（@username 或 @team-slug）

        规则：
            - 仅当前 owner 可转移（user 包）
            - team 包：owner 用户本人或团队 admin 可转移
            - 禁止转移给自己
            - 新的 (new_scope, name) 组合不能已存在
        """
        # 加行级锁防止并发转移
        result = await self.db.execute(
            select(Package)
            .where(
                Package.scope == scope,
                Package.name == name,
                Package.deleted_at.is_(None),
            )
            .with_for_update()
        )
        package = result.scalar_one_or_none()
        if not package:
            raise AppError(
                code=ErrorCodes.PACKAGE_NOT_FOUND,
                message=f"Package {scope}/{name} not found",
                status_code=404,
            )

        # 权限检查
        if package.owner_type == "team":
            is_owner = str(package.owner_id) == user_id
            is_admin = await self._is_team_admin(package.owner_id, user_id)
            if not (is_owner or is_admin):
                raise AppError(
                    code=ErrorCodes.AUTH_FORBIDDEN,
                    message="Only team owner or admin can transfer this package",
                    status_code=403,
                )
        else:
            if str(package.owner_id) != user_id:
                raise AppError(
                    code=ErrorCodes.AUTH_FORBIDDEN,
                    message="Only the package owner can transfer this package",
                    status_code=403,
                )

        # 不能转移给自己
        if str(package.owner_id) == new_owner_id and package.scope == new_scope:
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="Cannot transfer package to its current owner",
                status_code=400,
            )

        # 验证目标存在
        if new_owner_type == "user":
            result = await self.db.execute(select(User).where(User.id == new_owner_id))
            if not result.scalar_one_or_none():
                raise AppError(
                    code=ErrorCodes.NOT_FOUND,
                    message="Target user not found",
                    status_code=404,
                )
        else:  # team
            from app.models.team import Team

            result = await self.db.execute(select(Team).where(Team.id == new_owner_id))
            if not result.scalar_one_or_none():
                raise AppError(
                    code=ErrorCodes.NOT_FOUND,
                    message="Target team not found",
                    status_code=404,
                )

        # 检查目标 scope+name 是否已被占用（加锁防止 TOCTOU）
        existing = await self.db.execute(
            select(Package)
            .where(
                Package.scope == new_scope,
                Package.name == name,
                Package.deleted_at.is_(None),
            )
            .with_for_update()
        )
        if existing.scalar_one_or_none():
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message=f"Package @{new_scope}/{name} already exists",
                status_code=409,
            )

        # 执行转移
        old_owner_id = str(package.owner_id)
        old_scope = package.scope
        package.owner_id = new_owner_id
        package.owner_type = new_owner_type
        package.scope = new_scope
        package.full_name = f"{new_scope}/{name}"

        await self.db.flush()
        await self.db.refresh(package)

        logger.info(
            "package_transfer",
            extra={
                "package": name,
                "old_owner": old_owner_id,
                "old_scope": old_scope,
                "new_owner": new_owner_id,
                "new_scope": new_scope,
                "actor": user_id,
            },
        )

        return package

    # --------------------------------------------------------------------------
    # 批量操作
    # --------------------------------------------------------------------------

    async def _can_write_package(self, package: Package, user_id: str) -> bool:
        """检查用户是否有写权限"""
        if package.owner_type == "team":
            is_owner = str(package.owner_id) == user_id
            is_admin = await self._is_team_admin(package.owner_id, user_id)
            return is_owner or is_admin
        else:
            return str(package.owner_id) == user_id

    async def batch_delete_packages(
        self,
        package_names: list[str],
        user_id: str,
    ) -> tuple[list[str], list[dict]]:
        """批量删除包

        Returns (success_names, failed_list)
        """
        from datetime import datetime, timezone

        success = []
        failed = []
        for full_name in package_names:
            try:
                # 解析 scope/name
                if "/" not in full_name:
                    failed.append({"name": full_name, "error": "Invalid format, expected @scope/name"})
                    continue
                scope, name = full_name.split("/", 1)

                package = await self._get_package_raw(scope, name)
                if not package or package.deleted_at:
                    failed.append({"name": full_name, "error": "Package not found"})
                    continue

                if not await self._can_write_package(package, user_id):
                    failed.append({"name": full_name, "error": "Permission denied"})
                    continue

                package.deleted_at = datetime.now(timezone.utc)
                success.append(full_name)
            except Exception as e:
                failed.append({"name": full_name, "error": str(e)})

        await self.db.flush()
        return success, failed

    async def batch_deprecate_packages(
        self,
        package_names: list[str],
        user_id: str,
        deprecated: bool,
    ) -> tuple[list[str], list[dict]]:
        """批量废弃/取消废弃包

        Returns (success_names, failed_list)
        """
        success = []
        failed = []
        for full_name in package_names:
            try:
                if "/" not in full_name:
                    failed.append({"name": full_name, "error": "Invalid format, expected @scope/name"})
                    continue
                scope, name = full_name.split("/", 1)

                package = await self._get_package_raw(scope, name)
                if not package or package.deleted_at:
                    failed.append({"name": full_name, "error": "Package not found"})
                    continue

                if not await self._can_write_package(package, user_id):
                    failed.append({"name": full_name, "error": "Permission denied"})
                    continue

                # 标记所有版本为 deprecated
                from app.models.version import Version

                result = await self.db.execute(select(Version).where(Version.package_id == package.id))
                for ver in result.scalars().all():
                    ver.deprecated = deprecated
                success.append(full_name)
            except Exception as e:
                failed.append({"name": full_name, "error": str(e)})

        await self.db.flush()
        return success, failed
