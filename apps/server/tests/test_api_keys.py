"""API Key 管理测试 - TDD 红灯阶段

测试用例：
1. 创建 API Key - 成功
2. 创建 API Key - 名称为空
3. 列出 API Key - 成功
4. 列出 API Key - 只返回当前用户的
5. 删除 API Key - 成功
6. 删除 API Key - 不能删除别人的
7. 删除 API Key - 不存在的 key
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


@pytest.mark.asyncio
class TestCreateAPIKey:
    """创建 API Key 测试"""

    async def test_create_api_key_success(self, client: AsyncClient, local_user_headers: dict):
        """成功创建 API Key"""
        response = await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "CI/CD Token"},
            headers=local_user_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["name"] == "CI/CD Token"
        assert "key" in data  # 只在创建时返回完整 key
        assert "key_prefix" in data
        assert data["key"].startswith("akit_")

    async def test_create_api_key_empty_name(self, client: AsyncClient, local_user_headers: dict):
        """名称为空应返回 422"""
        response = await client.post(
            "/api/v1/auth/api-keys",
            json={"name": ""},
            headers=local_user_headers,
        )
        assert response.status_code == 422

    async def test_create_api_key_unauthenticated(self, client: AsyncClient):
        """未登录应返回 401"""
        response = await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "Test Key"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestListAPIKeys:
    """列出 API Key 测试"""

    async def test_list_api_keys_empty(self, client: AsyncClient, local_user_headers: dict):
        """无 API Key 时返回空列表"""
        response = await client.get(
            "/api/v1/auth/api-keys",
            headers=local_user_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    async def test_list_api_keys_after_create(self, client: AsyncClient, local_user_headers: dict):
        """创建后能列出 API Key"""
        # 先创建一个
        await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "Key 1"},
            headers=local_user_headers,
        )
        await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "Key 2"},
            headers=local_user_headers,
        )

        # 列出
        response = await client.get(
            "/api/v1/auth/api-keys",
            headers=local_user_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] in ["Key 1", "Key 2"]
        # 列表中不应包含完整 key
        assert "key" not in data[0]

    async def test_list_api_keys_only_own(self, client: AsyncClient, local_user_headers: dict, auth_headers: dict):
        """只返回当前用户的 API Key"""
        # local_user 创建一个
        await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "Local User Key"},
            headers=local_user_headers,
        )
        # test_user 创建一个
        await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "Test User Key"},
            headers=auth_headers,
        )

        # local_user 列出
        response = await client.get(
            "/api/v1/auth/api-keys",
            headers=local_user_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Local User Key"


@pytest.mark.asyncio
class TestDeleteAPIKey:
    """删除 API Key 测试"""

    async def test_delete_api_key_success(self, client: AsyncClient, local_user_headers: dict):
        """成功删除自己的 API Key"""
        # 先创建
        create_resp = await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "To Delete"},
            headers=local_user_headers,
        )
        key_id = create_resp.json()["id"]

        # 删除
        response = await client.delete(
            f"/api/v1/auth/api-keys/{key_id}",
            headers=local_user_headers,
        )
        assert response.status_code == 204

        # 确认已删除
        list_resp = await client.get(
            "/api/v1/auth/api-keys",
            headers=local_user_headers,
        )
        assert len(list_resp.json()) == 0

    async def test_delete_other_users_key(
        self, client: AsyncClient, local_user_headers: dict, auth_headers: dict
    ):
        """不能删除别人的 API Key"""
        # test_user 创建
        create_resp = await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "Other User Key"},
            headers=auth_headers,
        )
        key_id = create_resp.json()["id"]

        # local_user 尝试删除
        response = await client.delete(
            f"/api/v1/auth/api-keys/{key_id}",
            headers=local_user_headers,
        )
        assert response.status_code == 404

    async def test_delete_nonexistent_key(self, client: AsyncClient, local_user_headers: dict):
        """删除不存在的 key 应返回 404"""
        response = await client.delete(
            "/api/v1/auth/api-keys/00000000-0000-0000-0000-000000000000",
            headers=local_user_headers,
        )
        assert response.status_code == 404

    async def test_delete_api_key_unauthenticated(self, client: AsyncClient):
        """未登录应返回 401"""
        response = await client.delete(
            "/api/v1/auth/api-keys/00000000-0000-0000-0000-000000000000",
        )
        assert response.status_code == 401
