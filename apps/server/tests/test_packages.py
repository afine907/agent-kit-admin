"""包管理 API 测试"""

import pytest
from httpx import AsyncClient


class TestPackageList:
    """包列表测试"""

    @pytest.mark.asyncio
    async def test_list_packages_empty(self, client: AsyncClient):
        """测试空列表"""
        response = await client.get("/api/v1/packages")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert isinstance(data["data"], list)
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["per_page"] == 20

    @pytest.mark.asyncio
    async def test_list_packages_with_data(self, client: AsyncClient, multiple_packages: list):
        """测试有数据的列表"""
        response = await client.get("/api/v1/packages")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) > 0
        assert data["pagination"]["total"] > 0

    @pytest.mark.asyncio
    async def test_list_packages_filter_by_type_mcp(self, client: AsyncClient, multiple_packages: list):
        """测试按类型筛选 - MCP"""
        response = await client.get("/api/v1/packages?type=mcp")
        assert response.status_code == 200
        data = response.json()
        for pkg in data["data"]:
            assert pkg["type"] == "mcp"

    @pytest.mark.asyncio
    async def test_list_packages_filter_by_type_skill(self, client: AsyncClient, multiple_packages: list):
        """测试按类型筛选 - Skill"""
        response = await client.get("/api/v1/packages?type=skill")
        assert response.status_code == 200
        data = response.json()
        for pkg in data["data"]:
            assert pkg["type"] == "skill"

    @pytest.mark.asyncio
    async def test_list_packages_search(self, client: AsyncClient, multiple_packages: list):
        """测试搜索"""
        response = await client.get("/api/v1/packages?search=package-0")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) > 0
        # 验证搜索结果包含关键词
        for pkg in data["data"]:
            assert "package-0" in pkg["name"] or "package-0" in pkg.get("description", "")

    @pytest.mark.asyncio
    async def test_list_packages_search_no_results(self, client: AsyncClient):
        """测试搜索无结果"""
        response = await client.get("/api/v1/packages?search=nonexistent")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 0
        assert data["pagination"]["total"] == 0

    @pytest.mark.asyncio
    async def test_list_packages_pagination(self, client: AsyncClient, multiple_packages: list):
        """测试分页"""
        response = await client.get("/api/v1/packages?page=1&per_page=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) <= 2
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["per_page"] == 2

    @pytest.mark.asyncio
    async def test_list_packages_second_page(self, client: AsyncClient, multiple_packages: list):
        """测试第二页"""
        response = await client.get("/api/v1/packages?page=2&per_page=2")
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["page"] == 2

    @pytest.mark.asyncio
    async def test_list_packages_excludes_deleted(self, client: AsyncClient, deleted_package: dict):
        """测试不包含已删除的包"""
        response = await client.get("/api/v1/packages")
        assert response.status_code == 200
        data = response.json()
        # 已删除的包不应该出现在列表中
        for pkg in data["data"]:
            assert pkg["name"] != deleted_package["name"]

    @pytest.mark.asyncio
    async def test_list_packages_default_sort(self, client: AsyncClient, multiple_packages: list):
        """测试默认排序"""
        response = await client.get("/api/v1/packages")
        assert response.status_code == 200
        data = response.json()
        # 验证按更新时间排序
        if len(data["data"]) > 1:
            for i in range(len(data["data"]) - 1):
                assert data["data"][i]["updated_at"] >= data["data"][i + 1]["updated_at"]


class TestPackageDetail:
    """包详情测试"""

    @pytest.mark.asyncio
    async def test_get_package_success(self, client: AsyncClient, test_package: dict):
        """测试获取包详情"""
        scope = test_package["scope"]
        name = test_package["name"]
        response = await client.get(f"/api/v1/packages/{scope}/{name}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == name
        assert data["scope"] == scope
        assert data["full_name"] == f"{scope}/{name}"
        assert data["type"] == test_package["type"]

    @pytest.mark.asyncio
    async def test_get_package_not_found(self, client: AsyncClient):
        """测试获取不存在的包"""
        response = await client.get("/api/v1/packages/@nonexist/nope")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == 20003

    @pytest.mark.asyncio
    async def test_get_package_deleted(self, client: AsyncClient, deleted_package: dict):
        """测试获取已删除的包"""
        scope = deleted_package["scope"]
        name = deleted_package["name"]
        response = await client.get(f"/api/v1/packages/{scope}/{name}")
        assert response.status_code == 410
        data = response.json()
        assert data["error"]["code"] == 20005

    @pytest.mark.asyncio
    async def test_get_package_with_versions(self, client: AsyncClient, test_package_with_version: dict):
        """测试获取带版本的包详情"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]
        response = await client.get(f"/api/v1/packages/{scope}/{name}")
        assert response.status_code == 200
        data = response.json()
        assert data["latest_version"] == "1.0.0"

    @pytest.mark.asyncio
    async def test_get_package_versions_list(self, client: AsyncClient, test_package_with_version: dict):
        """测试获取包版本列表"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]
        response = await client.get(f"/api/v1/packages/{scope}/{name}/versions")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert len(data["data"]) > 0
        assert data["data"][0]["version"] == "1.0.0"


class TestPackageCreate:
    """创建包测试"""

    @pytest.mark.asyncio
    async def test_create_package_success(self, client: AsyncClient, auth_headers: dict):
        """测试创建包成功"""
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": "new-mcp",
                "scope": "@test",
                "type": "mcp",
                "description": "New MCP package",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "new-mcp"
        assert data["scope"] == "@test"
        assert data["full_name"] == "@test/new-mcp"
        assert data["type"] == "mcp"
        assert data["description"] == "New MCP package"

    @pytest.mark.asyncio
    async def test_create_package_skill_type(self, client: AsyncClient, auth_headers: dict):
        """测试创建 Skill 类型包"""
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": "new-skill",
                "scope": "@test",
                "type": "skill",
                "description": "New Skill package",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "skill"

    @pytest.mark.asyncio
    async def test_create_package_unauthorized(self, client: AsyncClient):
        """测试未认证创建包"""
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": "test",
                "scope": "@test",
                "type": "mcp",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_package_duplicate(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """测试创建重复包名"""
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": test_package["name"],
                "scope": test_package["scope"],
                "type": "mcp",
            },
            headers=auth_headers,
        )
        assert response.status_code == 409
        data = response.json()
        assert data["error"]["code"] == 20004

    @pytest.mark.asyncio
    async def test_create_package_invalid_name_uppercase(self, client: AsyncClient, auth_headers: dict):
        """测试无效包名 - 大写字母"""
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": "INVALID_NAME",
                "scope": "@test",
                "type": "mcp",
            },
            headers=auth_headers,
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_create_package_invalid_name_special_chars(self, client: AsyncClient, auth_headers: dict):
        """测试无效包名 - 特殊字符"""
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": "invalid@name",
                "scope": "@test",
                "type": "mcp",
            },
            headers=auth_headers,
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_create_package_invalid_type(self, client: AsyncClient, auth_headers: dict):
        """测试无效包类型"""
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": "test-package",
                "scope": "@test",
                "type": "invalid",
            },
            headers=auth_headers,
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_create_package_missing_required_fields(self, client: AsyncClient, auth_headers: dict):
        """测试缺少必填字段"""
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": "test-package",
                # 缺少 scope 和 type
            },
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestPackageDelete:
    """删除包测试"""

    @pytest.mark.asyncio
    async def test_delete_package_success(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """测试删除包成功"""
        scope = test_package["scope"]
        name = test_package["name"]
        response = await client.delete(
            f"/api/v1/packages/{scope}/{name}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # 验证包已被软删除
        get_response = await client.get(f"/api/v1/packages/{scope}/{name}")
        assert get_response.status_code == 410

    @pytest.mark.asyncio
    async def test_delete_package_unauthorized(self, client: AsyncClient, test_package: dict):
        """测试未认证删除包"""
        scope = test_package["scope"]
        name = test_package["name"]
        response = await client.delete(f"/api/v1/packages/{scope}/{name}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_package_not_owner(
        self,
        client: AsyncClient,
        another_auth_headers: dict,
        test_package: dict,
    ):
        """测试非所有者删除包"""
        scope = test_package["scope"]
        name = test_package["name"]
        response = await client.delete(
            f"/api/v1/packages/{scope}/{name}",
            headers=another_auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_package_not_found(self, client: AsyncClient, auth_headers: dict):
        """测试删除不存在的包"""
        response = await client.delete(
            "/api/v1/packages/@nonexist/nope",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_package_already_deleted(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deleted_package: dict,
    ):
        """测试删除已删除的包"""
        scope = deleted_package["scope"]
        name = deleted_package["name"]
        response = await client.delete(
            f"/api/v1/packages/{scope}/{name}",
            headers=auth_headers,
        )
        assert response.status_code == 410
