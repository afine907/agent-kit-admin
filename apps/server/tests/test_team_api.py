"""团队 API 测试"""

import pytest
from httpx import AsyncClient


class TestTeamCreate:
    """创建团队测试"""

    @pytest.mark.asyncio
    async def test_create_team_success(self, client: AsyncClient, auth_headers: dict):
        """测试创建团队成功"""
        response = await client.post(
            "/api/v1/teams",
            json={
                "name": "My Team",
                "slug": "my-team",
                "description": "A great team",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Team"
        assert data["slug"] == "my-team"
        assert data["description"] == "A great team"

    @pytest.mark.asyncio
    async def test_create_team_unauthorized(self, client: AsyncClient):
        """测试未认证创建团队"""
        response = await client.post(
            "/api/v1/teams",
            json={
                "name": "Team",
                "slug": "team",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_team_duplicate_slug(self, client: AsyncClient, auth_headers: dict):
        """测试重复 slug 创建团队"""
        await client.post(
            "/api/v1/teams",
            json={"name": "Team 1", "slug": "same-slug"},
            headers=auth_headers,
        )
        response = await client.post(
            "/api/v1/teams",
            json={"name": "Team 2", "slug": "same-slug"},
            headers=auth_headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_create_team_invalid_slug(self, client: AsyncClient, auth_headers: dict):
        """测试无效 slug"""
        response = await client.post(
            "/api/v1/teams",
            json={"name": "Team", "slug": "INVALID"},
            headers=auth_headers,
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_create_team_missing_name(self, client: AsyncClient, auth_headers: dict):
        """测试缺少团队名称"""
        response = await client.post(
            "/api/v1/teams",
            json={"slug": "team"},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestTeamList:
    """团队列表测试"""

    @pytest.mark.asyncio
    async def test_list_teams_empty(self, client: AsyncClient, auth_headers: dict):
        """测试空团队列表"""
        response = await client.get("/api/v1/teams", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_list_teams_with_data(self, client: AsyncClient, auth_headers: dict):
        """测试有数据的团队列表"""
        # 创建两个团队
        await client.post(
            "/api/v1/teams",
            json={"name": "Team 1", "slug": "team-1"},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/teams",
            json={"name": "Team 2", "slug": "team-2"},
            headers=auth_headers,
        )

        response = await client.get("/api/v1/teams", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    @pytest.mark.asyncio
    async def test_list_teams_unauthorized(self, client: AsyncClient):
        """测试未认证列出团队"""
        response = await client.get("/api/v1/teams")
        assert response.status_code == 401


class TestTeamDetail:
    """团队详情测试"""

    @pytest.mark.asyncio
    async def test_get_team_success(self, client: AsyncClient, auth_headers: dict):
        """测试获取团队详情"""
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Detail Team", "slug": "detail-team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/teams/{team_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Detail Team"
        assert data["slug"] == "detail-team"

    @pytest.mark.asyncio
    async def test_get_team_not_found(self, client: AsyncClient, auth_headers: dict):
        """测试获取不存在的团队"""
        response = await client.get("/api/v1/teams/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404


class TestTeamUpdate:
    """更新团队测试"""

    @pytest.mark.asyncio
    async def test_update_team_success(self, client: AsyncClient, auth_headers: dict):
        """测试更新团队成功"""
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Old Name", "slug": "old-slug"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/v1/teams/{team_id}",
            json={"name": "New Name", "description": "Updated"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"
        assert data["description"] == "Updated"

    @pytest.mark.asyncio
    async def test_update_team_unauthorized(self, client: AsyncClient):
        """测试未认证更新团队"""
        response = await client.put(
            "/api/v1/teams/fake-id",
            json={"name": "New"},
        )
        assert response.status_code == 401


class TestTeamDelete:
    """删除团队测试"""

    @pytest.mark.asyncio
    async def test_delete_team_success(self, client: AsyncClient, auth_headers: dict):
        """测试删除团队成功"""
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Delete Team", "slug": "delete-team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/teams/{team_id}", headers=auth_headers)
        assert response.status_code == 204

        # 验证团队已被删除
        get_resp = await client.get(f"/api/v1/teams/{team_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_team_unauthorized(self, client: AsyncClient):
        """测试未认证删除团队"""
        response = await client.delete("/api/v1/teams/fake-id")
        assert response.status_code == 401


class TestTeamMembers:
    """团队成员测试"""

    @pytest.mark.asyncio
    async def test_list_members(self, client: AsyncClient, auth_headers: dict):
        """测试列出成员"""
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Team", "slug": "team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/teams/{team_id}/members", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["role"] == "owner"

    @pytest.mark.asyncio
    async def test_add_member(self, client: AsyncClient, auth_headers: dict, another_user):
        """测试添加成员"""
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Team", "slug": "team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"user_id": str(another_user.id), "role": "member"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] == str(another_user.id)
        assert data["role"] == "member"

    @pytest.mark.asyncio
    async def test_add_duplicate_member(self, client: AsyncClient, auth_headers: dict, another_user):
        """测试添加重复成员"""
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Team", "slug": "team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"user_id": str(another_user.id), "role": "member"},
            headers=auth_headers,
        )
        response = await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"user_id": str(another_user.id), "role": "member"},
            headers=auth_headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_remove_member(self, client: AsyncClient, auth_headers: dict, another_user):
        """测试移除成员"""
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Team", "slug": "team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"user_id": str(another_user.id), "role": "member"},
            headers=auth_headers,
        )

        response = await client.delete(
            f"/api/v1/teams/{team_id}/members/{another_user.id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_update_member_role(self, client: AsyncClient, auth_headers: dict, another_user):
        """测试更新成员角色"""
        create_resp = await client.post(
            "/api/v1/teams",
            json={"name": "Team", "slug": "team"},
            headers=auth_headers,
        )
        team_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"user_id": str(another_user.id), "role": "member"},
            headers=auth_headers,
        )

        response = await client.put(
            f"/api/v1/teams/{team_id}/members/{another_user.id}/role",
            json={"role": "admin"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["new_role"] == "admin"
