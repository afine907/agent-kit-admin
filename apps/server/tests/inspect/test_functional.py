"""C. LLM 功能实测检测 - 调 Test Agent 跑标准问答验证 Skill content 有效"""

import pytest
from httpx import AsyncClient, MockTransport, Response
from unittest.mock import MagicMock

import app.inspect.checks.functional as functional_mod
from app.inspect.checks.functional import _evaluate_response, check_functional


# ---------------------------------------------------------------------------
# _evaluate_response 单元测试
# ---------------------------------------------------------------------------


def test_evaluate_response_valid():
    """正常有意义的回复应判定为有效"""
    assert _evaluate_response("这是一个搜索 Skill，用于网页搜索。示例：搜索最新新闻。") is True


def test_evaluate_response_too_short():
    """过短回复应判定为无效"""
    assert _evaluate_response("你好") is False


def test_evaluate_response_refusal():
    """拒绝/超出能力范围的回复应判定为无效"""
    assert _evaluate_response("这超出了我的能力范围，我无法回答。") is False


def test_evaluate_response_empty():
    """空回复应判定为无效"""
    assert _evaluate_response("") is False


# ---------------------------------------------------------------------------
# 假 LLM 响应体
# ---------------------------------------------------------------------------

_FAKE_OK_BODY = (
    'data: {"choices": [{"delta": {"content": "这是一个代码审查 Skill，'
    '用于检查代码质量。示例：审查这个函数的 bug。"}}]}\n\n'
    "data: [DONE]\n\n"
)
_FAKE_REFUSE_BODY = 'data: {"choices": [{"delta": {"content": "这超出了我的能力范围"}}]}\n\ndata: [DONE]\n\n'


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_llm_ok(monkeypatch):
    """注入返回正常回复的假 LLM"""

    def handler(request):
        return Response(
            200,
            headers={"Content-Type": "text/event-stream"},
            content=_FAKE_OK_BODY.encode(),
        )

    def client_factory(**kwargs):
        return AsyncClient(transport=MockTransport(handler))

    monkeypatch.setattr(functional_mod.settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(functional_mod.httpx, "AsyncClient", client_factory)


# ---------------------------------------------------------------------------
# check_functional 集成测试
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_functional_pass(db, fake_llm_ok):
    """正常 Skill content + LLM 返回有效回复 → pass"""
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
    """LLM 返回拒绝/超出能力范围 → fail"""

    def handler(request):
        return Response(
            200,
            headers={"Content-Type": "text/event-stream"},
            content=_FAKE_REFUSE_BODY.encode(),
        )

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
    mock_version.manifest = {"skill": {"content": "some content"}}

    result = await check_functional(mock_package, mock_version, db)
    assert result.status == "fail"


@pytest.mark.asyncio
async def test_functional_skip_no_api_key(db, monkeypatch):
    """未配置 OPENAI_API_KEY → skip"""
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
