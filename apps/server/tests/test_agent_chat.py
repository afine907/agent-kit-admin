"""聊天 Agent API 测试 - SSE 流式对话 + Skill content 端点"""

import json

import pytest
import httpx
from httpx import AsyncClient, MockTransport, Response

import app.services.agent_chat as agent_chat
from app.models.package import Package
from app.models.version import Version


# ---------------------------------------------------------------------------
# 测试辅助
# ---------------------------------------------------------------------------


def _sse_events(text: str) -> list[dict]:
    """解析 SSE 响应文本为事件列表"""
    events = []
    for block in text.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        if block == "data: [DONE]":
            events.append({"done": True})
            continue
        if block.startswith("data:"):
            try:
                events.append(json.loads(block[len("data:") :].strip()))
            except json.JSONDecodeError:
                events.append({"raw": block})
    return events


def _make_streaming_response(body: str | bytes, status_code: int = 200) -> Response:
    """构造假 LLM 上游 SSE 响应"""
    return Response(
        status_code,
        headers={"Content-Type": "text/event-stream"},
        content=body.encode("utf-8") if isinstance(body, str) else body,
    )


# 假 LLM 流式响应体（字符串，使用时 .encode('utf-8') 以兼容中文）
_FAKE_LLM_BODY = (
    'data: {"choices": [{"delta": {"content": "你"}}]}\n\n'
    'data: {"choices": [{"delta": {"content": "好"}}]}\n\n'
    "data: [DONE]\n\n"
)


