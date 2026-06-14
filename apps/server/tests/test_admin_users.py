"""管理员用户管理 API 测试 - TDD"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


class TestAdminUserList:
    """管理员用户列表测试"""

    @pytest.mark.asyncio
    async def test_admin_can_list_users(
        self, client: AsyncClient, admin_headers: dict, test_user: User, local_user: User
    ):
        """管理员可以查看用户列表"""
        response = await client.get("/api/v1/admin/users", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert len(data["data"]) >= 2

    @pytest.mark.asyncio
    async def test_member_cannot_list_users(self, client: AsyncClient, auth_headers: dict):
        """普通成员不能查看用户列表"""
        response = await client.get("/api/v1/admin/users", headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_list_users(self, client: AsyncClient):
        """未认证不能查看用户列表"""
        response = await client.get("/api/v1/admin/users")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_list_users_with_role_filter(self, client: AsyncClient, admin_headers: dict, admin_user: User):
        """按角色筛选用户"""
        response = await client.get("/api/v1/admin/users?role=admin", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        for user in data["data"]:
            assert user["role"] == "admin"

    @pytest.mark.asyncio
    async def test_admin_list_users_with_status_filter(
        self, client: AsyncClient, admin_headers: dict, suspended_user: User
    ):
        """按状态筛选用户"""
        response = await client.get("/api/v1/admin/users?status=suspended", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        for user in data["data"]:
            assert user["status"] == "suspended"

    @pytest.mark.asyncio
    async def test_admin_list_users_with_keyword(self, client: AsyncClient, admin_headers: dict, test_user: User):
        """关键词搜索用户"""
        response = await client.get(f"/api/v1/admin/users?keyword={test_user.username}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) >= 1
        assert any(u["username"] == test_user.username for u in data["data"])

    @pytest.mark.asyncio
    async def test_admin_list_users_pagination(self, client: AsyncClient, admin_headers: dict, multiple_packages: list):
        """用户列表分页"""
        response = await client.get("/api/v1/admin/users?page=1&per_page=2", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) <= 2
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["per_page"] == 2


class TestAdminUserDetail:
    """管理员用户详情测试"""

    @pytest.mark.asyncio
    async def test_admin_can_get_user_detail(self, client: AsyncClient, admin_headers: dict, test_user: User):
        """管理员可以查看用户详情"""
        response = await client.get(f"/api/v1/admin/users/{test_user.id}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        assert "role" in data
        assert "status" in data

    @pytest.mark.asyncio
    async def test_member_cannot_get_user_detail(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """普通成员不能查看用户详情"""
        response = await client.get(f"/api/v1/admin/users/{test_user.id}", headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_get_nonexistent_user(self, client: AsyncClient, admin_headers: dict):
        """查看不存在的用户应返回 404"""
        response = await client.get("/api/v1/admin/users/nonexistent-id", headers=admin_headers)
        assert response.status_code == 404


class TestAdminUpdateUserStatus:
    """管理员修改用户状态测试"""

    @pytest.mark.asyncio
    async def test_admin_can_suspend_user(
        self, client: AsyncClient, admin_headers: dict, test_user: User, db: AsyncSession
    ):
        """管理员可以停用用户"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/status",
            headers=admin_headers,
            json={"status": "suspended"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "suspended"

        # 验证数据库
        await db.refresh(test_user)
        assert test_user.status == "suspended"

    @pytest.mark.asyncio
    async def test_admin_can_activate_user(
        self, client: AsyncClient, admin_headers: dict, suspended_user: User, db: AsyncSession
    ):
        """管理员可以启用用户"""
        response = await client.patch(
            f"/api/v1/admin/users/{suspended_user.id}/status",
            headers=admin_headers,
            json={"status": "active"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_admin_can_ban_user(
        self, client: AsyncClient, admin_headers: dict, test_user: User, db: AsyncSession
    ):
        """管理员可以封禁用户"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/status",
            headers=admin_headers,
            json={"status": "banned"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "banned"

    @pytest.mark.asyncio
    async def test_member_cannot_suspend_user(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """普通成员不能停用用户"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/status",
            headers=auth_headers,
            json={"status": "suspended"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_cannot_suspend_self(self, client: AsyncClient, admin_headers: dict, admin_user: User):
        """管理员不能停用自己"""
        response = await client.patch(
            f"/api/v1/admin/users/{admin_user.id}/status",
            headers=admin_headers,
            json={"status": "suspended"},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_invalid_status_value(self, client: AsyncClient, admin_headers: dict, test_user: User):
        """无效的状态值应返回 422"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/status",
            headers=admin_headers,
            json={"status": "invalid"},
        )
        assert response.status_code == 422


class TestAdminUpdateUserRole:
    """管理员修改用户角色测试（仅 super_admin）"""

    @pytest.mark.asyncio
    async def test_super_admin_can_change_role(
        self, client: AsyncClient, super_admin_headers: dict, test_user: User, db: AsyncSession
    ):
        """超级管理员可以修改用户角色"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/role",
            headers=super_admin_headers,
            json={"role": "admin"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"

        # 验证数据库
        await db.refresh(test_user)
        assert test_user.role == "admin"

    @pytest.mark.asyncio
    async def test_admin_cannot_change_role(self, client: AsyncClient, admin_headers: dict, test_user: User):
        """普通管理员不能修改用户角色"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/role",
            headers=admin_headers,
            json={"role": "admin"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_member_cannot_change_role(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """普通成员不能修改用户角色"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/role",
            headers=auth_headers,
            json={"role": "admin"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_change_to_super_admin(self, client: AsyncClient, super_admin_headers: dict, test_user: User):
        """不能将用户提升为 super_admin"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/role",
            headers=super_admin_headers,
            json={"role": "super_admin"},
        )
        # Pydantic 验证返回 422，API 验证返回 400
        assert response.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_super_admin_cannot_change_own_role(
        self, client: AsyncClient, super_admin_headers: dict, super_admin_user: User
    ):
        """超级管理员不能修改自己的角色"""
        response = await client.patch(
            f"/api/v1/admin/users/{super_admin_user.id}/role",
            headers=super_admin_headers,
            json={"role": "member"},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_invalid_role_value(self, client: AsyncClient, super_admin_headers: dict, test_user: User):
        """无效的角色值应返回 422"""
        response = await client.patch(
            f"/api/v1/admin/users/{test_user.id}/role",
            headers=super_admin_headers,
            json={"role": "invalid"},
        )
        assert response.status_code == 422


class TestAdminDeleteUser:
    """管理员删除用户测试（仅 super_admin）"""

    @pytest.mark.asyncio
    async def test_super_admin_can_delete_user(
        self, client: AsyncClient, super_admin_headers: dict, test_user: User, db: AsyncSession
    ):
        """超级管理员可以删除用户"""
        response = await client.delete(
            f"/api/v1/admin/users/{test_user.id}",
            headers=super_admin_headers,
        )
        assert response.status_code == 200

        # 验证软删除
        await db.refresh(test_user)
        assert test_user.status == "deleted"

    @pytest.mark.asyncio
    async def test_admin_cannot_delete_user(self, client: AsyncClient, admin_headers: dict, test_user: User):
        """普通管理员不能删除用户"""
        response = await client.delete(
            f"/api/v1/admin/users/{test_user.id}",
            headers=admin_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_super_admin_cannot_delete_self(
        self, client: AsyncClient, super_admin_headers: dict, super_admin_user: User
    ):
        """超级管理员不能删除自己"""
        response = await client.delete(
            f"/api/v1/admin/users/{super_admin_user.id}",
            headers=super_admin_headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_nonexistent_user(self, client: AsyncClient, super_admin_headers: dict):
        """删除不存在的用户应返回 404"""
        response = await client.delete(
            "/api/v1/admin/users/nonexistent-id",
            headers=super_admin_headers,
        )
        assert response.status_code == 404


class TestAdminSystemStats:
    """系统统计测试"""

    @pytest.mark.asyncio
    async def test_admin_can_get_stats(self, client: AsyncClient, admin_headers: dict):
        """管理员可以查看系统统计"""
        response = await client.get("/api/v1/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_packages" in data
        assert "active_users" in data

    @pytest.mark.asyncio
    async def test_member_cannot_get_stats(self, client: AsyncClient, auth_headers: dict):
        """普通成员不能查看系统统计"""
        response = await client.get("/api/v1/admin/stats", headers=auth_headers)
        assert response.status_code == 403
