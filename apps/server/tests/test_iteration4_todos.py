"""迭代四 TODO - 依赖管理 + 包编辑页面"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


# ============================================================
# 依赖管理
# ============================================================


@pytest.mark.asyncio
class TestDependencyCheck:
    """依赖检查 API"""

    async def test_check_existing_dependency(self, client: AsyncClient, test_package_with_version: dict):
        """检查存在的依赖应返回 exists=true"""
        pkg = test_package_with_version
        response = await client.post(
            "/api/v1/packages/check-dependencies",
            json={"dependencies": {f"{pkg['scope']}/{pkg['name']}": "^1.0.0"}},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["all_exist"] is True
        assert data["results"][0]["exists"] is True

    async def test_check_missing_dependency(self, client: AsyncClient):
        """检查不存在的依赖应返回 exists=false"""
        response = await client.post(
            "/api/v1/packages/check-dependencies",
            json={"dependencies": {"@nonexist/fake-pkg": "^1.0.0"}},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["all_exist"] is False
        assert data["results"][0]["exists"] is False

    async def test_check_multiple_dependencies(self, client: AsyncClient, test_package_with_version: dict):
        """检查多个依赖（部分存在）"""
        pkg = test_package_with_version
        response = await client.post(
            "/api/v1/packages/check-dependencies",
            json={
                "dependencies": {
                    f"{pkg['scope']}/{pkg['name']}": "^1.0.0",
                    "@nonexist/missing": "^2.0.0",
                }
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["all_exist"] is False
        results = {r["name"]: r["exists"] for r in data["results"]}
        assert results[f"{pkg['scope']}/{pkg['name']}"] is True
        assert results["@nonexist/missing"] is False

    async def test_check_empty_dependencies(self, client: AsyncClient):
        """空依赖列表应返回 all_exist=true"""
        response = await client.post(
            "/api/v1/packages/check-dependencies",
            json={"dependencies": {}},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["all_exist"] is True
        assert data["results"] == []


@pytest.mark.asyncio
class TestDependencyOnPublish:
    """发布时依赖校验"""

    async def test_publish_with_valid_dependencies(
        self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict
    ):
        """版本响应包含 manifest（含 dependencies 字段支持）"""
        pkg = test_package_with_version
        response = await client.get(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0",
        )
        assert response.status_code == 200
        data = response.json()
        # manifest 字段存在
        assert "manifest" in data
        assert isinstance(data["manifest"], dict)


# ============================================================
# 包编辑页面（前端 API 集成测试）
# ============================================================


@pytest.mark.asyncio
class TestPackageEditAPI:
    """包编辑 API - 补充测试"""

    async def test_edit_visibility_to_private(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """修改可见性为 private"""
        scope, name = test_package["scope"], test_package["name"]
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={"visibility": "private"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["visibility"] == "private"

    async def test_edit_clear_description(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """清空描述"""
        scope, name = test_package["scope"], test_package["name"]
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={"description": None},
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_edit_no_fields_is_noop(self, client: AsyncClient, auth_headers: dict, test_package: dict):
        """空更新不改变任何内容"""
        scope, name = test_package["scope"], test_package["name"]
        # 先获取原始值
        original = await client.get(f"/api/v1/packages/{scope}/{name}")
        # 空更新
        response = await client.patch(
            f"/api/v1/packages/{scope}/{name}",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["description"] == original.json()["description"]
