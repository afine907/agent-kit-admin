"""登录失败次数限制测试 - TDD 红灯阶段

规则：同一邮箱 5 次失败后锁定 15 分钟

测试用例：
1. 连续 5 次失败后应返回 429
2. 成功登录后应重置失败计数
3. 不同邮箱独立计算
4. 锁定期间即使密码正确也应拒绝
"""

import pytest
from httpx import AsyncClient
from app.services.auth import AuthService


@pytest.fixture(autouse=True)
def clear_login_failures():
    """每个测试前清除登录失败记录"""
    AuthService.clear_all_login_failures()
    yield
    AuthService.clear_all_login_failures()


@pytest.mark.asyncio
class TestLoginRateLimit:
    """登录失败次数限制测试"""

    async def test_lockout_after_5_failures(self, client: AsyncClient, local_user):
        """连续 5 次失败后应返回 429"""
        # 前 4 次失败返回 401
        for i in range(4):
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "local@example.com",
                    "password": "WrongPassword123!",
                },
            )
            assert response.status_code == 401, f"第 {i + 1} 次应返回 401"

        # 第 5 次失败触发锁定，返回 429
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "local@example.com",
                "password": "WrongPassword123!",
            },
        )
        assert response.status_code == 429
        data = response.json()
        # 错误消息在 error.message 中
        error_message = data.get("error", {}).get("message", "")
        assert "15" in error_message or "too many" in error_message.lower()

    async def test_success_resets_failure_count(self, client: AsyncClient, local_user):
        """成功登录后应重置失败计数"""
        # 先失败 3 次
        for _ in range(3):
            await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "local@example.com",
                    "password": "WrongPassword123!",
                },
            )

        # 成功登录一次
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "local@example.com",
                "password": "SecurePass123!",
            },
        )
        assert response.status_code == 200

        # 再失败 4 次，不应被锁定（因为成功登录重置了计数）
        for i in range(4):
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "local@example.com",
                    "password": "WrongPassword123!",
                },
            )
            assert response.status_code == 401

        # 第 5 次失败后应被锁定
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "local@example.com",
                "password": "WrongPassword123!",
            },
        )
        assert response.status_code == 429

    async def test_different_emails_independent(self, client: AsyncClient, local_user, test_user):
        """不同邮箱独立计算"""
        # 对 local@example.com 失败 4 次
        for _ in range(4):
            await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "local@example.com",
                    "password": "WrongPassword123!",
                },
            )

        # 对 test@example.com 失败 4 次
        for _ in range(4):
            await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "test@example.com",
                    "password": "WrongPassword123!",
                },
            )

        # local@example.com 第 5 次失败，应被锁定
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "local@example.com",
                "password": "WrongPassword123!",
            },
        )
        assert response.status_code == 429

        # test@example.com 第 5 次失败，也应被锁定
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "WrongPassword123!",
            },
        )
        assert response.status_code == 429

    async def test_locked_out_rejects_correct_password(self, client: AsyncClient, local_user):
        """锁定期间即使密码正确也应拒绝"""
        # 先失败 5 次触发锁定
        for _ in range(5):
            await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "local@example.com",
                    "password": "WrongPassword123!",
                },
            )

        # 使用正确密码登录
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "local@example.com",
                "password": "SecurePass123!",
            },
        )
        assert response.status_code == 429
