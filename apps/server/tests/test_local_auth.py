"""本地注册/登录 API 测试 - TDD"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User


class TestLocalRegister:
    """本地注册测试"""

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient, db: AsyncSession):
        """注册成功"""
        response = await client.post("/api/v1/auth/register", json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "display_name": "New User",
        })
        assert response.status_code == 201
        data = response.json()
        assert "token" in data
        assert data["user"]["username"] == "newuser"
        assert data["user"]["email"] == "newuser@example.com"
        assert data["user"]["display_name"] == "New User"
        assert "password_hash" not in data["user"]

    @pytest.mark.asyncio
    async def test_register_creates_user_in_db(self, client: AsyncClient, db: AsyncSession):
        """注册后用户应存在于数据库"""
        await client.post("/api/v1/auth/register", json={
            "username": "dbuser",
            "email": "dbuser@example.com",
            "password": "SecurePass123!",
        })
        result = await db.execute(select(User).where(User.username == "dbuser"))
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.email == "dbuser@example.com"
        assert user.password_hash is not None
        assert user.oauth_provider == "local"
        assert user.role == "member"
        assert user.status == "active"

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client: AsyncClient, test_user: User):
        """重复用户名应返回 409"""
        response = await client.post("/api/v1/auth/register", json={
            "username": test_user.username,
            "email": "different@example.com",
            "password": "SecurePass123!",
        })
        assert response.status_code == 409
        data = response.json()
        assert data["error"]["code"] == 20004  # CONFLICT

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, test_user: User):
        """重复邮箱应返回 409"""
        response = await client.post("/api/v1/auth/register", json={
            "username": "uniqueuser",
            "email": test_user.email,
            "password": "SecurePass123!",
        })
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_register_weak_password(self, client: AsyncClient):
        """弱密码应返回 422（验证失败）"""
        response = await client.post("/api/v1/auth/register", json={
            "username": "weakpass",
            "email": "weak@example.com",
            "password": "123",  # 太短
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client: AsyncClient):
        """无效邮箱应返回 422（验证失败）"""
        response = await client.post("/api/v1/auth/register", json={
            "username": "invalidemail",
            "email": "not-an-email",
            "password": "SecurePass123!",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_username_too_short(self, client: AsyncClient):
        """用户名太短应返回 422（验证失败）"""
        response = await client.post("/api/v1/auth/register", json={
            "username": "ab",  # < 3 字符
            "email": "short@example.com",
            "password": "SecurePass123!",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_username_invalid_chars(self, client: AsyncClient):
        """用户名包含非法字符应返回 422（验证失败）"""
        response = await client.post("/api/v1/auth/register", json={
            "username": "user@name!",  # 包含特殊字符
            "email": "invalid@example.com",
            "password": "SecurePass123!",
        })
        assert response.status_code == 422


class TestLocalLogin:
    """本地登录测试"""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, local_user: User):
        """登录成功"""
        response = await client.post("/api/v1/auth/login", json={
            "email": local_user.email,
            "password": "SecurePass123!",
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "refresh_token" in data
        assert data["user"]["username"] == local_user.username
        assert "password_hash" not in data["user"]

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, local_user: User):
        """密码错误应返回 401"""
        response = await client.post("/api/v1/auth/login", json={
            "email": local_user.email,
            "password": "WrongPassword!",
        })
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == 20001  # UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_login_nonexistent_email(self, client: AsyncClient):
        """不存在的邮箱应返回 401"""
        response = await client.post("/api/v1/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "SomePassword123!",
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_suspended_user(self, client: AsyncClient, suspended_user: User):
        """停用账号登录应返回 403"""
        response = await client.post("/api/v1/auth/login", json={
            "email": suspended_user.email,
            "password": "SuspendedPass123!",
        })
        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == 20002  # FORBIDDEN

    @pytest.mark.asyncio
    async def test_login_updates_last_login_at(self, client: AsyncClient, local_user: User, db: AsyncSession):
        """登录应更新 last_login_at"""
        await client.post("/api/v1/auth/login", json={
            "email": local_user.email,
            "password": "SecurePass123!",
        })
        await db.refresh(local_user)
        assert local_user.last_login_at is not None

    @pytest.mark.asyncio
    async def test_login_returns_both_tokens(self, client: AsyncClient, local_user: User):
        """登录应返回 access_token 和 refresh_token"""
        response = await client.post("/api/v1/auth/login", json={
            "email": local_user.email,
            "password": "SecurePass123!",
        })
        data = response.json()
        assert "token" in data
        assert "refresh_token" in data
        assert len(data["token"]) > 20
        assert len(data["refresh_token"]) > 20


class TestTokenRefresh:
    """Token 刷新测试"""

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client: AsyncClient, local_user: User):
        """使用 refresh_token 获取新 access_token"""
        # 先登录获取 token
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": local_user.email,
            "password": "SecurePass123!",
        })
        refresh_token = login_resp.json()["refresh_token"]

        # 刷新
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data

    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, client: AsyncClient):
        """无效的 refresh_token 应返回 401"""
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": "invalid-token",
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_expired(self, client: AsyncClient, local_user: User):
        """过期的 refresh_token 应返回 401"""
        import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import get_settings

        settings = get_settings()
        payload = {
            "sub": str(local_user.id),
            "type": "refresh",
            "exp": datetime.now(timezone.utc) - timedelta(days=1),  # 已过期
        }
        expired_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": expired_token,
        })
        assert response.status_code == 401


class TestLogout:
    """登出测试"""

    @pytest.mark.asyncio
    async def test_logout_success(self, client: AsyncClient, auth_headers: dict):
        """登出成功"""
        response = await client.post("/api/v1/auth/logout", headers=auth_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_logout_invalidates_token(self, client: AsyncClient, local_user: User):
        """登出后 token 应失效"""
        # 登录
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": local_user.email,
            "password": "SecurePass123!",
        })
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 登出
        await client.post("/api/v1/auth/logout", headers=headers)

        # 使用已登出的 token 访问
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_logout_without_token(self, client: AsyncClient):
        """未认证登出应返回 401"""
        response = await client.post("/api/v1/auth/logout")
        assert response.status_code == 401
