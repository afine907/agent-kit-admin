import pytest
import uuid
from httpx import AsyncClient
from app.models.package import Package
from app.models.health_check import AgentHealthCheck


async def _create_skill_with_check(db, overall="healthy"):
    pkg = Package(
        id=str(uuid.uuid4()),
        name="api-test-skill",
        scope="test",
        full_name="@test/api-test-skill",
        type="skill",
        owner_id=str(uuid.uuid4()),
        owner_type="user",
        health_status=overall,
    )
    db.add(pkg)
    await db.flush()

    check = AgentHealthCheck(
        package_id=str(pkg.id),
        version="1.0.0",
        overall_status=overall,
        compliance_status="pass",
        content_status="pass",
        functional_status="pass",
        freshness_status="pass",
        trigger_type="manual",
    )
    db.add(check)
    await db.flush()
    return pkg, check


@pytest.mark.asyncio
async def test_get_health_status(client: AsyncClient, db, auth_headers):
    """GET /api/v1/health/check/{scope}/{name} 返回检测结果"""
    pkg, check = await _create_skill_with_check(db, "healthy")

    response = await client.get(
        "/api/v1/health/check/test/api-test-skill",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["overall"] == "healthy"
    assert data["compliance"]["status"] == "pass"


@pytest.mark.asyncio
async def test_trigger_check(client: AsyncClient, db, auth_headers):
    """POST /api/v1/health/check/{scope}/{name} 触发检测"""
    pkg, _ = await _create_skill_with_check(db)
    pkg.needs_check = False
    await db.flush()

    response = await client.post(
        "/api/v1/health/check/test/api-test-skill",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "queued"


@pytest.mark.asyncio
async def test_get_overview(client: AsyncClient, db, auth_headers):
    """GET /api/v1/health/overview 返回统计"""
    await _create_skill_with_check(db, "healthy")
    pkg2 = Package(
        id=str(uuid.uuid4()),
        name="api-test-skill-2",
        scope="test",
        full_name="@test/api-test-skill-2",
        type="skill",
        owner_id=str(uuid.uuid4()),
        owner_type="user",
        health_status="degraded",
    )
    db.add(pkg2)
    await db.flush()

    check2 = AgentHealthCheck(
        package_id=str(pkg2.id),
        version="1.0.0",
        overall_status="degraded",
        compliance_status="fail",
        content_status="pass",
        functional_status="pass",
        freshness_status="pass",
        trigger_type="scheduled",
    )
    db.add(check2)
    await db.flush()

    response = await client.get(
        "/api/v1/health/overview",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
