"""评价/评分系统测试"""

import uuid

import pytest
from httpx import AsyncClient


class TestCreateReview:
    """创建评价测试"""

    @pytest.mark.asyncio
    async def test_create_review(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """测试创建评价"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        response = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 5, "comment": "非常好用的工具！"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["rating"] == 5
        assert data["comment"] == "非常好用的工具！"

    @pytest.mark.asyncio
    async def test_create_review_unauthorized(self, client: AsyncClient, test_package_with_version: dict):
        """测试未登录创建评价返回 401"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        response = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 5, "comment": "好"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_review_invalid_rating(
        self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict
    ):
        """测试无效评分（超出 1-5 范围）"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        # 评分 0
        response = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 0, "comment": "差"},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # 评分 6
        response = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 6, "comment": "太好了"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_review_duplicate(
        self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict
    ):
        """测试重复评价返回 409"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        # 第一次创建
        response = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 5, "comment": "好"},
            headers=auth_headers,
        )
        assert response.status_code == 201

        # 第二次创建（同一用户同一包）
        response = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 3, "comment": "改主意了"},
            headers=auth_headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_create_review_deleted_package(self, client: AsyncClient, auth_headers: dict, deleted_package: dict):
        """测试对已删除包创建评价返回 410"""
        scope = deleted_package["scope"]
        name = deleted_package["name"]

        response = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 5, "comment": "好"},
            headers=auth_headers,
        )
        assert response.status_code == 410

    @pytest.mark.asyncio
    async def test_create_review_package_not_found(self, client: AsyncClient, auth_headers: dict):
        """测试对不存在的包创建评价返回 404"""
        response = await client.post(
            "/api/v1/packages/@nonexistent/pkg/reviews",
            json={"rating": 5, "comment": "好"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestListReviews:
    """获取评价列表测试"""

    @pytest.mark.asyncio
    async def test_list_reviews_empty(self, client: AsyncClient, test_package_with_version: dict):
        """测试获取空评价列表"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        response = await client.get(f"/api/v1/packages/{scope}/{name}/reviews")

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 0

    @pytest.mark.asyncio
    async def test_list_reviews_with_data(self, client: AsyncClient, test_package_with_version: dict):
        """测试获取有评价的列表"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        # 获取评价列表
        response = await client.get(f"/api/v1/packages/{scope}/{name}/reviews")

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_list_reviews_package_not_found(self, client: AsyncClient):
        """测试获取不存在包的评价返回 404"""
        response = await client.get("/api/v1/packages/@nonexistent/pkg/reviews")
        assert response.status_code == 404


class TestUpdateReview:
    """更新评价测试"""

    @pytest.mark.asyncio
    async def test_update_review(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """测试更新自己的评价"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        # 先创建评价
        create_resp = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 5, "comment": "好"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 201
        review_id = create_resp.json()["id"]

        # 更新评价
        response = await client.put(
            f"/api/v1/packages/{scope}/{name}/reviews/{review_id}",
            json={"rating": 4, "comment": "更新了评论"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rating"] == 4
        assert data["comment"] == "更新了评论"

    @pytest.mark.asyncio
    async def test_update_review_not_owner(
        self,
        client: AsyncClient,
        auth_headers: dict,
        another_auth_headers: dict,
        test_package_with_version: dict,
    ):
        """测试更新别人的评价返回 403"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        # 用户 A 创建评价
        create_resp = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 5, "comment": "好"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 201
        review_id = create_resp.json()["id"]

        # 用户 B 尝试更新
        response = await client.put(
            f"/api/v1/packages/{scope}/{name}/reviews/{review_id}",
            json={"rating": 1, "comment": "不好"},
            headers=another_auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_review_unauthorized(self, client: AsyncClient, test_package_with_version: dict):
        """测试未登录更新评价返回 401"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        response = await client.put(
            f"/api/v1/packages/{scope}/{name}/reviews/fake-id",
            json={"rating": 3},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_review_not_found(
        self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict
    ):
        """测试更新不存在的评价返回 404"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        response = await client.put(
            f"/api/v1/packages/{scope}/{name}/reviews/{uuid.uuid4()}",
            json={"rating": 3, "comment": "不存在"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeleteReview:
    """删除评价测试"""

    @pytest.mark.asyncio
    async def test_delete_review(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """测试删除自己的评价"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        # 先创建评价
        create_resp = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 5, "comment": "好"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 201
        review_id = create_resp.json()["id"]

        # 删除评价
        response = await client.delete(
            f"/api/v1/packages/{scope}/{name}/reviews/{review_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_review_not_owner(
        self,
        client: AsyncClient,
        auth_headers: dict,
        another_auth_headers: dict,
        test_package_with_version: dict,
    ):
        """测试删除别人的评价返回 403"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        # 用户 A 创建评价
        create_resp = await client.post(
            f"/api/v1/packages/{scope}/{name}/reviews",
            json={"rating": 5, "comment": "好"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 201
        review_id = create_resp.json()["id"]

        # 用户 B 尝试删除
        response = await client.delete(
            f"/api/v1/packages/{scope}/{name}/reviews/{review_id}",
            headers=another_auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_review_not_found(
        self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict
    ):
        """测试删除不存在的评价返回 404"""
        scope = test_package_with_version["scope"]
        name = test_package_with_version["name"]

        response = await client.delete(
            f"/api/v1/packages/{scope}/{name}/reviews/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestReviewStats:
    """评价统计测试"""

    async def test_stats_empty_reviews(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """无评价时统计应返回零值"""
        pkg = test_package_with_version
        response = await client.get(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/reviews/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["average_rating"] == 0.0
        assert data["total_reviews"] == 0
        assert data["rating_distribution"] == {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}

    async def test_stats_with_reviews(self, client: AsyncClient, auth_headers: dict, test_package_with_version: dict):
        """有评价时应正确统计分布"""
        pkg = test_package_with_version
        # 创建多条评价（不同星级）
        users_data = [
            ("stats_user1", "stats1@test.com", 5),
            ("stats_user2", "stats2@test.com", 4),
            ("stats_user3", "stats3@test.com", 5),
            ("stats_user4", "stats4@test.com", 3),
        ]

        for username, email, rating in users_data:
            # 创建用户
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "username": username,
                    "email": email,
                    "password": "StrongPass123!",
                },
            )
            token = resp.json()["token"]
            # 创建评价
            await client.post(
                f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/reviews",
                json={"rating": rating, "comment": f"Rating {rating}"},
                headers={"Authorization": f"Bearer {token}"},
            )

        response = await client.get(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/reviews/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_reviews"] == 4
        assert data["average_rating"] == 4.2  # round((5+4+5+3)/4, 1)
        assert data["rating_distribution"]["5"] == 2
        assert data["rating_distribution"]["4"] == 1
        assert data["rating_distribution"]["3"] == 1
