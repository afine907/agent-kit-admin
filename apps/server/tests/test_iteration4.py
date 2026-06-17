"""迭代四功能测试 - 包编辑、排序、废弃、yank、可见性、依赖"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestPackageEdit:
    """包编辑 API (PATCH /packages/:scope/:name)"""

    async def test_edit_description(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """编辑包描述"""
        scope, name = test_package["scope"], test_package["name"]
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={"description": "新的描述"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "新的描述"

    async def test_edit_tags(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """编辑包标签"""
        scope, name = test_package["scope"], test_package["name"]
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={"tags": ["ai", "tool"]},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tags"] == ["ai", "tool"]

    async def test_edit_multiple_fields(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """同时编辑多个字段"""
        scope, name = test_package["scope"], test_package["name"]
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={
                "description": "新描述",
                "tags": ["new-tag"],
                "homepage": "https://example.com",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "新描述"
        assert data["tags"] == ["new-tag"]
        assert data["homepage"] == "https://example.com"

    async def test_edit_unauthorized(self, client: AsyncClient, test_package: dict):
        """未登录不能编辑"""
        scope, name = test_package["scope"], test_package["name"]
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={"description": "hack"},
        )
        assert response.status_code == 401

    async def test_edit_not_owner(self, client: AsyncClient, another_auth_headers: dict, test_package: dict):
        """非 owner 不能编辑"""
        scope, name = test_package["scope"], test_package["name"]
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={"description": "hack"},
            headers=another_auth_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestSearchSort:
    """搜索排序增强"""

    async def test_sort_by_downloads(self, client: AsyncClient, test_package: dict, public_package: dict):
        """按下载量排序"""
        response = await client.get("/api/v1/packages?sort=downloads&order=desc")
        assert response.status_code == 200

    async def test_sort_by_created_at(self, client: AsyncClient, test_package: dict):
        """按创建时间排序"""
        response = await client.get("/api/v1/packages?sort=created_at&order=asc")
        assert response.status_code == 200

    async def test_invalid_sort_field(self, client: AsyncClient):
        """无效排序字段返回 400"""
        response = await client.get("/api/v1/packages?sort=invalid_field")
        assert response.status_code == 400


@pytest.mark.asyncio
class TestVersionDeprecate:
    """版本废弃标记"""

    async def test_deprecate_version(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """标记版本为 deprecated"""
        pkg = test_package_with_version
        response = await client.post(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/deprecate",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["deprecated"] is True

    async def test_undeprecate_version(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """取消废弃标记"""
        pkg = test_package_with_version
        # 先废弃
        await client.post(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/deprecate",
            headers=auth_headers,
        )
        # 取消
        response = await client.delete(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/deprecate",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["deprecated"] is False

    async def test_deprecate_not_owner(self, client: AsyncClient, another_auth_headers: dict, test_package_with_version: dict):
        """非 owner 不能废弃"""
        pkg = test_package_with_version
        response = await client.post(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/deprecate",
            headers=another_auth_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestVersionYank:
    """版本撤回"""

    async def test_yank_version(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """撤回版本"""
        pkg = test_package_with_version
        response = await client.post(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/yank",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["yanked"] is True

    async def test_unyank_version(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """取消撤回"""
        pkg = test_package_with_version
        await client.post(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/yank",
            headers=auth_headers,
        )
        response = await client.delete(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/yank",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["yanked"] is False

    async def test_yank_skips_in_latest(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """yanked 版本不应作为 latest 返回"""
        pkg = test_package_with_version
        # 撤回唯一版本
        await client.post(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/yank",
            headers=auth_headers,
        )
        # 下载最新版本应 404
        response = await client.get(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/download",
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestPackageVisibility:
    """包可见性控制"""

    async def test_private_package_invisible_to_others(
        self, client: AsyncClient, another_auth_headers: dict, private_package: dict
    ):
        """private 包对其他人不可见"""
        scope, name = private_package["scope"], private_package["name"]
        response = await client.get(
            f"/api/v1/packages/{scope}/{name}",
            headers=another_auth_headers,
        )
        assert response.status_code == 404

    async def test_private_package_visible_to_owner(
        self, client: AsyncClient, auth_headers: dict, private_package: dict
    ):
        """private 包对 owner 可见"""
        scope, name = private_package["scope"], private_package["name"]
        response = await client.get(
            f"/api/v1/packages/{scope}/{name}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["visibility"] == "private"

    async def test_private_package_hidden_from_list(
        self, client: AsyncClient, another_auth_headers: dict, private_package: dict
    ):
        """private 包不出现在他人列表中"""
        scope, name = private_package["scope"], private_package["name"]
        response = await client.get("/api/v1/packages", headers=another_auth_headers)
        assert response.status_code == 200
        names = [p["full_name"] for p in response.json()["data"]]
        assert f"{scope}/{name}" not in names

    async def test_change_visibility(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """修改包可见性"""
        scope, name = test_package["scope"], test_package["name"]
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={"visibility": "private"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["visibility"] == "private"


@pytest.mark.asyncio
class TestDependencyCheck:
    """依赖管理（基础）"""

    async def test_version_has_manifest(
        self, client: AsyncClient, test_package_with_version: dict
    ):
        """版本响应中包含 manifest（含 dependencies）"""
        pkg = test_package_with_version
        response = await client.get(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0",
        )
        assert response.status_code == 200
        data = response.json()
        assert "manifest" in data
