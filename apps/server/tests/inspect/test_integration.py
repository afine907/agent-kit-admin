"""集成测试 - 完整巡检流程"""

import pytest
import uuid
import httpx
from httpx import AsyncClient, MockTransport, Response
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy import select, update
from app.models.package import Package
from app.models.version import Version
from app.models.health_check import AgentHealthCheck
from app.inspect.inspector import InspectorService
from app.inspect.events import mark_needs_check


async def _create_skill_with_version(db, name="int-test", scope="test",
                                       manifest=None):
    pkg = Package(
        id=str(uuid.uuid4()),
        name=name,
        scope=scope,
        full_name=f"@{scope}/{name}",
        type="skill",
        owner_id=str(uuid.uuid4()),
        owner_type="user",
    )
    db.add(pkg)
    await db.flush()

    ver = Version(
        package_id=str(pkg.id),
        version="1.0.0",
        manifest=manifest or {
            "name": name,
            "version": "1.0.0",
            "type": "skill",
            "skill": {"content": "A helpful skill for testing."},
        },
        tarball_hash="abc123",
        tarball_size=1000,
        tarball_path=f"packages/{scope}/{name}/1.0.0.tar.gz",
    )
    db.add(ver)
    await db.flush()
    return pkg, ver


# Fake LLM SSE body
_FAKE_OK_BODY = (
    'data: {"choices": [{"delta": {"content": "这是一个测试 Skill，'
    '用于验证检测流程。示例：运行测试。"}}]}\n\n'
    'data: [DONE]\n\n'
)


@pytest.fixture
def mock_llm(monkeypatch):
    """Mock LLM 返回正常回复"""
    import app.inspect.checks.functional as func_mod

    def handler(request):
        return Response(200, headers={"Content-Type": "text/event-stream"}, content=_FAKE_OK_BODY.encode())

    def client_factory(**kwargs):
        return AsyncClient(transport=MockTransport(handler))

    monkeypatch.setattr(func_mod.settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(func_mod.httpx, "AsyncClient", client_factory)


@pytest.mark.asyncio
async def test_full_check_flow(db, mock_llm):
    """完整检测流程：创建包 → 执行检测 → 验证结果"""
    pkg, ver = await _create_skill_with_version(db)

    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = True

    inspector = InspectorService(db, mock_storage)
    check = await inspector.run_check(pkg, ver, trigger="manual")
    await db.commit()

    # 验证检测结果
    assert check.overall_status == "healthy"
    assert check.compliance_status == "pass"
    assert check.content_status == "pass"
    assert check.functional_status == "pass"
    assert check.freshness_status == "pass"
    assert check.trigger_type == "manual"

    # 验证包状态已更新
    result = await db.execute(select(Package).where(Package.id == pkg.id))
    updated_pkg = result.scalar_one_or_none()
    assert updated_pkg.health_status == "healthy"
    assert updated_pkg.needs_check is False
    assert updated_pkg.last_check_at is not None


@pytest.mark.asyncio
async def test_degraded_detection(db, mock_llm):
    """检测降级包：content 超大的 manifest"""
    pkg, ver = await _create_skill_with_version(
        db,
        manifest={
            "name": "bad-skill",
            "version": "1.0.0",
            "type": "skill",
            "skill": {"content": "x" * 50001},  # 超过 50KB
        },
    )

    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = True

    inspector = InspectorService(db, mock_storage)
    check = await inspector.run_check(pkg, ver, trigger="manual")
    await db.commit()

    assert check.overall_status == "degraded"
    assert check.compliance_status == "fail"


@pytest.mark.asyncio
async def test_pending_check_flow(db, mock_llm):
    """needs_check 触发流程"""
    pkg, ver = await _create_skill_with_version(db, name="pending-test")

    # 标记 needs_check
    await mark_needs_check(db, str(pkg.id))
    await db.flush()

    # 验证标记成功
    result = await db.execute(select(Package).where(Package.id == pkg.id))
    assert result.scalar_one_or_none().needs_check is True

    # 执行检测
    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = True

    inspector = InspectorService(db, mock_storage)
    check = await inspector.run_check(pkg, ver, trigger="manual")
    await db.commit()

    # 验证 needs_check 已被清除
    result = await db.execute(select(Package).where(Package.id == pkg.id))
    updated_pkg = result.scalar_one_or_none()
    assert updated_pkg.needs_check is False
    assert updated_pkg.health_status == "healthy"
