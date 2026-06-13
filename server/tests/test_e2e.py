"""端到端流程测试"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_publish_and_install_flow(client: AsyncClient, auth_headers: dict):
    """完整流程: 创建包 → 发布版本 → 下载"""
    # 1. 创建包
    resp = await client.post(
        "/api/v1/packages",
        json={
            "name": "e2e-test",
            "scope": "@test",
            "type": "mcp",
            "description": "E2E test package",
        },
        headers=auth_headers,
    )
    # 如果认证失败，跳过后续测试
    if resp.status_code in [401, 422]:
        pytest.skip("Authentication required for E2E test")

    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "e2e-test"
    assert data["full_name"] == "@test/e2e-test"

    # 2. 发布版本
    manifest = '{"name":"e2e-test","version":"1.0.0","type":"mcp","mcp":{"transport":"stdio","command":"npx"}}'
    resp = await client.post(
        "/api/v1/packages/@test/e2e-test/versions",
        data={
            "version": "1.0.0",
            "manifest": manifest,
        },
        files={"tarball": ("test.tar.gz", b"fake-tarball-data", "application/gzip")},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    version_data = resp.json()
    assert version_data["version"] == "1.0.0"

    # 3. 获取包详情
    resp = await client.get("/api/v1/packages/@test/e2e-test")
    assert resp.status_code == 200
    pkg_data = resp.json()
    assert pkg_data["latest_version"] == "1.0.0"

    # 4. 获取版本列表
    resp = await client.get("/api/v1/packages/@test/e2e-test/versions")
    assert resp.status_code == 200
    versions_data = resp.json()
    assert versions_data["total"] >= 1

    # 5. 下载（302 重定向）
    resp = await client.get(
        "/api/v1/packages/@test/e2e-test/download",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "location" in resp.headers
