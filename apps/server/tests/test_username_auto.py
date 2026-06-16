"""#12 用户名冲突自动编号测试

测试场景：
- 无冲突时使用原始用户名
- 有冲突时自动追加 -2
- 多个冲突时递增 (-3, -4, ...)
- 邮箱冲突不受影响
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import hash_password


@pytest.mark.asyncio
class TestUsernameAutoNumbering:
    """用户名冲突自动编号"""

    async def test_no_conflict_uses_original(self, client: AsyncClient, db: AsyncSession):
        """无冲突时使用原始用户名"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "new@example.com",
                "password": "StrongPass123!",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["user"]["username"] == "newuser"

    async def test_conflict_appends_2(self, client: AsyncClient, db: AsyncSession, test_user: User):
        """用户名冲突时自动追加 -2"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": test_user.username,  # 已存在
                "email": "different@example.com",
                "password": "StrongPass123!",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["user"]["username"] == f"{test_user.username}-2"

    async def test_multiple_conflicts_increments(self, client: AsyncClient, db: AsyncSession):
        """多个冲突时递增 (-2, -3, -4)"""
        # 创建 user, user-2, user-3
        for suffix in ["", "-2", "-3"]:
            user = User(
                username=f"testname{suffix}",
                email=f"test{suffix}@example.com",
                display_name=f"Test{suffix}",
                password_hash=hash_password("Pass123!"),
                oauth_provider="local",
                role="member",
                status="active",
            )
            db.add(user)
        await db.flush()

        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "testname",
                "email": "new@example.com",
                "password": "StrongPass123!",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["user"]["username"] == "testname-4"

    async def test_email_conflict_still_rejected(self, client: AsyncClient, db: AsyncSession, test_user: User):
        """邮箱冲突仍然拒绝（不自动编号）"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "uniqueuser",
                "email": test_user.email,  # 邮箱已存在
                "password": "StrongPass123!",
            },
        )
        assert response.status_code == 409
