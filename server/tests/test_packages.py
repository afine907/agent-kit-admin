"""包管理 API 测试"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_packages(client: AsyncClient):
    """测试列出包"""
    response = await client.get("/api/v1/packages")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "pagination" in data
    assert isinstance(data["data"], list)
    assert "page" in data["pagination"]
    assert "per_page" in data["pagination"]
    assert "total" in data["pagination"]


@pytest.mark.asyncio
async def test_list_packages_with_type_filter(client: AsyncClient):
    """测试按类型筛选"""
    response = await client.get("/api/v1/packages?type=mcp")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data


@pytest.mark.asyncio
async def test_list_packages_with_search(client: AsyncClient):
    """测试搜索包"""
    response = await client.get("/api/v1/packages?search=test")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data


@pytest.mark.asyncio
async def test_get_package_not_found(client: AsyncClient):
    """测试获取不存在的包"""
    response = await client.get("/api/v1/packages/@nonexist/nope")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data


@pytest.mark.asyncio
async def test_create_package_unauthorized(client: AsyncClient):
    """测试未认证创建包"""
    response = await client.post("/api/v1/packages", json={
        "name": "test-mcp",
        "scope": "@test",
        "type": "mcp",
        "description": "Test MCP",
    })
    assert response.status_code == 422 or response.status_code == 401


@pytest.mark.asyncio
async def test_create_package_validation(client: AsyncClient, auth_headers: dict):
    """测试创建包验证"""
    # 无效的包名
    response = await client.post(
        "/api/v1/packages",
        json={
            "name": "INVALID_NAME",
            "scope": "@test",
            "type": "mcp",
        },
        headers=auth_headers,
    )
    assert response.status_code in [400, 422]
