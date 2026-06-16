"""包下载统计端点测试"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestPackageStats:
    """包下载统计 API 测试"""

    @pytest.mark.asyncio
    async def test_get_package_stats(self, client: AsyncClient, test_package_with_version: dict):
        """测试获取包下载统计"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        response = await client.get(f"/api/v1/packages/{scope}/{name}/stats")

        assert response.status_code == 200
        data = response.json()
        assert "total_downloads" in data
        assert "downloads_by_version" in data
        assert data["total_downloads"] >= 0

    @pytest.mark.asyncio
    async def test_get_package_stats_not_found(self, client: AsyncClient):
        """测试获取不存在的包统计返回 404"""
        response = await client.get("/api/v1/packages/@nonexistent/pkg/stats")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_package_stats_deleted_package(self, client: AsyncClient, deleted_package: dict):
        """测试获取已删除包的统计返回 410"""
        scope = deleted_package["scope"]
        name = deleted_package["name"]

        response = await client.get(f"/api/v1/packages/{scope}/{name}/stats")

        assert response.status_code == 410

    @pytest.mark.asyncio
    async def test_get_package_stats_with_downloads(
        self, client: AsyncClient, test_package_with_version: dict, db: AsyncSession
    ):
        """测试有下载记录时的统计"""
        from app.models.download import Download
        from app.models.package import Package
        from app.models.version import Version

        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        # 获取版本 ID
        from sqlalchemy import select

        package = await db.get(Package, test_package_with_version["id"])
        version_result = await db.execute(select(Version).where(Version.package_id == package.id))
        version = version_result.scalar_one()

        # 模拟下载记录
        for _ in range(5):
            download = Download(
                package_id=package.id,
                version_id=version.id,
            )
            db.add(download)
        package.downloads_count = 5
        await db.flush()

        response = await client.get(f"/api/v1/packages/{scope}/{name}/stats")

        assert response.status_code == 200
        data = response.json()
        assert data["total_downloads"] == 5
