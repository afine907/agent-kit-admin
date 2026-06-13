"""管理员包管理 API 测试 - TDD"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.package import Package


class TestAdminPackageList:
    """管理员包列表测试"""

    @pytest.mark.asyncio
    async def test_admin_can_list_all_packages(self, client: AsyncClient, admin_headers: dict, test_package: dict, deleted_package: dict):
        """管理员可以查看所有包（含已删除）"""
        response = await client.get("/api/v1/admin/packages", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    @pytest.mark.asyncio
    async def test_admin_can_include_deleted(self, client: AsyncClient, admin_headers: dict, deleted_package: dict):
        """管理员可以查看已删除的包"""
        response = await client.get("/api/v1/admin/packages?include_deleted=true", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        # 应该包含已删除的包
        package_ids = [p["id"] for p in data["data"]]
        assert deleted_package["id"] in package_ids

    @pytest.mark.asyncio
    async def test_member_cannot_list_admin_packages(self, client: AsyncClient, auth_headers: dict):
        """普通成员不能访问管理员包列表"""
        response = await client.get("/api/v1/admin/packages", headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_list_packages_with_type_filter(self, client: AsyncClient, admin_headers: dict, test_package: dict):
        """按类型筛选包"""
        response = await client.get("/api/v1/admin/packages?type=mcp", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        for pkg in data["data"]:
            assert pkg["type"] == "mcp"

    @pytest.mark.asyncio
    async def test_admin_list_packages_pagination(self, client: AsyncClient, admin_headers: dict, multiple_packages: list):
        """包列表分页"""
        response = await client.get("/api/v1/admin/packages?page=1&per_page=2", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) <= 2


class TestAdminPackageStatus:
    """管理员包状态管理测试"""

    @pytest.mark.asyncio
    async def test_admin_can_suspend_package(self, client: AsyncClient, admin_headers: dict, test_package: dict, db: AsyncSession):
        """管理员可以下架包"""
        response = await client.patch(
            f"/api/v1/admin/packages/{test_package['id']}/status",
            headers=admin_headers,
            json={"status": "suspended", "reason": "违规内容"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "suspended"

        # 验证数据库
        pkg = await db.get(Package, test_package["id"])
        assert pkg.admin_status == "suspended"

    @pytest.mark.asyncio
    async def test_admin_can_restore_package(self, client: AsyncClient, admin_headers: dict, test_package: dict, db: AsyncSession):
        """管理员可以恢复包"""
        # 先下架
        await client.patch(
            f"/api/v1/admin/packages/{test_package['id']}/status",
            headers=admin_headers,
            json={"status": "suspended"},
        )

        # 再恢复
        response = await client.patch(
            f"/api/v1/admin/packages/{test_package['id']}/status",
            headers=admin_headers,
            json={"status": "active"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_member_cannot_suspend_package(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """普通成员不能下架包"""
        response = await client.patch(
            f"/api/v1/admin/packages/{test_package['id']}/status",
            headers=auth_headers,
            json={"status": "suspended"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_status_value(self, client: AsyncClient, admin_headers: dict, test_package: dict):
        """无效的状态值应返回 422"""
        response = await client.patch(
            f"/api/v1/admin/packages/{test_package['id']}/status",
            headers=admin_headers,
            json={"status": "invalid"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_suspend_nonexistent_package(self, client: AsyncClient, admin_headers: dict):
        """下架不存在的包应返回 404"""
        response = await client.patch(
            "/api/v1/admin/packages/nonexistent-id/status",
            headers=admin_headers,
            json={"status": "suspended"},
        )
        assert response.status_code == 404


class TestAdminPackageDelete:
    """管理员包删除测试（硬删除，仅 super_admin）"""

    @pytest.mark.asyncio
    async def test_super_admin_can_hard_delete_package(self, client: AsyncClient, super_admin_headers: dict, test_package: dict, db: AsyncSession):
        """超级管理员可以硬删除包"""
        response = await client.delete(
            f"/api/v1/admin/packages/{test_package['id']}",
            headers=super_admin_headers,
        )
        assert response.status_code == 200

        # 验证硬删除
        pkg = await db.get(Package, test_package["id"])
        assert pkg is None

    @pytest.mark.asyncio
    async def test_admin_cannot_hard_delete_package(self, client: AsyncClient, admin_headers: dict, test_package: dict):
        """普通管理员不能硬删除包"""
        response = await client.delete(
            f"/api/v1/admin/packages/{test_package['id']}",
            headers=admin_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_hard_delete_nonexistent_package(self, client: AsyncClient, super_admin_headers: dict):
        """删除不存在的包应返回 404"""
        response = await client.delete(
            "/api/v1/admin/packages/nonexistent-id",
            headers=super_admin_headers,
        )
        assert response.status_code == 404
