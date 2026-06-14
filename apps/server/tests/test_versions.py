"""版本管理 API 测试"""

import pytest
import json
from httpx import AsyncClient
from tests.helpers import create_test_tarball


class TestVersionPublish:
    """版本发布测试"""

    @pytest.mark.asyncio
    async def test_publish_version_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_package: dict,
    ):
        """测试发布版本成功"""
        tarball = create_test_tarball()
        manifest = json.dumps(
            {
                "name": test_package["name"],
                "version": "1.0.0",
                "type": "mcp",
                "mcp": {
                    "transport": "stdio",
                    "command": "node",
                    "args": ["index.js"],
                },
            }
        )

        response = await client.post(
            f"/api/v1/packages/{test_package['scope']}/{test_package['name']}/versions",
            data={
                "version": "1.0.0",
                "manifest": manifest,
                "tag": "latest",
            },
            files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["version"] == "1.0.0"
        assert "id" in data
        assert "published_at" in data

    @pytest.mark.asyncio
    async def test_publish_version_duplicate(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_package_with_version: dict,
    ):
        """测试发布重复版本"""
        tarball = create_test_tarball()
        manifest = json.dumps(
            {
                "name": test_package_with_version["name"],
                "version": "1.0.0",
                "type": "mcp",
            }
        )

        response = await client.post(
            f"/api/v1/packages/{test_package_with_version['scope']}/{test_package_with_version['name']}/versions",
            data={
                "version": "1.0.0",
                "manifest": manifest,
            },
            files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
            headers=auth_headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_publish_version_invalid_semver(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_package: dict,
    ):
        """测试无效版本号"""
        tarball = create_test_tarball()
        manifest = json.dumps({"name": test_package["name"], "type": "mcp"})

        response = await client.post(
            f"/api/v1/packages/{test_package['scope']}/{test_package['name']}/versions",
            data={
                "version": "not-a-version",
                "manifest": manifest,
            },
            files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
            headers=auth_headers,
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_publish_version_unauthorized(
        self,
        client: AsyncClient,
        test_package: dict,
    ):
        """测试未认证发布版本"""
        tarball = create_test_tarball()
        manifest = json.dumps({"name": test_package["name"], "type": "mcp"})

        response = await client.post(
            f"/api/v1/packages/{test_package['scope']}/{test_package['name']}/versions",
            data={
                "version": "1.0.0",
                "manifest": manifest,
            },
            files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_publish_version_package_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """测试发布到不存在的包"""
        tarball = create_test_tarball()
        manifest = json.dumps({"name": "nonexistent", "type": "mcp"})

        response = await client.post(
            "/api/v1/packages/@nonexist/nope/versions",
            data={
                "version": "1.0.0",
                "manifest": manifest,
            },
            files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_publish_version_updates_latest(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_package: dict,
    ):
        """测试发布新版本更新 latest"""
        # 发布 1.0.0
        tarball1 = create_test_tarball()
        manifest1 = json.dumps(
            {
                "name": test_package["name"],
                "version": "1.0.0",
                "type": "mcp",
                "mcp": {
                    "transport": "stdio",
                    "command": "node",
                    "args": ["index.js"],
                },
            }
        )

        response1 = await client.post(
            f"/api/v1/packages/{test_package['scope']}/{test_package['name']}/versions",
            data={"version": "1.0.0", "manifest": manifest1},
            files={"tarball": ("package.tar.gz", tarball1, "application/gzip")},
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # 发布 1.1.0
        tarball2 = create_test_tarball()
        manifest2 = json.dumps(
            {
                "name": test_package["name"],
                "version": "1.1.0",
                "type": "mcp",
                "mcp": {
                    "transport": "stdio",
                    "command": "node",
                    "args": ["index.js"],
                },
            }
        )

        response2 = await client.post(
            f"/api/v1/packages/{test_package['scope']}/{test_package['name']}/versions",
            data={"version": "1.1.0", "manifest": manifest2, "tag": "latest"},
            files={"tarball": ("package.tar.gz", tarball2, "application/gzip")},
            headers=auth_headers,
        )
        assert response2.status_code == 201

        # 验证最新版本已更新
        get_response = await client.get(f"/api/v1/packages/{test_package['scope']}/{test_package['name']}")
        assert get_response.status_code == 200
        assert get_response.json()["latest_version"] == "1.1.0"


class TestVersionDownload:
    """版本下载测试"""

    @pytest.mark.asyncio
    async def test_download_version_success(
        self,
        client: AsyncClient,
        test_package_with_version: dict,
    ):
        """测试下载版本成功"""
        pkg = test_package_with_version
        response = await client.get(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions/1.0.0/download",
            follow_redirects=False,
        )
        # 应该重定向到 MinIO 预签名 URL
        assert response.status_code == 302
        assert "minio" in response.headers["location"].lower() or "packages" in response.headers["location"]

    @pytest.mark.asyncio
    async def test_download_version_not_found(
        self,
        client: AsyncClient,
        test_package: dict,
    ):
        """测试下载不存在的版本"""
        response = await client.get(
            f"/api/v1/packages/{test_package['scope']}/{test_package['name']}/versions/99.99.99/download"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_download_latest_version(
        self,
        client: AsyncClient,
        test_package_with_version: dict,
    ):
        """测试下载最新版本"""
        pkg = test_package_with_version
        response = await client.get(
            f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/download",
            follow_redirects=False,
        )
        assert response.status_code == 302


class TestVersionList:
    """版本列表测试"""

    @pytest.mark.asyncio
    async def test_list_versions_empty(
        self,
        client: AsyncClient,
        test_package: dict,
    ):
        """测试空版本列表"""
        response = await client.get(f"/api/v1/packages/{test_package['scope']}/{test_package['name']}/versions")
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []

    @pytest.mark.asyncio
    async def test_list_versions_with_data(
        self,
        client: AsyncClient,
        test_package_with_version: dict,
    ):
        """测试有数据的版本列表"""
        pkg = test_package_with_version
        response = await client.get(f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) > 0
        assert data["data"][0]["version"] == "1.0.0"

    @pytest.mark.asyncio
    async def test_list_versions_not_found(
        self,
        client: AsyncClient,
    ):
        """测试列出不存在包的版本"""
        response = await client.get("/api/v1/packages/@nonexist/nope/versions")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_versions_pagination(
        self,
        client: AsyncClient,
        test_package_with_version: dict,
    ):
        """测试版本列表分页"""
        pkg = test_package_with_version
        response = await client.get(f"/api/v1/packages/{pkg['scope']}/{pkg['name']}/versions?page=1&per_page=10")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "total" in data
        assert isinstance(data["data"], list)
        assert data["total"] >= 0