@pytest.fixture
def fake_llm(monkeypatch):
    """注入假的 OpenAI 兼容上游，返回捕获的请求 payload 容器

    Usage:
        captured, body_override = fake_llm
    """
    captured: dict = {}

    def handler(request: httpx.Request) -> Response:
        captured["payload"] = json.loads(request.content)
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        return _make_streaming_response(captured.get("_body", _FAKE_LLM_BODY), captured.get("_status", 200))

    def client_factory(**kwargs):
        return AsyncClient(transport=MockTransport(handler))

    # 配置假的 API Key（非空，避免 503）
    monkeypatch.setattr(agent_chat.settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(agent_chat.httpx, "AsyncClient", client_factory)

    yield captured


async def _create_package(db, name: str, pkg_type: str = "skill", owner_id=None) -> Package:
    """直接创建包（绕过 schema 校验，允许非 skill 类型）"""
    package = Package(
        name=name,
        scope="@test",
        type=pkg_type,
        full_name=f"@test/{name}",
        description=f"{name} package",
        owner_id=owner_id,
        visibility="public",
    )
    db.add(package)
    await db.flush()
    await db.refresh(package)
    return package


async def _add_version(db, package_id, version="1.0.0", manifest=None, tag="latest", published_by=None) -> Version:
    """直接添加版本"""
    ver = Version(
        package_id=package_id,
        version=version,
        manifest=manifest
        or {
            "name": "test",
            "version": version,
            "type": "skill",
            "skill": {"content": "## 内联 Skill\n\n内联内容。"},
        },
        tarball_hash="sha256:abc",
        tarball_size=1024,
        tarball_path="packages/@test/x/1.0.0.tar.gz",
        tag=tag,
        published_by=published_by,
    )
    db.add(ver)
    await db.flush()
    await db.refresh(ver)
    return ver


def _chat_payload(scope="@test", name="test-skill", **overrides) -> dict:
    payload = {
        "scope": scope,
        "name": name,
        "messages": [{"role": "user", "content": "你好"}],
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# /api/v1/agent/chat
# ---------------------------------------------------------------------------


class TestAgentChat:
    """聊天端点测试"""

    @pytest.mark.asyncio
    async def test_chat_requires_auth(self, client: AsyncClient, test_package: dict):
        """未认证请求应返回 401"""
        response = await client.post("/api/v1/agent/chat", json=_chat_payload())
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_chat_package_not_found(self, client: AsyncClient, auth_headers: dict, fake_llm):
        """包不存在 → SSE error code 20003"""
        response = await client.post(
            "/api/v1/agent/chat",
            json=_chat_payload(name="nope"),
            headers=auth_headers,
        )
        assert response.status_code == 200
        events = _sse_events(response.text)
        error = next(e for e in events if "error" in e)
        assert error["error"]["code"] == 20003

    @pytest.mark.asyncio
    async def test_chat_non_skill_package(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db,
        test_user,
        fake_llm,
    ):
        """非 skill 类型包 → SSE error code 20000"""
        pkg = await _create_package(db, "not-a-skill", pkg_type="mcp", owner_id=test_user.id)
        await _add_version(db, pkg.id, manifest={"name": "not-a-skill", "type": "mcp"})

        response = await client.post(
            "/api/v1/agent/chat",
            json=_chat_payload(name="not-a-skill"),
            headers=auth_headers,
        )
        assert response.status_code == 200
        events = _sse_events(response.text)
        error = next(e for e in events if "error" in e)
        assert error["error"]["code"] == 20000
        assert "Skill" in error["error"]["message"]

    @pytest.mark.asyncio
    async def test_chat_inline_content_streams(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_package_with_version: dict,
        fake_llm,
    ):
        """内联 content：流式返回 meta + delta + [DONE]，system prompt 含 Skill content"""
        response = await client.post(
            "/api/v1/agent/chat",
            json=_chat_payload(),
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        events = _sse_events(response.text)
        # meta 事件携带模型名
        meta = next(e for e in events if "meta" in e)
        assert meta["meta"]["model"] == agent_chat.settings.OPENAI_MODEL
        # delta 事件
        deltas = "".join(e["delta"] for e in events if "delta" in e)
        assert deltas == "你好"
        # 结束标记
        assert events[-1] == {"done": True}

        # 校验发送给上游的 system prompt 包含 Skill content
        messages = fake_llm["payload"]["messages"]
        assert messages[0]["role"] == "system"
        assert "## 测试 Skill" in messages[0]["content"]
        # 用户消息紧随其后
        assert messages[1] == {"role": "user", "content": "你好"}

    @pytest.mark.asyncio
    async def test_chat_minio_content(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db,
        test_user,
        fake_llm,
    ):
        """MinIO 存储的 content：system prompt 应包含读取到的内容"""
        pkg = await _create_package(db, "minio-skill", owner_id=test_user.id)
        await _add_version(
            db,
            pkg.id,
            manifest={
                "name": "minio-skill",
                "type": "skill",
                "skill": {"content_url": "skills/minio-skill/content.md"},
            },
        )

        response = await client.post(
            "/api/v1/agent/chat",
            json=_chat_payload(name="minio-skill"),
            headers=auth_headers,
        )
        assert response.status_code == 200
        events = _sse_events(response.text)
        assert any("delta" in e for e in events), f"no deltas: {response.text}"

        messages = fake_llm["payload"]["messages"]
        assert "skills/minio-skill/content.md" in messages[0]["content"]

    @pytest.mark.asyncio
    async def test_chat_version_not_found(self, client: AsyncClient, auth_headers: dict, test_package: dict, fake_llm):
        """指定不存在的版本 → SSE error code 20003"""
        response = await client.post(
            "/api/v1/agent/chat",
            json=_chat_payload(version="99.99.99"),
            headers=auth_headers,
        )
        assert response.status_code == 200
        events = _sse_events(response.text)
        error = next(e for e in events if "error" in e)
        assert error["error"]["code"] == 20003

    @pytest.mark.asyncio
    async def test_chat_llm_not_configured(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_package_with_version: dict,
        monkeypatch,
    ):
        """未配置 OPENAI_API_KEY → SSE error code 20007 (503)"""
        monkeypatch.setattr(agent_chat.settings, "OPENAI_API_KEY", "")

        response = await client.post(
            "/api/v1/agent/chat",
            json=_chat_payload(),
            headers=auth_headers,
        )
        assert response.status_code == 200
        events = _sse_events(response.text)
        error = next(e for e in events if "error" in e)
        assert error["error"]["code"] == 20007

    @pytest.mark.asyncio
    async def test_chat_upstream_error(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_package_with_version: dict,
        fake_llm,
    ):
        """上游返回 5xx → SSE error code 20008 (502)"""
        fake_llm["_status"] = 500

        response = await client.post(
            "/api/v1/agent/chat",
            json=_chat_payload(),
            headers=auth_headers,
        )
        assert response.status_code == 200
        events = _sse_events(response.text)
        error = next(e for e in events if "error" in e)
        assert error["error"]["code"] == 20008

    @pytest.mark.asyncio
    async def test_chat_truncates_history(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_package_with_version: dict,
        fake_llm,
    ):
        """历史超过 MAX_HISTORY 条时应截断到最近 20 条"""
        many = [{"role": "user", "content": f"msg-{i}"} for i in range(25)]
        response = await client.post(
            "/api/v1/agent/chat",
            json=_chat_payload(messages=many),
            headers=auth_headers,
        )
        assert response.status_code == 200

        messages = fake_llm["payload"]["messages"]
        # system prompt + 最近 20 条
        assert len(messages) == 1 + 20
        assert messages[1]["content"] == "msg-5"


# ---------------------------------------------------------------------------
# GET /api/v1/packages/{scope}/{name}/versions/{version}/content
# ---------------------------------------------------------------------------


class TestVersionContent:
    """Skill content 端点测试"""

    @pytest.mark.asyncio
    async def test_content_inline(self, client: AsyncClient, test_package_with_version: dict):
        """内联 content 返回 source=inline"""
        response = await client.get("/api/v1/packages/@test/test-skill/versions/1.0.0/content")
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "inline"
        assert "## 测试 Skill" in data["content"]
        assert data["version"] == "1.0.0"
        assert data["package"]["full_name"] == "@test/test-skill"

    @pytest.mark.asyncio
    async def test_content_minio(self, client: AsyncClient, db, test_user):
        """MinIO content 返回 source=minio"""
        pkg = await _create_package(db, "minio-content-skill", owner_id=test_user.id)
        await _add_version(
            db,
            pkg.id,
            manifest={
                "name": "minio-content-skill",
                "type": "skill",
                "skill": {"content_url": "skills/minio-content-skill/content.md"},
            },
        )

        response = await client.get("/api/v1/packages/@test/minio-content-skill/versions/1.0.0/content")
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "minio"
        assert "skills/minio-content-skill/content.md" in data["content"]

    @pytest.mark.asyncio
    async def test_content_anonymous_allowed(self, client: AsyncClient, test_package_with_version: dict):
        """content 端点匿名可访问（public 包）"""
        response = await client.get("/api/v1/packages/@test/test-skill/versions/1.0.0/content")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_content_version_not_found(self, client: AsyncClient, test_package: dict):
        """不存在的版本 → 404"""
        response = await client.get("/api/v1/packages/@test/test-skill/versions/99.99.99/content")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == 20003

    @pytest.mark.asyncio
    async def test_content_package_not_found(self, client: AsyncClient):
        """不存在的包 → 404"""
        response = await client.get("/api/v1/packages/@nonexist/nope/versions/1.0.0/content")
        assert response.status_code == 404
