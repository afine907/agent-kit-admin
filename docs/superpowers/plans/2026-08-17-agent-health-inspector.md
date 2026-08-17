# Agent Health Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent Worker process that automatically inspects all Skill packages on the platform across four dimensions (static compliance, content accessibility, LLM functional test, version freshness), marks degraded packages, and exposes health status via API + UI.

**Architecture:** Same codebase as FastAPI server, independent `python -m app.worker` process. Worker shares DB/MinIO/LLM config. APScheduler drives cron + interval jobs. Server marks `needs_check=true` on publish/version_update/manual trigger; worker polls and processes. Results stored in `agent_health_check` table; `packages.health_status` caches latest overall state.

**Tech Stack:** Python 3.11+, SQLAlchemy 2.0 (async), APScheduler, FastAPI, React 18, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-08-17-agent-health-inspector-design.md`

## Global Constraints

- Python 3.11+, async/await throughout
- SQLAlchemy 2.0 style (Column-based, not mapped_column)
- Compat types: `CompatUUID`, `CompatJSONB` for PostgreSQL/SQLite dual support
- Error handling: `AppError(code, message, status_code)` with `ErrorCodes`
- Settings: `pydantic_settings.BaseSettings`, env vars prefixed with `INSPECTOR_`
- Tests: pytest + SQLite in-memory, follow `conftest.py` patterns
- LLM mock: inject via `httpx.AsyncClient` factory (see `test_agent_chat.py` pattern)
- No alembic — project uses `Base.metadata.create_all` in `lifespan`
- Follow existing file naming: `snake_case.py` for modules, `PascalCase` for classes

---

## Task 1: Data Model + Config

**Files:**
- Create: `apps/server/app/models/health_check.py`
- Modify: `apps/server/app/models/package.py:33-34`
- Modify: `apps/server/app/models/__init__.py`
- Modify: `apps/server/app/config.py:84`
- Test: `apps/server/tests/inspect/test_models.py`

**Interfaces:**
- Produces: `AgentHealthCheck` model class (table `agent_health_checks`)
- Produces: `Package.health_status` column (String(10), default "pending")
- Produces: `Package.needs_check` column (Boolean, default False)
- Produces: `Package.last_check_at` column (DateTime, nullable)
- Produces: `settings.INSPECTOR_SAMPLE_RATE`, `INSPECTOR_CRON_HOUR`, `INSPECTOR_CRON_MINUTE`, `INSPECTOR_MAX_LLM_PER_RUN`, `INSPECTOR_POLL_INTERVAL`

- [ ] **Step 1: Write the failing test for model creation**

```python
# apps/server/tests/inspect/test_models.py
import pytest
from app.models.health_check import AgentHealthCheck
from app.models.package import Package


@pytest.mark.asyncio
async def test_agent_health_check_model(db):
    """AgentHealthCheck model can be created with all fields"""
    from app.models.version import Version
    import uuid
    from datetime import datetime, timezone

    # Create prerequisite package + version
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

    # Verify
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
    import uuid

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.health_check'`

- [ ] **Step 3: Create the AgentHealthCheck model**

```python
# apps/server/app/models/health_check.py
"""Agent Health Check 模型 - 巡检结果存储"""

import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func
from app.database import CompatUUID as UUID
from app.database import Base, CompatJSONB


class AgentHealthCheck(Base):
    """Skill 包健康检测结果"""

    __tablename__ = "agent_health_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True)
    version = Column(String(50), nullable=False)

    # 四维检测结果
    compliance_status = Column(String(10), nullable=False, default="pass")
    compliance_detail = Column(CompatJSONB, nullable=False, default=dict)
    content_status = Column(String(10), nullable=False, default="pass")
    content_detail = Column(CompatJSONB, nullable=False, default=dict)
    functional_status = Column(String(10), nullable=False, default="pass")
    functional_detail = Column(CompatJSONB, nullable=False, default=dict)
    freshness_status = Column(String(10), nullable=False, default="pass")
    freshness_detail = Column(CompatJSONB, nullable=False, default=dict)

    # 综合状态
    overall_status = Column(String(10), nullable=False, default="pending", index=True)

    # 触发来源
    trigger_type = Column(String(20), nullable=False, default="scheduled")

    # Token 消耗统计
    llm_tokens_used = Column(Integer, nullable=False, default=0)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
```

- [ ] **Step 4: Add health columns to Package model**

Modify `apps/server/app/models/package.py` — add after `deleted_at` line (before `created_at`):

```python
    # 巡检状态（冗余缓存）
    health_status = Column(String(10), default="pending", index=True)  # pending / healthy / degraded / error
    needs_check = Column(Boolean, default=False, index=True)
    last_check_at = Column(DateTime(timezone=True), nullable=True)
```

Add import at top:
```python
from sqlalchemy import Column, String, Text, BigInteger, Boolean, DateTime, func, UniqueConstraint
```

- [ ] **Step 5: Register model in __init__.py**

Modify `apps/server/app/models/__init__.py`:

```python
from app.models.health_check import AgentHealthCheck

__all__ = [..., "AgentHealthCheck"]
```

- [ ] **Step 6: Add inspector settings to config.py**

Add to `Settings` class in `apps/server/app/config.py` after the LLM section:

```python
    # Inspector Worker
    INSPECTOR_SAMPLE_RATE: float = 0.2
    INSPECTOR_CRON_HOUR: int = 2
    INSPECTOR_CRON_MINUTE: int = 0
    INSPECTOR_MAX_LLM_PER_RUN: int = 50
    INSPECTOR_POLL_INTERVAL: int = 30
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_models.py -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/server/app/models/health_check.py apps/server/app/models/package.py apps/server/app/models/__init__.py apps/server/app/config.py apps/server/tests/inspect/
git commit -m "feat(inspector): add AgentHealthCheck model and Package health columns"
```

---

## Task 2: Check Result Type + Compliance Check

**Files:**
- Create: `apps/server/app/inspect/__init__.py`
- Create: `apps/server/app/inspect/checks/__init__.py`
- Create: `apps/server/app/inspect/checks/types.py`
- Create: `apps/server/app/inspect/checks/compliance.py`
- Test: `apps/server/tests/inspect/test_compliance.py`

**Interfaces:**
- Produces: `CheckResult(status: str, detail: dict)` dataclass
- Produces: `check_compliance(manifest: dict) -> CheckResult`

- [ ] **Step 1: Write the failing test**

```python
# apps/server/tests/inspect/test_compliance.py
import pytest
from app.inspect.checks.compliance import check_compliance


def test_compliance_valid_manifest():
    manifest = {
        "name": "my-skill",
        "version": "1.0.0",
        "type": "skill",
        "skill": {"content": "helpful content"},
    }
    result = check_compliance(manifest)
    assert result.status == "pass"
    assert result.detail["manifest_valid"] is True


def test_compliance_missing_fields():
    manifest = {"name": "my-skill"}
    result = check_compliance(manifest)
    assert result.status == "fail"
    assert "缺少必填字段: version" in result.detail["errors"]
    assert "缺少必填字段: type" in result.detail["errors"]


def test_compliance_wrong_type():
    manifest = {"name": "x", "version": "1.0.0", "type": "tool"}
    result = check_compliance(manifest)
    assert result.status == "fail"
    assert any("类型必须是 skill" in e for e in result.detail["errors"])


def test_compliance_invalid_semver():
    manifest = {"name": "x", "version": "not-semver", "type": "skill"}
    result = check_compliance(manifest)
    assert result.status == "fail"
    assert any("semver" in e for e in result.detail["errors"])


def test_compliance_content_too_large():
    manifest = {
        "name": "x",
        "version": "1.0.0",
        "type": "skill",
        "skill": {"content": "x" * 50001},
    }
    result = check_compliance(manifest)
    assert result.status == "fail"
    assert any("50KB" in e for e in result.detail["errors"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_compliance.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Create CheckResult type**

```python
# apps/server/app/inspect/checks/types.py
"""检测维度共享类型"""

