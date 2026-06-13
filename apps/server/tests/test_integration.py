"""集成测试 - 完整用户旅程"""

import pytest
import json
import asyncio
from httpx import AsyncClient
from app.models.user import User
from tests.helpers import create_test_tarball


@pytest.mark.integration
class TestPublishInstallFlow:
    """发布-安装完整流程测试"""

    @pytest.mark.asyncio
    async def test_full_publish_flow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
    ):
        """测试完整的发布流程"""

        # 1. 创建包
        create_response = await client.post(
            "/api/v1/packages",
            json={
                "name": "integration-test-mcp",
                "scope": "@test",
                "type": "mcp",
                "description": "Integration test MCP",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        package_data = create_response.json()
        assert package_data["name"] == "integration-test-mcp"
        assert package_data["full_name"] == "@test/integration-test-mcp"

        # 2. 发布版本 1.0.0
        tarball = create_test_tarball()
        manifest = json.dumps({
            "name": "integration-test-mcp",
            "version": "1.0.0",
            "type": "mcp",
            "mcp": {
                "transport": "stdio",
                "command": "node",
                "args": ["index.js"],
            },
        })

        publish_response = await client.post(
            "/api/v1/packages/@test/integration-test-mcp/versions",
            data={"version": "1.0.0", "manifest": manifest, "tag": "latest"},
            files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
            headers=auth_headers,
        )
        assert publish_response.status_code == 201
        assert publish_response.json()["version"] == "1.0.0"

        # 3. 搜索包
        search_response = await client.get("/api/v1/packages?search=integration-test")
        assert search_response.status_code == 200
        search_data = search_response.json()
        assert len(search_data["data"]) > 0
        assert search_data["data"][0]["name"] == "integration-test-mcp"

        # 4. 获取包详情
        detail_response = await client.get("/api/v1/packages/@test/integration-test-mcp")
        assert detail_response.status_code == 200
        detail_data = detail_response.json()
        assert detail_data["latest_version"] == "1.0.0"
        assert detail_data["downloads_count"] == 0

        # 5. 获取版本列表
        versions_response = await client.get(
            "/api/v1/packages/@test/integration-test-mcp/versions"
        )
        assert versions_response.status_code == 200
        versions_data = versions_response.json()
        assert len(versions_data["data"]) == 1
        assert versions_data["data"][0]["version"] == "1.0.0"

        # 6. 发布新版本 1.1.0
        tarball2 = create_test_tarball()
        manifest2 = json.dumps({
            "name": "integration-test-mcp",
            "version": "1.1.0",
            "type": "mcp",
            "mcp": {
                "transport": "stdio",
                "command": "node",
                "args": ["index.js"],
            },
        })

        publish_response2 = await client.post(
            "/api/v1/packages/@test/integration-test-mcp/versions",
            data={"version": "1.1.0", "manifest": manifest2, "tag": "latest"},
            files={"tarball": ("package.tar.gz", tarball2, "application/gzip")},
            headers=auth_headers,
        )
        assert publish_response2.status_code == 201
        assert publish_response2.json()["version"] == "1.1.0"

        # 7. 验证最新版本已更新
        updated_detail = await client.get("/api/v1/packages/@test/integration-test-mcp")
        assert updated_detail.status_code == 200
        assert updated_detail.json()["latest_version"] == "1.1.0"

        # 8. 获取更新后的版本列表
        updated_versions = await client.get(
            "/api/v1/packages/@test/integration-test-mcp/versions"
        )
        assert updated_versions.status_code == 200
        assert len(updated_versions.json()["data"]) == 2

        # 9. 下载版本
        download_response = await client.get(
            "/api/v1/packages/@test/integration-test-mcp/versions/1.0.0/download",
            follow_redirects=False,
        )
        assert download_response.status_code == 302

        # 10. 下载最新版本
        latest_download_response = await client.get(
            "/api/v1/packages/@test/integration-test-mcp/download",
            follow_redirects=False,
        )
        assert latest_download_response.status_code == 302

    @pytest.mark.asyncio
    async def test_search_and_filter_flow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
    ):
        """测试搜索和筛选流程"""

        # 创建多个不同类型的包
        packages = [
            {"name": "mcp-1", "type": "mcp", "description": "First MCP"},
            {"name": "mcp-2", "type": "mcp", "description": "Second MCP"},
            {"name": "skill-1", "type": "skill", "description": "First Skill"},
        ]

        for pkg in packages:
            response = await client.post(
                "/api/v1/packages",
                json={
                    "name": pkg["name"],
                    "scope": "@test",
                    "type": pkg["type"],
                    "description": pkg["description"],
                },
                headers=auth_headers,
            )
            assert response.status_code == 201

        # 测试列表
        list_response = await client.get("/api/v1/packages")
        assert list_response.status_code == 200
        assert len(list_response.json()["data"]) >= 3

        # 测试按类型筛选
        mcp_response = await client.get("/api/v1/packages?type=mcp")
        assert mcp_response.status_code == 200
        for pkg in mcp_response.json()["data"]:
            assert pkg["type"] == "mcp"

        skill_response = await client.get("/api/v1/packages?type=skill")
        assert skill_response.status_code == 200
        for pkg in skill_response.json()["data"]:
            assert pkg["type"] == "skill"

        # 测试搜索
        search_response = await client.get("/api/v1/packages?search=mcp-1")
        assert search_response.status_code == 200
        assert len(search_response.json()["data"]) > 0

    @pytest.mark.asyncio
    async def test_error_handling_flow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
    ):
        """测试错误处理流程"""

        # 1. 尝试获取不存在的包
        not_found_response = await client.get("/api/v1/packages/@nonexist/nope")
        assert not_found_response.status_code == 404
        assert not_found_response.json()["error"]["code"] == 20003

        # 2. 创建包
        create_response = await client.post(
            "/api/v1/packages",
            json={
                "name": "error-test-mcp",
                "scope": "@test",
                "type": "mcp",
                "description": "Error test MCP",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 201

        # 3. 尝试创建重复包名
        duplicate_response = await client.post(
            "/api/v1/packages",
            json={
                "name": "error-test-mcp",
                "scope": "@test",
                "type": "mcp",
            },
            headers=auth_headers,
        )
        assert duplicate_response.status_code == 409
        assert duplicate_response.json()["error"]["code"] == 20004

        # 4. 发布版本
        tarball = create_test_tarball()
        manifest = json.dumps({
            "name": "error-test-mcp",
            "version": "1.0.0",
            "type": "mcp",
            "mcp": {
                "transport": "stdio",
                "command": "node",
                "args": ["index.js"],
            },
        })

        publish_response = await client.post(
            "/api/v1/packages/@test/error-test-mcp/versions",
            data={"version": "1.0.0", "manifest": manifest},
            files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
            headers=auth_headers,
        )
        assert publish_response.status_code == 201

        # 5. 尝试发布重复版本
        duplicate_version_response = await client.post(
            "/api/v1/packages/@test/error-test-mcp/versions",
            data={"version": "1.0.0", "manifest": manifest},
            files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
            headers=auth_headers,
        )
        assert duplicate_version_response.status_code == 409

        # 6. 删除包
        delete_response = await client.delete(
            "/api/v1/packages/@test/error-test-mcp",
            headers=auth_headers,
        )
        assert delete_response.status_code == 200

        # 7. 验证包已被软删除
        deleted_response = await client.get("/api/v1/packages/@test/error-test-mcp")
        assert deleted_response.status_code == 410
        assert deleted_response.json()["error"]["code"] == 20005

        # 8. 尝试删除已删除的包
        already_deleted_response = await client.delete(
            "/api/v1/packages/@test/error-test-mcp",
            headers=auth_headers,
        )
        assert already_deleted_response.status_code == 410


@pytest.mark.integration
class TestMultiUserFlow:
    """多用户流程测试"""

    @pytest.mark.asyncio
    async def test_package_ownership(
        self,
        client: AsyncClient,
        auth_headers: dict,
        another_auth_headers: dict,
        test_user: User,
        another_user: User,
    ):
        """测试包所有权"""

        # 1. 用户 A 创建包
        create_response = await client.post(
            "/api/v1/packages",
            json={
                "name": "owned-mcp",
                "scope": "@test",
                "type": "mcp",
                "description": "Owned MCP",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 201

        # 2. 用户 B 尝试删除用户 A 的包
        delete_response = await client.delete(
            "/api/v1/packages/@test/owned-mcp",
            headers=another_auth_headers,
        )
        assert delete_response.status_code == 403

        # 3. 用户 A 可以删除自己的包
        delete_own_response = await client.delete(
            "/api/v1/packages/@test/owned-mcp",
            headers=auth_headers,
        )
        assert delete_own_response.status_code == 200

    @pytest.mark.asyncio
    async def test_concurrent_publish(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
    ):
        """测试并发发布 - 使用 asyncio.gather 真正并发"""

        # 创建包
        create_response = await client.post(
            "/api/v1/packages",
            json={
                "name": "concurrent-mcp",
                "scope": "@test",
                "type": "mcp",
                "description": "Concurrent test MCP",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 201

        # 准备两个并发发布请求
        manifest = json.dumps({
            "name": "concurrent-mcp",
            "version": "1.0.0",
            "type": "mcp",
            "mcp": {
                "transport": "stdio",
                "command": "node",
                "args": ["index.js"],
            },
        })

        async def publish_version(tarball_content: bytes):
            """发送发布请求"""
            tarball = create_test_tarball(content=tarball_content)
            return await client.post(
                "/api/v1/packages/@test/concurrent-mcp/versions",
                data={"version": "1.0.0", "manifest": manifest},
                files={"tarball": ("package.tar.gz", tarball, "application/gzip")},
                headers=auth_headers,
            )

        # 并发发送两个发布请求
        response1, response2 = await asyncio.gather(
            publish_version(b"content-1"),
            publish_version(b"content-2"),
        )

        # 验证一个成功一个失败（版本冲突）
        status_codes = {response1.status_code, response2.status_code}
        assert 201 in status_codes, f"Expected one success (201), got {status_codes}"
        assert 409 in status_codes, f"Expected one conflict (409), got {status_codes}"
