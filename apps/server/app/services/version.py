"""版本管理服务"""

import re
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.version import Version
from app.models.package import Package
from app.services.storage import get_storage_service
from app.errors import AppError, ErrorCodes


# Semver 正则表达式
SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(-((0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$"
)

# Pre-release 版本正则
PRERELEASE_PATTERN = re.compile(r"-[a-zA-Z]")


class VersionService:
    """版本管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_versions(self, package_id: str) -> list[Version]:
        """列出版本"""
        result = await self.db.execute(
            select(Version).where(Version.package_id == package_id).order_by(Version.published_at.desc())
        )
        return list(result.scalars().all())

    async def get_version(self, package_id: str, version: str) -> Version | None:
        """获取指定版本"""
        result = await self.db.execute(
            select(Version).where(
                Version.package_id == package_id,
                Version.version == version,
            )
        )
        return result.scalar_one_or_none()

    async def get_latest_version(self, package_id: str) -> Version | None:
        """获取最新版本"""
        result = await self.db.execute(
            select(Version)
            .where(
                Version.package_id == package_id,
                Version.yanked.is_(False),
            )
            .order_by(Version.published_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _prepare_version(
        self,
        package_id: str,
        version: str,
        manifest: dict,
    ) -> tuple[Package, dict]:
        """准备版本发布 - 公共验证逻辑

        验证版本号、manifest，处理 Skill content。
        返回 (package, processed_manifest)。
        """
        # 验证版本号格式
        if not SEMVER_PATTERN.match(version):
            raise AppError(
                code=ErrorCodes.VERSION_INVALID_SEMVER,
                message=f"无效的版本号: {version}",
                status_code=400,
            )

        # 检查版本号是否已存在
        existing = await self.get_version(package_id, version)
        if existing:
            raise AppError(
                code=ErrorCodes.VERSION_ALREADY_EXISTS,
                message=f"版本 {version} 已存在",
                status_code=409,
            )

        # 验证 manifest
        self._validate_manifest(manifest)

        # 处理 Skill content 存储
        if manifest.get("type") == "skill" and "skill" in manifest:
            content = manifest["skill"].get("content", "")
            content_size = len(content.encode("utf-8"))

            if content_size > 50 * 1024:  # > 50KB
                raise AppError(
                    code=ErrorCodes.VERSION_CONTENT_TOO_LARGE,
                    message="Skill content 超过 50KB 限制",
                    status_code=400,
                )

            if content_size > 10 * 1024:  # > 10KB，存储到 MinIO
                storage = get_storage_service()
                content_path = f"skills/{package_id}/{version}/content.md"
                await storage.upload_content(content_path, content.encode("utf-8"))
                manifest["skill"]["content_url"] = content_path
                del manifest["skill"]["content"]

        # 获取包
        package = await self.db.get(Package, package_id)
        if not package:
            raise AppError(
                code=ErrorCodes.PACKAGE_NOT_FOUND,
                message=f"包不存在: {package_id}",
                status_code=404,
            )

        return package, manifest

    async def _determine_tag(self, package_id: str, version: str, tag: str | None) -> str | None:
        """确定版本 tag"""
        is_prerelease = bool(PRERELEASE_PATTERN.search(version))
        if not tag:
            latest = await self.get_latest_version(package_id)
            if not latest or not is_prerelease:
                tag = "latest"
        return tag

    async def _finalize_version(
        self,
        package: Package,
        version: str,
        manifest: dict,
        tarball_path: str,
        tarball_hash: str,
        tarball_size: int,
        tag: str | None,
        published_by: str | None,
    ) -> Version:
        """完成版本发布 - 创建记录并提交"""
        # 创建版本记录
        ver = Version(
            package_id=str(package.id),
            version=version,
            manifest=manifest,
            tarball_hash=tarball_hash,
            tarball_size=tarball_size,
            tarball_path=tarball_path,
            tag=tag,
            published_by=published_by,
        )
        self.db.add(ver)

        # 更新包的 latest_version
        if tag == "latest":
            package.latest_version = version  # type: ignore[assignment]

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise AppError(
                code=ErrorCodes.VERSION_ALREADY_EXISTS,
                message=f"版本 {version} 已存在",
                status_code=409,
            )

        await self.db.refresh(ver)
        return ver

    async def publish_version(
        self,
        package_id: str,
        version: str,
        manifest: dict,
        tarball_data: bytes,
        tag: str | None = None,
        published_by: str | None = None,
    ) -> Version:
        """发布新版本 - 同步上传"""
        package, manifest = await self._prepare_version(package_id, version, manifest)

        # 上传 tarball 到 MinIO
        storage = get_storage_service()
        tarball_path, tarball_hash = await storage.upload_tarball(
            scope=str(package.scope),
            name=str(package.name),
            version=version,
            data=tarball_data,
        )

        tag = await self._determine_tag(package_id, version, tag)

        return await self._finalize_version(
            package=package,
            version=version,
            manifest=manifest,
            tarball_path=tarball_path,
            tarball_hash=tarball_hash,
            tarball_size=len(tarball_data),
            tag=tag,
            published_by=published_by,
        )

    async def publish_version_streaming(
        self,
        package_id: str,
        version: str,
        manifest: dict,
        tarball_file: UploadFile,
        tag: str | None = None,
        published_by: str | None = None,
    ) -> Version:
        """发布新版本 - 流式上传

        使用流式上传避免将整个 tarball 读入内存。
        大文件 (>10MB) 会临时落盘，显著减少内存压力。
        """
        package, manifest = await self._prepare_version(package_id, version, manifest)

        # 流式上传 tarball 到 MinIO
        storage = get_storage_service()
        tarball_path, tarball_hash, tarball_size = await storage.upload_tarball_streaming(
            scope=str(package.scope),
            name=str(package.name),
            version=version,
            file=tarball_file,
        )

        tag = await self._determine_tag(package_id, version, tag)

        return await self._finalize_version(
            package=package,
            version=version,
            manifest=manifest,
            tarball_path=tarball_path,
            tarball_hash=tarball_hash,
            tarball_size=tarball_size,
            tag=tag,
            published_by=published_by,
        )

    def _validate_manifest(self, manifest: dict) -> None:
        """验证 manifest 格式"""
        # 检查必填字段
        required = ["name", "version", "type"]
        for field in required:
            if field not in manifest:
                raise AppError(
                    code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
                    message=f"manifest 缺少必填字段: {field}",
                    status_code=400,
                )

        # 检查类型
        if manifest["type"] not in ("mcp", "skill"):
            raise AppError(
                code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
                message="type 必须是 mcp 或 skill",
                status_code=400,
            )

        # MCP 包必须有 mcp 配置
        if manifest["type"] == "mcp" and "mcp" not in manifest:
            raise AppError(
                code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
                message="MCP 包必须包含 mcp 配置",
                status_code=400,
            )

        # Skill 包必须有 skill 配置
        if manifest["type"] == "skill" and "skill" not in manifest:
            raise AppError(
                code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
                message="Skill 包必须包含 skill 配置",
                status_code=400,
            )

        # MCP transport 验证
        if manifest["type"] == "mcp":
            mcp = manifest["mcp"]
            if "transport" not in mcp:
                raise AppError(
                    code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
                    message="mcp 配置必须包含 transport",
                    status_code=400,
                )
            if mcp["transport"] not in ("stdio", "sse", "streamable-http"):
                raise AppError(
                    code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
                    message="transport 必须是 stdio、sse 或 streamable-http",
                    status_code=400,
                )
            if "command" not in mcp:
                raise AppError(
                    code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
                    message="mcp 配置必须包含 command",
                    status_code=400,
                )

        # Skill content 验证
        if manifest["type"] == "skill":
            skill = manifest["skill"]
            if "content" not in skill:
                raise AppError(
                    code=ErrorCodes.PACKAGE_INVALID_MANIFEST,
                    message="skill 配置必须包含 content",
                    status_code=400,
                )