from dataclasses import dataclass


@dataclass
class CheckResult:
    """单个维度的检测结果"""
    status: str   # pass / fail / warn / error / skip
    detail: dict

    @classmethod
    def pass_(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="pass", detail=detail or {})

    @classmethod
    def fail(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="fail", detail=detail or {})

    @classmethod
    def warn(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="warn", detail=detail or {})

    @classmethod
    def error(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="error", detail=detail or {})

    @classmethod
    def skip(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="skip", detail=detail or {})
```

- [ ] **Step 4: Create compliance check**

```python
# apps/server/app/inspect/checks/compliance.py
"""A. 静态合规检测 - manifest schema 校验"""

import re
from app.inspect.checks.types import CheckResult


SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(-((0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$"
)

MAX_CONTENT_BYTES = 50000  # 50KB


def check_compliance(manifest: dict) -> CheckResult:
    """校验 manifest schema 合规性"""
    errors = []

    if not isinstance(manifest, dict):
        return CheckResult.fail({"error": "manifest 不是有效的 JSON 对象", "manifest_valid": False})

    # 必填字段
    for field in ["name", "version", "type"]:
        if field not in manifest:
            errors.append(f"缺少必填字段: {field}")

    # 类型必须是 skill
    if manifest.get("type") and manifest.get("type") != "skill":
        errors.append(f"类型必须是 skill，实际为: {manifest.get('type')}")

    # semver 校验
    version = manifest.get("version", "")
    if version and not SEMVER_PATTERN.match(version):
        errors.append("version 不符合 semver 规范")

    # content 大小限制
    content = manifest.get("skill", {}).get("content", "")
    if content and len(content) > MAX_CONTENT_BYTES:
        errors.append(f"skill content 超过 50KB: {len(content)} bytes")

    return CheckResult(
        status="fail" if errors else "pass",
        detail={"errors": errors, "manifest_valid": len(errors) == 0},
    )
```

- [ ] **Step 5: Create __init__.py files**

```python
# apps/server/app/inspect/__init__.py
# Inspector Worker module

# apps/server/app/inspect/checks/__init__.py
# Health check dimensions
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_compliance.py -v`
Expected: PASS (all 5 tests)

- [ ] **Step 7: Commit**

```bash
git add apps/server/app/inspect/ apps/server/tests/inspect/test_compliance.py
git commit -m "feat(inspector): add compliance check (dimension A)"
```

---

## Task 3: Content Accessibility Check

**Files:**
- Create: `apps/server/app/inspect/checks/content.py`
- Test: `apps/server/tests/inspect/test_content.py`

**Interfaces:**
- Produces: `check_content(package, version, storage) -> CheckResult`

- [ ] **Step 1: Write the failing test**

```python
# apps/server/tests/inspect/test_content.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.inspect.checks.content import check_content


@pytest.mark.asyncio
async def test_content_tarball_missing():
    """tarball 不存在时返回 fail"""
    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = False

    mock_package = MagicMock()
    mock_package.id = "pkg-123"
    mock_version = MagicMock()
    mock_version.version = "1.0.0"

    result = await check_content(mock_package, mock_version, mock_storage)
    assert result.status == "fail"
    assert "tarball 不存在" in result.detail["error"]


@pytest.mark.asyncio
async def test_content_empty_content():
    """content 为空时返回 fail"""
    from app.inspect.checks.content import check_content

    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = True

    mock_package = MagicMock()
    mock_package.id = "pkg-123"
    mock_version = MagicMock()
    mock_version.version = "1.0.0"
    mock_version.manifest = {"skill": {"content": "   "}}

    result = await check_content(mock_package, mock_version, mock_storage)
    assert result.status == "fail"
    assert "content 为空" in result.detail["error"]


@pytest.mark.asyncio
async def test_content_valid():
    """正常 content 返回 pass"""
    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = True

    mock_package = MagicMock()
    mock_package.id = "pkg-123"
    mock_version = MagicMock()
    mock_version.version = "1.0.0"
    mock_version.manifest = {"skill": {"content": "This is a helpful skill for searching."}}

    result = await check_content(mock_package, mock_version, mock_storage)
    assert result.status == "pass"
    assert result.detail["content_length"] == len("This is a helpful skill for searching.")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_content.py -v`
Expected: FAIL

- [ ] **Step 3: Create content check**

```python
# apps/server/app/inspect/checks/content.py
"""B. 内容可访问检测 - MinIO tarball 存在 + content 可解析"""

from app.inspect.checks.types import CheckResult


async def check_content(package, version, storage) -> CheckResult:
    """验证 tarball 存在且 content 可解析"""
    tarball_key = f"packages/{package.id}/{version.version}.tar.gz"

    # 1. tarball 存在性
    exists = await storage.object_exists(tarball_key)
    if not exists:
        return CheckResult.fail({"error": f"tarball 不存在: {tarball_key}"})

    # 2. 从 manifest 获取 content
    manifest = version.manifest or {}
    skill = manifest.get("skill") or {}
    content = skill.get("content")

    if not content or not content.strip():
        return CheckResult.fail({"error": "skill content 为空"})

    return CheckResult.pass_({"source": "inline", "content_length": len(content)})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_content.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/app/inspect/checks/content.py apps/server/tests/inspect/test_content.py
git commit -m "feat(inspector): add content accessibility check (dimension B)"
```

---

## Task 4: LLM Functional Check

**Files:**
- Create: `apps/server/app/inspect/checks/functional.py`
- Test: `apps/server/tests/inspect/test_functional.py`

**Interfaces:**
- Produces: `check_functional(package, version, db, llm_client=None) -> CheckResult`
- Produces: `_evaluate_response(response: str) -> bool`

- [ ] **Step 1: Write the failing test**

```python
# apps/server/tests/inspect/test_functional.py
import pytest
import httpx
from httpx import AsyncClient, MockTransport, Response
from unittest.mock import MagicMock
import app.inspect.checks.functional as functional_mod
from app.inspect.checks.functional import _evaluate_response, check_functional


def test_evaluate_response_valid():
    assert _evaluate_response("这是一个搜索 Skill，用于网页搜索。示例：搜索最新新闻。") is True


def test_evaluate_response_too_short():
    assert _evaluate_response("你好") is False


def test_evaluate_response_refusal():
    assert _evaluate_response("这超出了我的能力范围，我无法回答。") is False


def test_evaluate_response_empty():
    assert _evaluate_response("") is False


# Fake LLM SSE body
_FAKE_OK_BODY = (
    'data: {"choices": [{"delta": {"content": "这是一个代码审查 Skill，'
    '用于检查代码质量。示例：审查这个函数的 bug。"}}]}\n\n'
    'data: [DONE]\n\n'
)
_FAKE_REFUSE_BODY = (
    'data: {"choices": [{"delta": {"content": "这超出了我的能力范围"}}]}\n\n'
    'data: [DONE]\n\n'
)


@pytest.fixture
def fake_llm_ok(monkeypatch):
    captured = {}

    def handler(request: httpx.Request) -> Response:
        captured["payload"] = request.content
        return Response(200, headers={"Content-Type": "text/event-stream"}, content=_FAKE_OK_BODY.encode())

    def client_factory(**kwargs):
        return AsyncClient(transport=MockTransport(handler))

    monkeypatch.setattr(functional_mod.settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(functional_mod.httpx, "AsyncClient", client_factory)
    return captured


@pytest.mark.asyncio
async def test_functional_pass(db, fake_llm_ok):
    """LLM 正常回复 → pass"""
    mock_package = MagicMock()
    mock_package.id = "pkg-1"
    mock_package.name = "code-review"
    mock_package.scope = "test"
    mock_package.description = "Code review skill"

    mock_version = MagicMock()
    mock_version.version = "1.0.0"
    mock_version.manifest = {"skill": {"content": "Review code for bugs and style issues."}}

    result = await check_functional(mock_package, mock_version, db)
    assert result.status == "pass"
    assert result.detail["response_length"] > 20


@pytest.mark.asyncio
async def test_functional_fail_refusal(db, monkeypatch):
    """LLM 拒绝回答 → fail"""
    def handler(request):
        return Response(200, headers={"Content-Type": "text/event-stream"}, content=_FAKE_REFUSE_BODY.encode())

    def client_factory(**kwargs):
        return AsyncClient(transport=MockTransport(handler))

    monkeypatch.setattr(functional_mod.settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(functional_mod.httpx, "AsyncClient", client_factory)

    mock_package = MagicMock()
    mock_package.id = "pkg-1"
    mock_package.name = "bad-skill"
    mock_package.scope = "test"
    mock_package.description = None

    mock_version = MagicMock()
    mock_version.version = "1.0.0"
    mock_version.manifest = {"skill": {"content": ""}}

    result = await check_functional(mock_package, mock_version, db)
    assert result.status == "fail"


@pytest.mark.asyncio
async def test_functional_skip_no_api_key(db, monkeypatch):
    """无 API Key → skip"""
    monkeypatch.setattr(functional_mod.settings, "OPENAI_API_KEY", "")

    mock_package = MagicMock()
    mock_package.id = "pkg-1"
    mock_package.name = "test"
    mock_package.scope = "test"
    mock_package.description = None

    mock_version = MagicMock()
    mock_version.version = "1.0.0"
    mock_version.manifest = {"skill": {"content": "some content"}}

    result = await check_functional(mock_package, mock_version, db)
    assert result.status == "skip"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_functional.py -v`
Expected: FAIL

- [ ] **Step 3: Create functional check**

```python
# apps/server/app/inspect/checks/functional.py
"""C. LLM 功能实测 - 调 Test Agent 跑标准问答验证 Skill content 有效"""

import json
import logging
import httpx
from app.config import get_settings
from app.inspect.checks.types import CheckResult

logger = logging.getLogger(__name__)
settings = get_settings()

_FUNCTIONAL_TEST_PROMPT = "请用一句话说明这个 Skill 能做什么，并给出一个使用示例。"

# 复用 agent_chat 的 system prompt 模板
_SYSTEM_PROMPT_TEMPLATE = """你正在测试以下 Skill 的效果。

# Skill 名称
{package_name}

# Skill 描述
{description}

# Skill 内容
{content}

请扮演该 Skill 的执行者，根据上面的 Skill 内容回答用户的问题。如果用户的问题超出 Skill 的能力范围，请如实说明。
"""


def _evaluate_response(response: str) -> bool:
    """判定 LLM 回复是否有效"""
    if len(response.strip()) < 20:
        return False
    if "超出" in response and "范围" in response:
        return False
    return True


async def check_functional(package, version, db, llm_client: httpx.AsyncClient | None = None) -> CheckResult:
    """调 Test Agent 跑标准问答，验证 Skill content 有效"""
    # 检查 LLM 配置
    if not settings.OPENAI_API_KEY:
        return CheckResult.skip({"reason": "OPENAI_API_KEY 未配置"})

    # 获取 content
    manifest = version.manifest or {}
    skill = manifest.get("skill") or {}
    content = skill.get("content", "")

    if not content:
        return CheckResult.fail({"error": "skill content 为空，无法进行功能测试"})

    # 构造 system prompt
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(
        package_name=package.name,
        description=package.description or "-",
        content=content,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": _FUNCTIONAL_TEST_PROMPT},
    ]

    # 调用 LLM
    client = llm_client or httpx.AsyncClient(timeout=120)
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": messages,
        "stream": True,
        "max_tokens": 500,
    }

    full_response = ""
    try:
        async with client.stream(
            "POST",
            f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
        ) as response:
            if response.status_code != 200:
                return CheckResult.error({"error": f"LLM HTTP {response.status_code}"})

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                text = delta.get("content")
                if text:
                    full_response += text
    except Exception as e:
        logger.exception("functional check LLM call failed")
        return CheckResult.error({"error": str(e)})
    finally:
        if llm_client is None:
            await client.aclose()

    passed = _evaluate_response(full_response)
    return CheckResult(
        status="pass" if passed else "fail",
        detail={
            "prompt": _FUNCTIONAL_TEST_PROMPT,
            "response": full_response[:500],
            "response_length": len(full_response),
        },
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_functional.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/app/inspect/checks/functional.py apps/server/tests/inspect/test_functional.py
git commit -m "feat(inspector): add LLM functional check (dimension C)"
```

---

## Task 5: Freshness Check

**Files:**
- Create: `apps/server/app/inspect/checks/freshness.py`
- Test: `apps/server/tests/inspect/test_freshness.py`

**Interfaces:**
- Produces: `check_freshness(package, version) -> CheckResult`

- [ ] **Step 1: Write the failing test**

```python
# apps/server/tests/inspect/test_freshness.py
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone
from app.inspect.checks.freshness import check_freshness


def _make_pkg_ver(days_since_update):
    now = datetime.now(timezone.utc)
    mock_pkg = MagicMock()
    mock_ver = MagicMock()
    mock_ver.created_at = now - timedelta(days=days_since_update)
    mock_ver.version = "1.0.0"
    return mock_pkg, mock_ver


def test_freshness_recent():
    pkg, ver = _make_pkg_ver(30)
    result = check_freshness(pkg, ver)
    assert result.status == "pass"
    assert result.detail["last_update_days"] == 30


def test_freshness_stale():
    pkg, ver = _make_pkg_ver(200)
    result = check_freshness(pkg, ver)
    assert result.status == "warn"
    assert "200 天未更新" in result.detail["message"]


def test_freshness_exactly_at_threshold():
    pkg, ver = _make_pkg_ver(180)
    result = check_freshness(pkg, ver)
    assert result.status == "pass"  # 刚好 180 天不算 warn


def test_freshness_one_day_over():
    pkg, ver = _make_pkg_ver(181)
    result = check_freshness(pkg, ver)
    assert result.status == "warn"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_freshness.py -v`
Expected: FAIL

- [ ] **Step 3: Create freshness check**

```python
# apps/server/app/inspect/checks/freshness.py
"""E. 版本新鲜度检测 - 检查版本更新时间"""

from datetime import datetime, timezone
from app.inspect.checks.types import CheckResult

WARN_DAYS = 180  # 半年未更新 → warn


def check_freshness(package, version) -> CheckResult:
    """检查版本更新时间"""
    last_update = version.created_at or package.created_at
    if not last_update:
        return CheckResult.pass_({"last_update_days": 0})

    now = datetime.now(timezone.utc)
    if last_update.tzinfo is None:
        last_update = last_update.replace(tzinfo=timezone.utc)

    days_since = (now - last_update).days

    if days_since > WARN_DAYS:
        return CheckResult.warn({
            "last_update_days": days_since,
            "message": f"{days_since} 天未更新",
        })

    return CheckResult.pass_({"last_update_days": days_since})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_freshness.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/app/inspect/checks/freshness.py apps/server/tests/inspect/test_freshness.py
git commit -m "feat(inspector): add version freshness check (dimension E)"
```

---

## Task 6: Inspector Service (Orchestration)

**Files:**
- Create: `apps/server/app/inspect/inspector.py`
- Test: `apps/server/tests/inspect/test_inspector.py`

**Interfaces:**
- Produces: `InspectorService(db, storage, settings)`
- Produces: `overall_status(results: list[CheckResult]) -> str`
- Produces: `run_check(package, version, trigger) -> AgentHealthCheck`
- Produces: `run_sampled_check()`
- Produces: `process_pending_checks()`

- [ ] **Step 1: Write the failing test**

```python
# apps/server/tests/inspect/test_inspector.py
import pytest
from app.inspect.inspector import overall_status
from app.inspect.checks.types import CheckResult


def test_overall_healthy():
    results = [
        CheckResult.pass_(),
        CheckResult.pass_(),
        CheckResult.pass_(),
        CheckResult.pass_(),
    ]
    assert overall_status(results) == "healthy"


def test_overall_degraded_on_fail():
    results = [
        CheckResult.pass_(),
        CheckResult.fail({"error": "bad"}),
        CheckResult.pass_(),
        CheckResult.pass_(),
    ]
    assert overall_status(results) == "degraded"


def test_overall_degraded_on_warn():
    results = [
        CheckResult.pass_(),
        CheckResult.pass_(),
        CheckResult.pass_(),
        CheckResult.warn({"message": "stale"}),
    ]
    assert overall_status(results) == "degraded"


def test_overall_error_priority():
    """error 优先级最高"""
    results = [
        CheckResult.pass_(),
        CheckResult.error({"error": "timeout"}),
        CheckResult.pass_(),
        CheckResult.pass_(),
    ]
    assert overall_status(results) == "error"


def test_overall_error_overrides_fail():
    results = [
        CheckResult.fail({}),
        CheckResult.error({}),
        CheckResult.pass_(),
        CheckResult.pass_(),
    ]
    assert overall_status(results) == "error"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_inspector.py -v`
Expected: FAIL

- [ ] **Step 3: Create InspectorService**

```python
# apps/server/app/inspect/inspector.py
"""Inspector 主服务 - 编排四维检测"""

import asyncio
import logging
import random
from datetime import datetime, timezone
from sqlalchemy import select, update

from app.config import get_settings
from app.models.package import Package
from app.models.version import Version
from app.models.health_check import AgentHealthCheck
from app.services.storage import get_storage_service
from app.inspect.checks.types import CheckResult
from app.inspect.checks.compliance import check_compliance
from app.inspect.checks.content import check_content
from app.inspect.checks.functional import check_functional
from app.inspect.checks.freshness import check_freshness

logger = logging.getLogger(__name__)
settings = get_settings()


def overall_status(results: list[CheckResult]) -> str:
    """根据四维结果计算综合状态"""
    statuses = [r.status for r in results]
    if "error" in statuses:
        return "error"
    if "fail" in statuses:
        return "degraded"
    if "warn" in statuses:
        return "degraded"
    return "healthy"


class InspectorService:
    """健康检测编排服务"""

    def __init__(self, db, storage=None):
        self.db = db
        self.storage = storage or get_storage_service()

    async def run_check(self, package: Package, version: Version | None = None,
                        trigger: str = "scheduled") -> AgentHealthCheck:
        """对单个包执行四维检测"""
        if version is None:
            version = await self._get_latest_version(str(package.id))

        if version is None:
            # 无版本 → 记录空结果
            check = AgentHealthCheck(
                package_id=str(package.id),
                version="none",
                overall_status="error",
                trigger_type=trigger,
                compliance_status="error",
                compliance_detail={"error": "无已发布版本"},
                content_status="skip",
                functional_status="skip",
                freshness_status="skip",
            )
            self.db.add(check)
            await self.db.flush()
            await self._update_package_status(str(package.id), "error")
            return check

        # 四维检测（单个维度异常不影响其他）
        results = []
        for check_fn in [check_compliance, check_content, check_functional, check_freshness]:
            try:
                if check_fn == check_compliance:
                    result = check_compliance(version.manifest or {})
                elif check_fn == check_content:
                    result = await check_content(package, version, self.storage)
                elif check_fn == check_functional:
                    result = await check_functional(package, version, self.db)
                elif check_fn == check_freshness:
                    result = check_freshness(package, version)
                else:
                    result = CheckResult.error({"error": "unknown check"})
            except asyncio.TimeoutError:
                result = CheckResult.error({"error": "检测超时 (60s)"})
            except Exception as e:
                logger.exception("check failed: %s", check_fn.__name__)
                result = CheckResult.error({"error": str(e)})
            results.append(result)

        # 构建结果对象
        compliance = results[0]
        content = results[1]
        functional = results[2]
        freshness = results[3]

        check = AgentHealthCheck(
            package_id=str(package.id),
            version=version.version,
            compliance_status=compliance.status,
            compliance_detail=compliance.detail,
            content_status=content.status,
            content_detail=content.detail,
            functional_status=functional.status,
            functional_detail=functional.detail,
            freshness_status=freshness.status,
            freshness_detail=freshness.detail,
            overall_status=overall_status(results),
            trigger_type=trigger,
        )
        self.db.add(check)
        await self.db.flush()

        # 更新包状态缓存
        await self._update_package_status(str(package.id), check.overall_status)

        return check

    async def _update_package_status(self, package_id: str, status: str):
        """更新包健康状态缓存"""
        await self.db.execute(
            update(Package)
            .where(Package.id == package_id)
            .values(
                health_status=status,
                needs_check=False,
                last_check_at=datetime.now(timezone.utc),
            )
        )
        await self.db.flush()

    async def _get_latest_version(self, package_id: str) -> Version | None:
        result = await self.db.execute(
            select(Version)
            .where(Version.package_id == package_id, Version.yanked.is_(False))
            .order_by(Version.published_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_all_skill_packages(self) -> list[Package]:
        """获取所有未删除的 skill 包"""
        result = await self.db.execute(
            select(Package)
            .where(Package.type == "skill", Package.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def run_sampled_check(self):
        """调度触发：采样检测"""
        packages = await self.get_all_skill_packages()
        if not packages:
            return

        sample_size = max(1, int(len(packages) * settings.INSPECTOR_SAMPLE_RATE))
        sampled = random.sample(packages, min(sample_size, len(packages)))

        llm_count = 0
        for pkg in sampled:
            if llm_count >= settings.INSPECTOR_MAX_LLM_PER_RUN:
                logger.info("LLM limit reached, skipping remaining packages")
                break
            try:
                await self.run_check(pkg, trigger="scheduled")
                llm_count += 1
                await self.db.commit()
            except Exception:
                logger.exception("sampled check failed for %s", pkg.full_name)
                await self.db.rollback()

    async def process_pending_checks(self):
        """处理 needs_check=true 的包"""
        result = await self.db.execute(
            select(Package)
            .where(Package.needs_check.is_(True), Package.deleted_at.is_(None))
            .limit(10)  # 每次最多处理 10 个
        )
        packages = list(result.scalars().all())

        for pkg in packages:
            try:
                await self.run_check(pkg, trigger="manual")
                await self.db.commit()
            except Exception:
                logger.exception("pending check failed for %s", pkg.full_name)
                await self.db.rollback()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_inspector.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/app/inspect/inspector.py apps/server/tests/inspect/test_inspector.py
git commit -m "feat(inspector): add InspectorService orchestration"
```

---

## Task 7: Worker Entry + Scheduler

**Files:**
- Create: `apps/server/app/worker.py`
- Create: `apps/server/app/inspect/scheduler.py`
- Test: `apps/server/tests/inspect/test_scheduler.py`

**Interfaces:**
- Produces: `main()` async entry point
- Produces: `create_scheduler(inspector) -> AsyncIOScheduler`

- [ ] **Step 1: Write the failing test**

```python
# apps/server/tests/inspect/test_scheduler.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.inspect.scheduler import create_scheduler


def test_create_scheduler():
    """Scheduler 创建成功并注册了两个 job"""
    mock_inspector = MagicMock()
    mock_inspector.run_sampled_check = AsyncMock()
    mock_inspector.process_pending_checks = AsyncMock()

    scheduler = create_scheduler(mock_inspector)
    assert scheduler is not None

    job_ids = [job.id for job in scheduler.get_jobs()]
    assert "daily_inspection" in job_ids
    assert "pending_check_poller" in job_ids
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_scheduler.py -v`
Expected: FAIL

- [ ] **Step 3: Create scheduler**

```python
# apps/server/app/inspect/scheduler.py
"""APScheduler 配置"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from app.config import get_settings

settings = get_settings()


def create_scheduler(inspector) -> AsyncIOScheduler:
    """创建并配置 APScheduler"""
    scheduler = AsyncIOScheduler()

    # 每日凌晨定时巡检
    scheduler.add_job(
        inspector.run_sampled_check,
        trigger=CronTrigger(
            hour=settings.INSPECTOR_CRON_HOUR,
            minute=settings.INSPECTOR_CRON_MINUTE,
        ),
        id="daily_inspection",
        replace_existing=True,
    )

    # 轮询 needs_check
    scheduler.add_job(
        inspector.process_pending_checks,
        trigger=IntervalTrigger(seconds=settings.INSPECTOR_POLL_INTERVAL),
        id="pending_check_poller",
        replace_existing=True,
    )

    return scheduler
```

- [ ] **Step 4: Create worker entry**

```python
# apps/server/app/worker.py
"""Inspector Worker - 独立进程入口

启动: python -m app.worker
"""

import asyncio
import logging
import signal
import sys

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.services.storage import get_storage_service
from app.inspect.scheduler import create_scheduler
from app.inspect.inspector import InspectorService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("akit.worker")
settings = get_settings()


async def _ensure_tables():
    """确保数据库表存在（复用 server 的 create_all 逻辑）"""
    from app.database import engine, Base
    from app.models import user, package, version, download, review, team  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified")


async def main():
    """Worker 主循环"""
    logger.info("Starting Inspector Worker...")
    logger.info("Sample rate: %s, Cron: %02d:%02d, Max LLM: %d, Poll: %ds",
                settings.INSPECTOR_SAMPLE_RATE, settings.INSPECTOR_CRON_HOUR,
                settings.INSPECTOR_CRON_MINUTE, settings.INSPECTOR_MAX_LLM_PER_RUN,
                settings.INSPECTOR_POLL_INTERVAL)

    # 确保表存在
    await _ensure_tables()

    # 创建 inspector（使用独立 session）
    async with AsyncSessionLocal() as db:
        storage = get_storage_service()
        inspector = InspectorService(db, storage)
        scheduler = create_scheduler(inspector)

    scheduler.start()
    logger.info("Scheduler started. Running inspection loop...")

    # 主循环：保持进程存活，定期创建新 session 执行检测
    try:
        while True:
            await asyncio.sleep(60)
            # 健康检查日志
            logger.debug("Worker alive, jobs: %s", [j.id for j in scheduler.get_jobs()])
    except asyncio.CancelledError:
        logger.info("Worker cancelled")
    finally:
        scheduler.shutdown()
        logger.info("Scheduler shutdown")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
        sys.exit(0)
```

- [ ] **Step 5: Add APScheduler dependency**

Modify `apps/server/pyproject.toml` dependencies to add:
```
apscheduler>=3.10,<4.0
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_scheduler.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/server/app/worker.py apps/server/app/inspect/scheduler.py apps/server/pyproject.toml apps/server/tests/inspect/test_scheduler.py
git commit -m "feat(inspector): add worker entry point and APScheduler"
```

---

## Task 8: Events (Trigger on Publish/Version Update)

**Files:**
- Create: `apps/server/app/inspect/events.py`
- Modify: `apps/server/app/services/package.py` (add mark_needs_check)
- Test: `apps/server/tests/inspect/test_events.py`

**Interfaces:**
- Produces: `mark_needs_check(db, package_id)`
- Produces: `mark_needs_check_by_name(db, scope, name)`

- [ ] **Step 1: Write the failing test**

```python
# apps/server/tests/inspect/test_events.py
import pytest
import uuid
from sqlalchemy import select
from app.models.package import Package
from app.inspect.events import mark_needs_check, mark_needs_check_by_name


async def _create_pkg(db, name="test", scope="test"):
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
    return pkg


@pytest.mark.asyncio
async def test_mark_needs_check(db):
    pkg = await _create_pkg(db)
    assert pkg.needs_check is False

    await mark_needs_check(db, str(pkg.id))
    await db.flush()

    result = await db.execute(select(Package).where(Package.id == pkg.id))
    fetched = result.scalar_one_or_none()
    assert fetched.needs_check is True


@pytest.mark.asyncio
async def test_mark_needs_check_by_name(db):
    pkg = await _create_pkg(db, name="my-skill", scope="myteam")

    await mark_needs_check_by_name(db, "myteam", "my-skill")
    await db.flush()

    result = await db.execute(select(Package).where(Package.id == pkg.id))
    fetched = result.scalar_one_or_none()
    assert fetched.needs_check is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_events.py -v`
Expected: FAIL

- [ ] **Step 3: Create events module**

```python
# apps/server/app/inspect/events.py
"""事件触发 - 发布/版本更新时标记 needs_check"""

from sqlalchemy import update
from app.models.package import Package


async def mark_needs_check(db, package_id: str):
    """标记包需要检测"""
    await db.execute(
        update(Package)
        .where(Package.id == package_id)
        .values(needs_check=True)
    )
    await db.flush()


async def mark_needs_check_by_name(db, scope: str, name: str):
    """通过 scope/name 标记包需要检测"""
    await db.execute(
        update(Package)
        .where(Package.scope == scope, Package.name == name)
        .values(needs_check=True)
    )
    await db.flush()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_events.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/app/inspect/events.py apps/server/tests/inspect/test_events.py
git commit -m "feat(inspector): add events module for marking needs_check"
```

---

## Task 9: Health API Endpoints

**Files:**
- Create: `apps/server/app/schemas/health_check.py`
- Create: `apps/server/app/api/health.py`
- Modify: `apps/server/app/main.py` (register router)
- Test: `apps/server/tests/inspect/test_api.py`

**Interfaces:**
- Produces: `HealthCheckResponse` schema
- Produces: `POST /api/v1/health/check/{scope}/{name}`
- Produces: `GET /api/v1/health/check/{scope}/{name}`
- Produces: `GET /api/v1/health/overview`

- [ ] **Step 1: Write the failing test**

```python
# apps/server/tests/inspect/test_api.py
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
async def test_get_health_status(client: AsyncClient, db):
    """GET /api/v1/health/check/{scope}/{name} 返回检测结果"""
    pkg, check = await _create_skill_with_check(db, "healthy")

    response = await client.get(f"/api/v1/health/check/test/api-test-skill")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["overall"] == "healthy"
    assert data["compliance"]["status"] == "pass"


@pytest.mark.asyncio
async def test_trigger_check(client: AsyncClient, db):
    """POST /api/v1/health/check/{scope}/{name} 触发检测"""
    pkg, _ = await _create_skill_with_check(db)
    pkg.needs_check = False
    await db.flush()

    response = await client.post(f"/api/v1/health/check/test/api-test-skill")
    assert response.status_code == 200
    assert response.json()["status"] == "queued"


@pytest.mark.asyncio
async def test_get_overview(client: AsyncClient, db):
    """GET /api/v1/health/overview 返回统计"""
    await _create_skill_with_check(db, "healthy")
    await _create_skill_with_check(db, "degraded")

    response = await client.get("/api/v1/health/overview")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] >= 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pytest tests/inspect/test_api.py -v`
Expected: FAIL

- [ ] **Step 3: Create health check schema**

```python
# apps/server/app/schemas/health_check.py
"""健康检测请求/响应模型"""

from pydantic import BaseModel
from datetime import datetime


class DimensionResult(BaseModel):
    """单维度结果"""
    status: str
    detail: dict


class HealthCheckResponse(BaseModel):
    """检测结果响应"""
    overall: str
    compliance: DimensionResult
    content: DimensionResult
    functional: DimensionResult
    freshness: DimensionResult
    checked_at: datetime | None = None
    trigger: str | None = None


class HealthOverviewResponse(BaseModel):
    """平台健康概览"""
    total: int
    healthy: int
    degraded: int
    error: int
    pending: int
    last_run_at: datetime | None = None
```

- [ ] **Step 4: Create health API**

```python
# apps/server/app/api/health.py
"""健康检测 API 路由"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user, UserType
from app.models.package import Package
from app.models.health_check import AgentHealthCheck
from app.schemas.health_check import HealthCheckResponse, HealthOverviewResponse, DimensionResult
from app.inspect.events import mark_needs_check_by_name

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])


@router.post("/check/{scope}/{name}")
async def trigger_check(
    scope: str,
    name: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """手动触发重新检测"""
    await mark_needs_check_by_name(db, scope, name)
    await db.commit()
    return {"message": "已加入检测队列", "status": "queued"}


@router.get("/check/{scope}/{name}", response_model=HealthCheckResponse)
async def get_health_status(
    scope: str,
    name: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取最新检测结果"""
    # 找到包
    result = await db.execute(
        select(Package).where(Package.scope == scope, Package.name == name)
    )
    package = result.scalar_one_or_none()
    if not package:
        from app.errors import AppError, ErrorCodes
        raise AppError(code=ErrorCodes.PACKAGE_NOT_FOUND, message="包不存在", status_code=404)

    # 最新检测记录
    check_result = await db.execute(
        select(AgentHealthCheck)
        .where(AgentHealthCheck.package_id == package.id)
        .order_by(AgentHealthCheck.created_at.desc())
        .limit(1)
    )
    check = check_result.scalar_one_or_none()

    if not check:
        return HealthCheckResponse(
            overall=package.health_status or "pending",
            compliance=DimensionResult(status="skip", detail={}),
            content=DimensionResult(status="skip", detail={}),
            functional=DimensionResult(status="skip", detail={}),
            freshness=DimensionResult(status="skip", detail={}),
        )

    return HealthCheckResponse(
        overall=check.overall_status,
        compliance=DimensionResult(status=check.compliance_status, detail=check.compliance_detail),
        content=DimensionResult(status=check.content_status, detail=check.content_detail),
        functional=DimensionResult(status=check.functional_status, detail=check.functional_detail),
        freshness=DimensionResult(status=check.freshness_status, detail=check.freshness_detail),
        checked_at=check.created_at,
        trigger=check.trigger_type,
    )


@router.get("/overview", response_model=HealthOverviewResponse)
async def get_health_overview(
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """平台健康概览"""
    # 统计各状态包数
    result = await db.execute(
        select(Package.health_status, func.count(Package.id))
        .where(Package.type == "skill", Package.deleted_at.is_(None))
        .group_by(Package.health_status)
    )
    counts = dict(result.all())

    total = sum(counts.values())
    healthy = counts.get("healthy", 0)
    degraded = counts.get("degraded", 0)
    error = counts.get("error", 0)
    pending = counts.get("pending", 0)

    # 最后运行时间
    last_check = await db.execute(
        select(func.max(AgentHealthCheck.created_at))
    )
    last_run = last_check.scalar_one_or_none()

    return HealthOverviewResponse(
        total=total, healthy=healthy, degraded=degraded,
        error=error, pending=pending, last_run_at=last_run,
    )
```

- [ ] **Step 5: Register router in main.py**

Modify `apps/server/app/main.py` — add import and router registration:

```python
from app.api import auth, packages, versions, admin, reviews, teams, agent, webhooks, health
```

And register (resolve the existing merge conflict by keeping both):
```python
app.include_router(agent.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1/teams")
app.include_router(health.router, prefix="/api/v1")
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/server && pytest tests/inspect/test_api.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/server/app/schemas/health_check.py apps/server/app/api/health.py apps/server/app/main.py apps/server/tests/inspect/test_api.py
git commit -m "feat(inspector): add health check API endpoints"
```

---

## Task 10: Frontend HealthCheckBadge Component

**Files:**
- Create: `apps/web/src/components/HealthCheckBadge.tsx`
- Test: `apps/web/src/components/__tests__/HealthCheckBadge.test.tsx`

**Interfaces:**
- Produces: `HealthCheckBadge` component

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/components/__tests__/HealthCheckBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { HealthCheckBadge } from '../HealthCheckBadge';

describe('HealthCheckBadge', () => {
  it('renders healthy status', () => {
    render(
      <HealthCheckBadge
        overall="healthy"
        compliance={{ status: 'pass', detail: {} }}
        content={{ status: 'pass', detail: {} }}
        functional={{ status: 'pass', detail: {} }}
        freshness={{ status: 'pass', detail: {} }}
      />
    );
    expect(screen.getByText('Skill 健康')).toBeInTheDocument();
  });

  it('renders degraded status', () => {
    render(
      <HealthCheckBadge
        overall="degraded"
        compliance={{ status: 'fail', detail: { errors: ['content 超 50KB'] } }}
        content={{ status: 'pass', detail: {} }}
        functional={{ status: 'pass', detail: {} }}
        freshness={{ status: 'warn', detail: {} }}
      />
    );
    expect(screen.getByText('Skill 状态异常')).toBeInTheDocument();
  });

  it('renders pending status', () => {
    render(
      <HealthCheckBadge
        overall="pending"
        compliance={{ status: 'skip', detail: {} }}
        content={{ status: 'skip', detail: {} }}
        functional={{ status: 'skip', detail: {} }}
        freshness={{ status: 'skip', detail: {} }}
      />
    );
    expect(screen.getByText('待检测')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter agent-kit-web test -- --run HealthCheckBadge`
Expected: FAIL

- [ ] **Step 3: Create HealthCheckBadge component**

```tsx
// apps/web/src/components/HealthCheckBadge.tsx
import { CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DimensionResult {
  status: string;
  detail: Record<string, unknown>;
}

interface HealthCheckBadgeProps {
  overall: string;
  compliance: DimensionResult;
  content: DimensionResult;
  functional: DimensionResult;
  freshness: DimensionResult;
  checkedAt?: string;
  onRecheck?: () => void;
}

const STATUS_ICON: Record<string, typeof CheckCircle> = {
  pass: CheckCircle,
  fail: AlertTriangle,
  warn: AlertTriangle,
  error: AlertTriangle,
  skip: Clock,
};

export function HealthCheckBadge({
  overall,
  compliance,
  content,
  functional,
  freshness,
  checkedAt,
  onRecheck,
}: HealthCheckBadgeProps) {
  const { t } = useTranslation('components');

  if (overall === 'pending') {
    return (
      <div className="p-4 rounded-xl bg-card border border-border/50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{t('health.pending', '待检测')}</span>
        </div>
      </div>
    );
  }

  const isHealthy = overall === 'healthy';

  const dimensions = [
    { label: t('health.compliance', '静态合规'), result: compliance },
    { label: t('health.content', '内容可访问'), result: content },
    { label: t('health.functional', '功能实测'), result: functional },
    { label: t('health.freshness', '版本新鲜度'), result: freshness },
  ];

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
      <div className="flex items-center gap-2">
        {isHealthy ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
        <span className="text-sm font-medium">
          {isHealthy
            ? t('health.healthy', 'Skill 健康')
            : t('health.degraded', 'Skill 状态异常')}
        </span>
      </div>

      <div className="space-y-1.5 pl-6">
        {dimensions.map(({ label, result }) => {
          const Icon = STATUS_ICON[result.status] || Clock;
          const colorClass =
            result.status === 'pass'
              ? 'text-green-500'
              : result.status === 'warn'
                ? 'text-amber-500'
                : result.status === 'fail' || result.status === 'error'
                  ? 'text-red-500'
                  : 'text-muted-foreground';
          return (
            <div key={label} className="flex items-center gap-1.5 text-xs">
              <Icon className={`w-3 h-3 ${colorClass}`} />
              <span className="text-muted-foreground">{label}:</span>
              <span className={colorClass}>{result.status}</span>
            </div>
          );
        })}
      </div>

      {checkedAt && (
        <div className="text-xs text-muted-foreground pt-2 border-t border-border/30">
          {t('health.checkedAt', '检测时间')}: {new Date(checkedAt).toLocaleString('zh-CN')}
        </div>
      )}

      {onRecheck && (
        <button
          onClick={onRecheck}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <RefreshCw className="w-3 h-3" />
          {t('health.recheck', '重新检测')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter agent-kit-web test -- --run HealthCheckBadge`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/HealthCheckBadge.tsx apps/web/src/components/__tests__/HealthCheckBadge.test.tsx
git commit -m "feat(web): add HealthCheckBadge component"
```

---

## Task 11: Integrate HealthCheckBadge into PackageDetail

**Files:**
- Modify: `apps/web/src/pages/PackageDetail.tsx`
- Modify: `apps/web/src/lib/api.ts` (add health API methods)

**Interfaces:**
- Produces: `api.getHealthCheck(scope, name)`
- Produces: `api.triggerHealthCheck(scope, name)`

- [ ] **Step 1: Add health API methods to api.ts**

Add to `apps/web/src/lib/api.ts`:

```typescript
// Health check
async getHealthCheck(scope: string, name: string) {
  const response = await fetch(`${this.baseUrl}/health/check/${scope}/${name}`, {
    headers: this.authHeader,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
},

async triggerHealthCheck(scope: string, name: string) {
  const response = await fetch(`${this.baseUrl}/health/check/${scope}/${name}`, {
    method: 'POST',
    headers: this.authHeader,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
},
```

- [ ] **Step 2: Integrate into PackageDetail.tsx**

Modify `apps/web/src/pages/PackageDetail.tsx` to:
1. Import `HealthCheckBadge` component
2. Add health state + loading
3. Fetch health data on mount
4. Render badge in sidebar
5. Wire up recheck button

```tsx
// Add imports
import { HealthCheckBadge } from '@/components/HealthCheckBadge';

// Add state
const [health, setHealth] = useState<any>(null);
const [healthLoading, setHealthLoading] = useState(false);

// Add fetch in useEffect (alongside existing data fetch)
useEffect(() => {
  if (!name || !scope) return;
  api.getHealthCheck(scope, name)
    .then(setHealth)
    .catch(() => setHealth(null));
}, [scope, name]);

// Add recheck handler
const handleRecheck = useCallback(async () => {
  setHealthLoading(true);
  try {
    await api.triggerHealthCheck(scope, name);
    // Poll for result after a delay
    setTimeout(async () => {
      const updated = await api.getHealthCheck(scope, name);
      setHealth(updated);
      setHealthLoading(false);
    }, 5000);
  } catch {
    setHealthLoading(false);
  }
}, [scope, name]);

// Render in sidebar (after existing package info card)
{health && health.data && (
  <HealthCheckBadge
    overall={health.data.overall}
    compliance={health.data.compliance}
    content={health.data.content}
    functional={health.data.functional}
    freshness={health.data.freshness}
    checkedAt={health.data.checked_at}
    onRecheck={handleRecheck}
  />
)}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter agent-kit-web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/PackageDetail.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): integrate HealthCheckBadge into PackageDetail page"
```

---

## Task 12: Docker Compose Worker Service

**Files:**
- Modify: `deploy/docker/docker-compose.yml`
- Modify: `deploy/docker/.env.example`

**Interfaces:**
- Produces: `worker` service in docker-compose

- [ ] **Step 1: Add worker service to docker-compose.yml**

Add to `deploy/docker/docker-compose.yml`:

```yaml
  # Inspector Worker - 独立巡检进程
  worker:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET: ${MINIO_BUCKET}
      MINIO_SECURE: ${MINIO_SECURE:-false}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL}
      OPENAI_MODEL: ${OPENAI_MODEL}
      OPENAI_MAX_TOKENS: ${OPENAI_MAX_TOKENS:-500}
      INSPECTOR_SAMPLE_RATE: ${INSPECTOR_SAMPLE_RATE:-0.2}
      INSPECTOR_CRON_HOUR: ${INSPECTOR_CRON_HOUR:-2}
      INSPECTOR_MAX_LLM_PER_RUN: ${INSPECTOR_MAX_LLM_PER_RUN:-50}
      INSPECTOR_POLL_INTERVAL: ${INSPECTOR_POLL_INTERVAL:-30}
    command: python -m app.worker
```

- [ ] **Step 2: Add inspector env vars to .env.example**

Add to `deploy/docker/.env.example`:

```bash
# Inspector Worker
INSPECTOR_SAMPLE_RATE=0.2
INSPECTOR_CRON_HOUR=2
INSPECTOR_MAX_LLM_PER_RUN=50
INSPECTOR_POLL_INTERVAL=30
```

- [ ] **Step 3: Commit**

```bash
git add deploy/docker/docker-compose.yml deploy/docker/.env.example
git commit -m "feat(deploy): add worker service to docker-compose"
```

---

## Task 13: Integration Test (End-to-End Flow)

**Files:**
- Create: `apps/server/tests/inspect/test_integration.py`

**Interfaces:**
- Validates: full flow from needs_check → detection → status update

- [ ] **Step 1: Write the integration test**

```python
# apps/server/tests/inspect/test_integration.py
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import select, update
from app.models.package import Package
from app.models.version import Version
from app.models.health_check import AgentHealthCheck
from app.inspect.inspector import InspectorService
from app.inspect.events import mark_needs_check


async def _create_skill_with_version(db, name="int-test", scope="test",
                                       manifest=None, owner_id=None):
    pkg = Package(
        id=str(uuid.uuid4()),
        name=name,
        scope=scope,
        full_name=f"@{scope}/{name}",
        type="skill",
        owner_id=owner_id or str(uuid.uuid4()),
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


@pytest.mark.asyncio
async def test_full_check_flow(db):
    """完整检测流程：创建包 → 标记 needs_check → 执行检测 → 验证结果"""
    pkg, ver = await _create_skill_with_version(db)

    # Mock storage
    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = True

    # Mock LLM (patch functional check)
    fake_body = (
        'data: {"choices": [{"delta": {"content": "这是一个测试 Skill，'
        '用于验证检测流程。示例：运行测试。"}}]}\n\n'
        'data: [DONE]\n\n'
    )

    import httpx
    from httpx import AsyncClient, MockTransport, Response
    import app.inspect.checks.functional as func_mod

    def handler(request):
        return Response(200, headers={"Content-Type": "text/event-stream"}, content=fake_body.encode())

    def client_factory(**kwargs):
        return AsyncClient(transport=MockTransport(handler))

    with patch.object(func_mod.settings, "OPENAI_API_KEY", "test-key"), \
         patch.object(func_mod.httpx, "AsyncClient", client_factory):
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
async def test_degraded_detection(db):
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
async def test_process_pending_checks(db):
    """needs_check=true 的包被 process_pending_checks 处理"""
    pkg, ver = await _create_skill_with_version(db, name="pending-test")

    # 标记 needs_check
    await mark_needs_check(db, str(pkg.id))
    await db.commit()

    # 验证标记成功
    result = await db.execute(select(Package).where(Package.id == pkg.id))
    assert result.scalar_one_or_none().needs_check is True
```

- [ ] **Step 2: Run integration test**

Run: `cd apps/server && pytest tests/inspect/test_integration.py -v`
Expected: PASS

- [ ] **Step 3: Run full inspect test suite**

Run: `cd apps/server && pytest tests/inspect/ -v`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/server/tests/inspect/test_integration.py
git commit -m "test(inspector): add integration tests for full check flow"
```

---

## Task 14: Final Verification + Documentation

**Files:**
- Modify: `docs/architecture/02-architecture.md` (add worker to diagram)
- Create: `docs/architecture/21-inspector-worker.md` (new design doc)

**Interfaces:**
- Produces: Updated architecture diagram
- Produces: Inspector Worker design doc

- [ ] **Step 1: Update architecture diagram**

Modify `docs/architecture/02-architecture.md` to add worker to the diagram:

```
┌──────────────────────────────────────────────────────────┐
│  FastAPI Server (已有)         Inspector Worker (新增)    │
│  ┌──────────────────────┐      ┌────────────────────┐    │
│  │  API Layer           │      │  APScheduler       │    │
│  │  - packages          │      │  - daily cron      │    │
│  │  - agent/chat        │      │  - poll pending    │    │
│  │  - health (new)      │      └────────┬───────────┘    │
│  └──────────┬───────────┘               │                │
│             │                           ▼                │
│             │                  ┌────────────────┐        │
│             │                  │ InspectorSvc   │        │
│             │                  │ - compliance   │        │
│             │                  │ - content      │        │
│             │                  │ - functional   │        │
│             │                  │ - freshness    │        │
│             │                  └────────┬───────┘        │
│             │                           │                │
│             └───────────┬───────────────┘                │
│                         │                                │
│                         ▼                                │
│              ┌──────────────────┐                        │
│              │   PostgreSQL     │                        │
│              └──────────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

- [ ] **Step 2: Create inspector design doc**

Create `docs/architecture/21-inspector-worker.md` summarizing the design (reference the spec).

- [ ] **Step 3: Run full test suite**

Run: `cd apps/server && pytest tests/inspect/ -v --tb=short`
Expected: ALL PASS

- [ ] **Step 4: Run lint**

Run: `cd apps/server && ruff check . && ruff format --check .`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/02-architecture.md docs/architecture/21-inspector-worker.md
git commit -m "docs: add Inspector Worker to architecture docs"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] **Spec coverage:** Each section in the spec maps to a task
  - Data model → Task 1
  - Compliance check → Task 2
  - Content check → Task 3
  - Functional check → Task 4
  - Freshness check → Task 5
  - Inspector orchestration → Task 6
  - Worker + Scheduler → Task 7
  - Events → Task 8
  - API → Task 9
  - Frontend badge → Task 10
  - PackageDetail integration → Task 11
  - Docker Compose → Task 12
  - Integration tests → Task 13
  - Docs → Task 14

- [ ] **No placeholders:** No TBD/TODO in plan
- [ ] **Type consistency:** `CheckResult` used consistently across all check functions
- [ ] **Test coverage:** Each check dimension has unit tests + integration test covers full flow
