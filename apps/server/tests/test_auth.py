"""认证 API 测试"""

import pytest
from httpx import AsyncClient
from app.models.user import User


class TestOAuth:
    """OAuth 认证测试"""

    @pytest.mark.asyncio
    async def test_oauth_redirect_wechat_work(self, client: AsyncClient):
        """测试企业微信 OAuth 跳转（未配置时返回 500）"""
        response = await client.get(
            "/api/v1/auth/oauth/wechat_work",
            follow_redirects=False,
        )
        # 未配置 OAuth 时返回 500，已配置时返回 302
        assert response.status_code in [302, 500]

    @pytest.mark.asyncio
    async def test_oauth_redirect_feishu(self, client: AsyncClient):
        """测试飞书 OAuth 跳转（未配置时返回 500）"""
        response = await client.get(
            "/api/v1/auth/oauth/feishu",
            follow_redirects=False,
        )
        assert response.status_code in [302, 500]

    @pytest.mark.asyncio
    async def test_oauth_redirect_dingtalk(self, client: AsyncClient):
        """测试钉钉 OAuth 跳转（未配置时返回 500）"""
        response = await client.get(
            "/api/v1/auth/oauth/dingtalk",
            follow_redirects=False,
        )
        assert response.status_code in [302, 500]

    @pytest.mark.asyncio
    async def test_oauth_invalid_provider(self, client: AsyncClient):
        """测试无效的 OAuth 提供商"""
        response = await client.get("/api/v1/auth/oauth/invalid")
        assert response.status_code in [400, 404, 422]


class TestGetMe:
    """获取当前用户信息测试"""

    @pytest.mark.asyncio
    async def test_get_me_authenticated(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """测试已认证获取用户信息"""
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        assert data["display_name"] == test_user.display_name

    @pytest.mark.asyncio
    async def test_get_me_returns_role(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """测试 /me 返回 role 字段，前端用于判断 isAdmin"""
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "role" in data, "/me 必须返回 role 字段"
        assert data["role"] == test_user.role

    @pytest.mark.asyncio
    async def test_get_me_super_admin_role(self, client: AsyncClient, super_admin_headers: dict, super_admin_user: User):
        """测试超级管理员 /me 返回 super_admin 角色"""
        response = await client.get("/api/v1/auth/me", headers=super_admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "super_admin"

    @pytest.mark.asyncio
    async def test_get_me_unauthenticated(self, client: AsyncClient):
        """测试未认证获取用户信息"""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == 20001

    @pytest.mark.asyncio
    async def test_get_me_invalid_token(self, client: AsyncClient):
        """测试无效 Token"""
        headers = {"Authorization": "Bearer invalid-token"}
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_expired_token(self, client: AsyncClient, test_user: User):
        """测试过期 Token"""
        import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import get_settings

        settings = get_settings()
        payload = {
            "sub": str(test_user.id),
            "username": test_user.username,
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),  # 已过期
        }
        expired_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        headers = {"Authorization": f"Bearer {expired_token}"}

        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401


class TestTokenAuthentication:
    """Token 认证测试"""

    @pytest.mark.asyncio
    async def test_token_header_format(self, client: AsyncClient, auth_headers: dict):
        """测试 Token Header 格式"""
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_token_query_parameter(self, client: AsyncClient, auth_token: str):
        """测试通过 Query 参数传递 Token

        注意：当前实现不支持 query 参数认证，仅支持 Header 认证。
        此测试验证 query 参数认证被正确拒绝。
        """
        response = await client.get(f"/api/v1/auth/me?token={auth_token}")
        # 当前实现不支持 query 参数认证，应返回 401
        assert response.status_code == 401


class TestDevLogin:
    """开发环境登录测试 - 验证 role 参数支持"""

    @pytest.mark.asyncio
    async def test_dev_login_default_role(self, client: AsyncClient):
        """测试 dev-login 默认创建 member 角色"""
        response = await client.post(
            "/api/v1/auth/dev-login",
            json={"username": "devuser"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["username"] == "devuser"

        # 通过 /me 验证角色
        me_response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {data['token']}"},
        )
        assert me_response.status_code == 200
        assert me_response.json()["role"] == "member"

    @pytest.mark.asyncio
    async def test_dev_login_with_role(self, client: AsyncClient):
        """测试 dev-login 支持指定 role 参数创建超级管理员"""
        response = await client.post(
            "/api/v1/auth/dev-login",
            json={"username": "superadmin", "role": "super_admin"},
        )
        assert response.status_code == 200
        data = response.json()

        # 通过 /me 验证角色
        me_response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {data['token']}"},
        )
        assert me_response.status_code == 200
        assert me_response.json()["role"] == "super_admin"

    @pytest.mark.asyncio
    async def test_dev_login_with_admin_role(self, client: AsyncClient):
        """测试 dev-login 支持 admin 角色"""
        response = await client.post(
            "/api/v1/auth/dev-login",
            json={"username": "adminuser", "role": "admin"},
        )
        assert response.status_code == 200

        me_response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {response.json()['token']}"},
        )
        assert me_response.status_code == 200
        assert me_response.json()["role"] == "admin"
