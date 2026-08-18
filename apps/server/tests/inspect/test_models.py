import pytest
import uuid
from app.models.health_check import AgentHealthCheck
from app.models.package import Package


@pytest.mark.asyncio
async def test_agent_health_check_model(db):
    """AgentHealthCheck model can be created with all fields"""

    pkg = Package(
        id=str(uuid.uuid4()),
        name="test-skill",
        scope="test",
        full_name="@test/test-skill",
        type="skill",
        owner_id=str(uuid.uuid4()),
        owner_type="user",
    )
    db.add(pkg)
    await db.flush()

    check = AgentHealthCheck(
        id=str(uuid.uuid4()),
        package_id=str(pkg.id),
        version="1.0.0",
        compliance_status="pass",
        compliance_detail={"errors": [], "manifest_valid": True},
        content_status="pass",
        content_detail={"source": "inline", "content_length": 100},
        functional_status="pass",
        functional_detail={"response_length": 50},
        freshness_status="pass",
        freshness_detail={"last_update_days": 30},
        overall_status="healthy",
        trigger_type="manual",
        llm_tokens_used=150,
    )
    db.add(check)
    await db.flush()

    from sqlalchemy import select
    result = await db.execute(select(AgentHealthCheck).where(AgentHealthCheck.id == check.id))
    fetched = result.scalar_one_or_none()
    assert fetched is not None
    assert fetched.overall_status == "healthy"
    assert fetched.compliance_status == "pass"
    assert fetched.trigger_type == "manual"


@pytest.mark.asyncio
async def test_package_health_columns(db):
    """Package model has health_status, needs_check, last_check_at columns"""
    pkg = Package(
        id=str(uuid.uuid4()),
        name="health-test",
        scope="test",
        full_name="@test/health-test",
        type="skill",
        owner_id=str(uuid.uuid4()),
        owner_type="user",
        health_status="degraded",
        needs_check=True,
    )
    db.add(pkg)
    await db.flush()

    from sqlalchemy import select
    result = await db.execute(select(Package).where(Package.id == pkg.id))
    fetched = result.scalar_one_or_none()
    assert fetched.health_status == "degraded"
    assert fetched.needs_check is True
    assert fetched.last_check_at is None
