"""团队包管理服务

基于 docs/specs/team-skill-management.md 实现：
  - 团队包列表（含成员安装状态）
  - 团队包发布/更新/删除
  - 版本管理
  - 安装状态追踪
"""

import base64
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.package import Package
from app.models.version import Version
from app.models.team import Team, TeamMember
from app.models.installed_package import InstalledPackage
from app.services.storage import get_storage_service
from packaging.version import parse as parse_version

from app.errors import AppError, ErrorCodes


class TeamPackageService:
    """团队包管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------------------
    # 辅助方法
    # -------------------------------------------------------------------------

    async def _get_member(self, team_id: str, user_id: str) -> TeamMember | None:
        """获取成员记录"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def _is_member(self, team_id: str, user_id: str) -> bool:
        """检查是否为团队成员"""
        return await self._get_member(team_id, user_id) is not None

    async def _get_team(self, team_id: str) -> Team:
        """获取团队，不存在则抛 404"""
        team = await self.db.get(Team, team_id)
        if not team:
            raise AppError(code=ErrorCodes.NOT_FOUND, message=f"Team {team_id} not found", status_code=404)
        return team

    async def _get_package(self, package_id: str) -> Package | None:
        """获取包（含 deleted 检查）"""
        result = await self.db.execute(select(Package).where(Package.id == package_id))
        return result.scalar_one_or_none()

    async def _get_user_installed(self, user_id: str, package_ids: list[str]) -> dict[str, InstalledPackage]:
        """批量获取用户的安装记录"""
        if not package_ids:
            return {}
        result = await self.db.execute(
            select(InstalledPackage).where(
                InstalledPackage.user_id == user_id,
                InstalledPackage.package_id.in_(package_ids),
            )
        )
        rows = result.scalars().all()
        return {str(row.package_id): row for row in rows}

    def _build_package_response(
        self,
        pkg: Package,
        installed: InstalledPackage | None,
    ) -> dict:
        """构造包响应（含安装状态）"""
        installed_version = str(installed.version_installed) if installed else None
        has_update = (
            installed_version is not None and pkg.latest_version is not None and installed_version != pkg.latest_version
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
            "my_installed_version": installed_version,
            "has_update": has_update,
        }

    # -------------------------------------------------------------------------
    # 列表
    # -------------------------------------------------------------------------

    async def list_team_packages(self, team_id: str, user_id: str) -> list[dict]:
        """列出团队所有包（含当前用户的安装状态）"""
        # 验证团队存在且用户是成员
        await self._get_team(team_id)
        if not await self._is_member(team_id, user_id):
            raise AppError(
                code=ErrorCodes.AUTH_FORBIDDEN,
                message="You must be a team member to view team packages",
                status_code=403,
            )

        # 查团队所有包（owner_type=team 且 owner_id=team_id）
        result = await self.db.execute(
            select(Package).where(
                Package.owner_type == "team",
                Package.owner_id == team_id,
                Package.deleted_at.is_(None),
            )
        )
        packages = result.scalars().all()

        # 批量获取安装状态
        package_ids = [str(p.id) for p in packages]
        installed_map = await self._get_user_installed(user_id, package_ids)

        return [self._build_package_response(pkg, installed_map.get(str(pkg.id))) for pkg in packages]

    # -------------------------------------------------------------------------
    # 详情
    # -------------------------------------------------------------------------

    async def get_package(self, team_id: str, package_id: str, user_id: str) -> dict:
        """获取团队包详情"""
        await self._get_team(team_id)
        if not await self._is_member(team_id, user_id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not a team member", status_code=403)

        pkg = await self._get_package(package_id)
        if not pkg or pkg.deleted_at:
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found", status_code=404)
        if str(pkg.owner_id) != team_id or pkg.owner_type != "team":
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found in this team", status_code=404)

        # 获取安装状态
        installed_result = await self.db.execute(
            select(InstalledPackage).where(
                InstalledPackage.user_id == user_id,
                InstalledPackage.package_id == package_id,
            )
        )
        installed = installed_result.scalar_one_or_none()

        return self._build_package_response(pkg, installed)

    # -------------------------------------------------------------------------
    # 发布
    # -------------------------------------------------------------------------

    async def publish_package(
        self,
        team_id: str,
        user_id: str,
        name: str,
        type: str,
        description: str | None = None,
        manifest: dict | None = None,
        tarball_b64: str | None = None,
    ) -> Package:
        """发布新包到团队（任何成员都可以发布，MVP 阶段）"""
        team = await self._get_team(team_id)
        if not await self._is_member(team_id, user_id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not a team member", status_code=403)

        # scope = @team-slug
        scope = f"@{team.slug}"

        # 检查包名是否已存在
        existing = await self.db.execute(select(Package).where(Package.scope == scope, Package.name == name))
        existing_pkg = existing.scalar_one_or_none()
        if existing_pkg:
            if existing_pkg.deleted_at:
                raise AppError(
                    code=ErrorCodes.PACKAGE_NAME_RESERVED,
                    message=f"Package name {scope}/{name} is reserved (deleted package)",
                    status_code=409,
                )
            raise AppError(
                code=ErrorCodes.PACKAGE_ALREADY_EXISTS,
                message=f"Package {scope}/{name} already exists",
                status_code=409,
            )

        # 解析版本
        version_str = "v0.1.0"
        if manifest and "version" in manifest:
            v = manifest["version"]
            version_str = v if v.startswith("v") else f"v{v}"

        # 上传 tarball（如有）
        tarball_path = None
        tarball_hash = None
        tarball_size = 0
        if tarball_b64:
            try:
                tarball_data = base64.b64decode(tarball_b64)
            except Exception:
                raise AppError(code=ErrorCodes.INVALID_PARAM, message="Invalid tarball encoding", status_code=400)
            storage = get_storage_service()
            tarball_path, tarball_hash = await storage.upload_tarball(scope, name, version_str, tarball_data)
            tarball_size = len(tarball_data)

        # 创建包
        pkg = Package(
            name=name,
            scope=scope,
            full_name=f"{scope}/{name}",
            type=type,
            description=description,
            owner_id=team_id,
            owner_type="team",
            visibility="team",
            latest_version=version_str,
        )
        self.db.add(pkg)
        await self.db.flush()
        await self.db.refresh(pkg)

        # 创建第一个版本
        ver = Version(
            package_id=pkg.id,
            version=version_str,
            manifest=manifest or {},
            tarball_hash=tarball_hash or "",
            tarball_size=tarball_size,
            tarball_path=tarball_path or "",
            tag="latest",
            published_by=user_id,
        )
        self.db.add(ver)
        await self.db.commit()
        await self.db.refresh(pkg)
        return pkg

    # -------------------------------------------------------------------------
    # 发布新版本
    # -------------------------------------------------------------------------

    async def publish_version(
        self,
        team_id: str,
        package_id: str,
        user_id: str,
        version: str,
        manifest: dict | None = None,
        tarball_b64: str | None = None,
    ) -> Version:
        """发布新版本"""
        await self._get_team(team_id)
        if not await self._is_member(team_id, user_id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not a team member", status_code=403)

        pkg = await self._get_package(package_id)
        if not pkg or pkg.deleted_at:
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found", status_code=404)
        if str(pkg.owner_id) != team_id or pkg.owner_type != "team":
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found in this team", status_code=404)

        # 检查版本是否已存在
        existing = await self.db.execute(
            select(Version).where(Version.package_id == package_id, Version.version == version)
        )
        if existing.scalar_one_or_none():
            raise AppError(
                code=ErrorCodes.VERSION_ALREADY_EXISTS,
                message=f"Version {version} already exists",
                status_code=409,
            )

        # 上传 tarball
        tarball_path = None
        tarball_hash = None
        tarball_size = 0
        if tarball_b64:
            try:
                tarball_data = base64.b64decode(tarball_b64)
            except Exception:
                raise AppError(code=ErrorCodes.INVALID_PARAM, message="Invalid tarball encoding", status_code=400)
            storage = get_storage_service()
            tarball_path, tarball_hash = await storage.upload_tarball(pkg.scope, pkg.name, version, tarball_data)
            tarball_size = len(tarball_data)

        # 更新 latest_version（如果版本号更大）
        try:
            if parse_version(version) > parse_version(pkg.latest_version or "v0.0.0"):
                pkg.latest_version = version
        except Exception:
            # fallback: 语义版本解析失败时用字符串比较
            if version > (pkg.latest_version or ""):
                pkg.latest_version = version

        # 创建版本
        ver = Version(
            package_id=pkg.id,
            version=version,
            manifest=manifest or {},
            tarball_hash=tarball_hash or "",
            tarball_size=tarball_size,
            tarball_path=tarball_path or "",
            tag="latest",
            published_by=user_id,
        )
        self.db.add(ver)
        await self.db.commit()
        await self.db.refresh(ver)
        return ver

    # -------------------------------------------------------------------------
    # 版本列表
    # -------------------------------------------------------------------------

    async def get_latest_version(self, team_id: str, package_id: str, user_id: str) -> Version | None:
        """获取包的最新版本"""
        await self._get_team(team_id)
        if not await self._is_member(team_id, user_id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not a team member", status_code=403)

        pkg = await self._get_package(package_id)
        if not pkg or pkg.deleted_at:
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found", status_code=404)
        if str(pkg.owner_id) != team_id or pkg.owner_type != "team":
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found in this team", status_code=404)

        versions = await self.db.execute(
            select(Version)
            .where(Version.package_id == package_id)
            .order_by(Version.published_at.desc())
        )
        return versions.scalars().first()

    async def get_version_by_tag(self, team_id: str, package_id: str, user_id: str, tag: str) -> Version | None:
        """按 tag 或 version 获取版本"""
        await self._get_team(team_id)
        if not await self._is_member(team_id, user_id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not a team member", status_code=403)

        pkg = await self._get_package(package_id)
        if not pkg or pkg.deleted_at:
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found", status_code=404)
        if str(pkg.owner_id) != team_id or pkg.owner_type != "team":
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found in this team", status_code=404)

        # tag=latest 或具体 version
        if tag == "latest":
            return await self.get_latest_version(team_id, package_id, user_id)

        result = await self.db.execute(
            select(Version).where(Version.package_id == package_id, Version.version == tag)
        )
        return result.scalars().first()

    async def list_versions(self, team_id: str, package_id: str, user_id: str) -> tuple[list[Version], int]:
        """列出包的所有版本"""
        await self._get_team(team_id)
        if not await self._is_member(team_id, user_id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not a team member", status_code=403)

        pkg = await self._get_package(package_id)
        if not pkg or pkg.deleted_at:
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found", status_code=404)
        if str(pkg.owner_id) != team_id or pkg.owner_type != "team":
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found in this team", status_code=404)

        result = await self.db.execute(
            select(Version).where(Version.package_id == package_id).order_by(Version.published_at.desc())
        )
        versions = result.scalars().all()
        return list(versions), len(versions)

    # -------------------------------------------------------------------------
    # 安装
    # -------------------------------------------------------------------------

    async def install_package(
        self,
        team_id: str,
        package_id: str,
        user_id: str,
    ) -> InstalledPackage:
        """安装团队包（记录到 InstalledPackage）"""
        await self._get_team(team_id)
        if not await self._is_member(team_id, user_id):
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not a team member", status_code=403)

        pkg = await self._get_package(package_id)
        if not pkg or pkg.deleted_at:
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found", status_code=404)
        if str(pkg.owner_id) != team_id or pkg.owner_type != "team":
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found in this team", status_code=404)

        version_str = pkg.latest_version or "v0.0.0"

        # 检查是否已安装
        existing = await self.db.execute(
            select(InstalledPackage).where(
                InstalledPackage.user_id == user_id,
                InstalledPackage.package_id == package_id,
            )
        )
        existing_record = existing.scalar_one_or_none()
        if existing_record:
            existing_record.version_installed = version_str
            await self.db.commit()
            await self.db.refresh(existing_record)
            return existing_record

        # 新建安装记录
        installed = InstalledPackage(
            user_id=user_id,
            package_id=package_id,
            version_installed=version_str,
        )
        self.db.add(installed)
        await self.db.commit()
        await self.db.refresh(installed)
        return installed

    # -------------------------------------------------------------------------
    # 我的已安装包
    # -------------------------------------------------------------------------

    async def list_installed(self, user_id: str, team_id: str | None = None) -> list[dict]:
        """列出用户已安装的包（可按 team_id 筛选）"""
        query = select(InstalledPackage).where(InstalledPackage.user_id == user_id)
        if team_id:
            query = query.join(Package, InstalledPackage.package_id == Package.id).where(
                Package.owner_type == "team",
                Package.owner_id == team_id,
                Package.deleted_at.is_(None),
            )
        result = await self.db.execute(query)
        records = result.scalars().all()

        # 批量获取包信息
        pkg_ids = [str(r.package_id) for r in records]
        pkg_result = await self.db.execute(select(Package).where(Package.id.in_(pkg_ids)))
        packages = {str(p.id): p for p in pkg_result.scalars().all()}

        response = []
        for rec in records:
            pkg = packages.get(str(rec.package_id))
            if not pkg:
                continue
            has_update = pkg.latest_version is not None and str(rec.version_installed) != pkg.latest_version
            response.append(
                {
                    "package_id": str(rec.package_id),
                    "version_installed": str(rec.version_installed),
                    "installed_at": str(rec.installed_at),
                    "package_name": pkg.name,
                    "package_scope": pkg.scope,
                    "package_type": pkg.type,
                    "latest_version": pkg.latest_version,
                    "has_update": has_update,
                }
            )
        return response

    # -------------------------------------------------------------------------
    # 删除包
    # -------------------------------------------------------------------------

    async def delete_package(self, team_id: str, package_id: str, user_id: str) -> None:
        """删除团队包（仅 owner/admin）"""
        await self._get_team(team_id)
        member = await self._get_member(team_id, user_id)
        if not member:
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not a team member", status_code=403)
        if member.role not in ("owner", "admin"):
            raise AppError(
                code=ErrorCodes.AUTH_FORBIDDEN, message="Only owner or admin can delete packages", status_code=403
            )

        pkg = await self._get_package(package_id)
        if not pkg or pkg.deleted_at:
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found", status_code=404)
        if str(pkg.owner_id) != team_id or pkg.owner_type != "team":
            raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="Package not found in this team", status_code=404)

        # 软删除
        from datetime import datetime, timezone

        pkg.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
