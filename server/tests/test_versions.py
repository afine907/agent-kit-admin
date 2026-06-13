"""版本管理 API 测试"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_versions_not_found(client: AsyncClient):
    """测试列出不存在包的版本"""
    response = await client.get("/api/v1/packages/@nonexist/nope/versions")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_publish_version_unauthorized(client: AsyncClient):
    """测试未认证发布版本"""
    response = await client.post(
        "/api/v1/packages/@test/test/versions",
        data={"version": "1.0.0", "manifest": "{}"},
    )
    assert response.status_code == 422 or response.status_code == 401


@pytest.mark.asyncio
async def test_publish_version_invalid_manifest(client: AsyncClient, auth_headers: dict):
    """测试无效 manifest 发布版本"""
    response = await client.post(
        "/api/v1/packages/@test/test/versions",
        data={
            "version": "1.0.0",
            "manifest": "invalid json",
        },
        headers=auth_headers,
    )
    assert response.status_code in [400, 404]
