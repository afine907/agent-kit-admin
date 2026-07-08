"""leave-team 端点测试

测试 POST /teams/{team_id}/leave 端点的各种场景。
"""

import pytest
from httpx import AsyncClient
from app.models.user import User


class TestLeaveTeam:
    """退出团队测试"""

    @pytest.mark.asyncio
    async def test_leave_team_success(
        self, client: AsyncClient, auth_headers: dict, another_user: User, another_auth_headers: dict
    ):
        """成员正常退出团队"""
        # 创建团队
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Leave Team", "slug": "leave-team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        # 添加成员
        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"user_id": str(another_user.id), "role": "member"},
            headers=auth_headers,
        )

        # 成员退出
        response = await client.post(
            f"/api/v1/teams/{team_id}/leave",
            headers=another_auth_headers,
        )
        assert response.status_code == 204

        # 验证成员已被移除
        members_resp = await client.get(
            f"/api/v1/teams/{team_id}/members",
            headers=auth_headers,
        )
        members = members_resp.json()
        member_ids = [m["user_id"] for m in members]
        assert str(another_user.id) not in member_ids

    @pytest.mark.asyncio
    async def test_owner_cannot_leave(self, client: AsyncClient, auth_headers: dict):
        """团队 owner 不能退出团队"""
        # 创建团队（当前用户是 owner）
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Owner Team", "slug": "owner-team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        # owner 尝试退出
        response = await client.post(
            f"/api/v1/teams/{team_id}/leave",
            headers=auth_headers,
        )
        assert response.status_code == 400
        data = response.json()
        assert "Owner cannot leave" in data.get("detail", "") or "owner" in str(data).lower()

    @pytest.mark.asyncio
    async def test_non_member_cannot_leave(self, client: AsyncClient, auth_headers: dict, another_auth_headers: dict):
        """非团队成员不能退出团队"""
        # 创建团队
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Member Team", "slug": "member-team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        # 非成员尝试退出
        response = await client.post(
            f"/api/v1/teams/{team_id}/leave",
            headers=another_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_leave_team_unauthorized(self, client: AsyncClient):
        """未认证请求退出团队"""
        response = await client.post("/api/v1/teams/fake-id/leave")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_leave_nonexistent_team(self, client: AsyncClient, auth_headers: dict):
        """退出不存在的团队"""
        response = await client.post(
            "/api/v1/teams/00000000-0000-0000-0000-000000000000/leave",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_leave_team_twice(
        self, client: AsyncClient, auth_headers: dict, another_user: User, another_auth_headers: dict
    ):
        """离开后再次离开应返回 404"""
        # 创建团队
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Twice Team", "slug": "twice-team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        # 添加成员
        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"user_id": str(another_user.id), "role": "member"},
            headers=auth_headers,
        )

        # 第一次退出
        resp1 = await client.post(
            f"/api/v1/teams/{team_id}/leave",
            headers=another_auth_headers,
        )
        assert resp1.status_code == 204

        # 第二次退出应返回 404
        resp2 = await client.post(
            f"/api/v1/teams/{team_id}/leave",
            headers=another_auth_headers,
        )
        assert resp2.status_code == 404
