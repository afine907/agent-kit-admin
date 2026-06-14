"""健康检查测试"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """测试健康检查端点"""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    # 测试环境中 MinIO 可能不可用，接受 "ok" 或 "degraded"
    assert data["status"] in ["ok", "degraded"]
    assert "version" in data
    assert "services" in data


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    """测试根路径"""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data
    assert "health" in data
