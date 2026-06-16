"""API Key 认证测试"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


class TestAPIKeyAuthentication:
    """API Key 认证中间件测试"""

    @pytest.mark.asyncio
    async def test_api_key_auth_me(self, client: AsyncClient, db: AsyncSession, test_user: User):
        """测试使用 API Key 访问 /auth/me"""
        # 创建 API Key
        from app.services.api_key import APIKeyService

        service = APIKeyService(db)
        key_data = await service.create_key(str(test_user.id), "test-key")
        full_key = key_data["key"]

        # 使用 API Key 认证
        headers = {"Authorization": f"Bearer {full_key}"}
        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email

    @pytest.mark.asyncio
    async def test_api_key_invalid(self, client: AsyncClient):
        """测试无效 API Key 返回 401"""
        headers = {"Authorization": "Bearer akit_invalidkey12345"}
        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == 20001

    @pytest.mark.asyncio
    async def test_api_key_expired(self, client: AsyncClient, db: AsyncSession, test_user: User):
        """测试过期 API Key 返回 401"""
        from app.services.api_key import generate_api_key
        from app.models.api_key import APIKey
        from datetime import datetime, timedelta, timezone

        full_key, key_hash, key_prefix = generate_api_key()

        # 手动创建过期的 API Key
        api_key = APIKey(
            user_id=test_user.id,
            name="expired-key",
            key_hash=key_hash,
            key_prefix=key_prefix,
            permissions=["read", "write"],
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        db.add(api_key)
        await db.flush()

        # 使用过期的 API Key
        headers = {"Authorization": f"Bearer {full_key}"}
        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_api_key_access_protected_endpoint(self, client: AsyncClient, db: AsyncSession, test_user: User):
        """测试使用 API Key 访问受保护端点（创建包）"""
        from app.services.api_key import APIKeyService

        service = APIKeyService(db)
        key_data = await service.create_key(str(test_user.id), "test-key")
        full_key = key_data["key"]

        headers = {"Authorization": f"Bearer {full_key}"}
        response = await client.post(
            "/api/v1/packages",
            json={
                "name": "api-key-pkg",
                "scope": "@test",
                "type": "mcp",
                "description": "Created with API Key",
            },
            headers=headers,
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_api_key_admin_forbidden(self, client: AsyncClient, db: AsyncSession, test_user: User):
        """测试普通用户的 API Key 无法访问管理端点"""
        from app.services.api_key import APIKeyService

        service = APIKeyService(db)
        key_data = await service.create_key(str(test_user.id), "test-key")
        full_key = key_data["key"]

        headers = {"Authorization": f"Bearer {full_key}"}
        response = await client.get("/api/v1/admin/users", headers=headers)

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_api_key_admin_allowed(self, client: AsyncClient, db: AsyncSession, admin_user: User):
        """测试管理员的 API Key 可以访问管理端点"""
        from app.services.api_key import APIKeyService

        service = APIKeyService(db)
        key_data = await service.create_key(str(admin_user.id), "admin-key")
        full_key = key_data["key"]

        headers = {"Authorization": f"Bearer {full_key}"}
        response = await client.get("/api/v1/admin/users", headers=headers)

        assert response.status_code == 200
