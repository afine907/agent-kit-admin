"""Webhook API 测试"""

import hashlib
import hmac
import json
import pytest
from app.models.user import User
from app.models.team import Team, TeamMember
from app.core.security import hash_password


@pytest.fixture
async def team_owner(db):
    """团队 owner"""
    user = User(
        username="webhook_owner",
        email="webhook_owner@example.com",
        display_name="Webhook Owner",
        password_hash=hash_password("OwnerPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    return user


@pytest.fixture
async def team_member(db):
    """团队普通成员"""
    user = User(
        username="webhook_member",
        email="webhook_member@example.com",
        display_name="Webhook Member",
        password_hash=hash_password("MemberPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    return user


@pytest.fixture
async def team(db, team_owner, team_member):
    """测试团队"""
    t = Team(name="Webhook Team", slug="webhook-team", description="Test team for webhooks")
    db.add(t)
    await db.flush()
    await db.refresh(t)

    db.add(TeamMember(team_id=t.id, user_id=team_owner.id, role="admin"))
    await db.flush()
    db.add(TeamMember(team_id=t.id, user_id=team_member.id, role="member"))
    await db.flush()
    return t


def _auth_header(user: User) -> dict:
    """生成认证 header"""
    from app.config import get_settings
    from jose import jwt
    from datetime import datetime, timedelta, timezone

    settings = get_settings()
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_webhook(client, team, team_owner):
    """团队 admin 可以创建 webhook"""
    resp = await client.post(
        f"/api/v1/teams/{team.id}/webhooks",
        json={
            "url": "https://example.com/webhook",
            "events": ["package.published", "version.yanked"],
        },
        headers=_auth_header(team_owner),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["url"] == "https://example.com/webhook"
    assert "package.published" in data["events"]
    assert data["active"] is True


@pytest.mark.asyncio
async def test_create_webhook_non_admin_forbidden(client, team, team_member):
    """非 admin 不能创建 webhook"""
    resp = await client.post(
        f"/api/v1/teams/{team.id}/webhooks",
        json={
            "url": "https://example.com/webhook",
            "events": ["package.published"],
        },
        headers=_auth_header(team_member),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_webhooks(client, team, team_owner):
    """团队成员可以列出 webhooks"""
    # 先创建一个
    await client.post(
        f"/api/v1/teams/{team.id}/webhooks",
        json={"url": "https://example.com/wh1", "events": ["package.published"]},
        headers=_auth_header(team_owner),
    )

    # 列出
    resp = await client.get(
        f"/api/v1/teams/{team.id}/webhooks",
        headers=_auth_header(team_owner),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["url"] == "https://example.com/wh1"


@pytest.mark.asyncio
async def test_delete_webhook(client, team, team_owner):
    """团队 admin 可以删除 webhook"""
    # 创建
    create_resp = await client.post(
        f"/api/v1/teams/{team.id}/webhooks",
        json={"url": "https://example.com/to-delete", "events": ["package.published"]},
        headers=_auth_header(team_owner),
    )
    webhook_id = create_resp.json()["id"]

    # 删除
    resp = await client.delete(
        f"/api/v1/teams/{team.id}/webhooks/{webhook_id}",
        headers=_auth_header(team_owner),
    )
    assert resp.status_code == 204

    # 验证已删除
    list_resp = await client.get(
        f"/api/v1/teams/{team.id}/webhooks",
        headers=_auth_header(team_owner),
    )
    ids = [w["id"] for w in list_resp.json()]
    assert webhook_id not in ids


@pytest.mark.asyncio
async def test_delete_webhook_non_admin_forbidden(client, team, team_member, team_owner):
    """非 admin 不能删除 webhook"""
    # owner 创建
    create_resp = await client.post(
        f"/api/v1/teams/{team.id}/webhooks",
        json={"url": "https://example.com/wh", "events": ["package.published"]},
        headers=_auth_header(team_owner),
    )
    webhook_id = create_resp.json()["id"]

    # member 尝试删除
    resp = await client.delete(
        f"/api/v1/teams/{team.id}/webhooks/{webhook_id}",
        headers=_auth_header(team_member),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_nonexistent_webhook(client, team, team_owner):
    """删除不存在的 webhook 返回 404"""
    import uuid

    fake_id = uuid.uuid4()
    resp = await client.delete(
        f"/api/v1/teams/{team.id}/webhooks/{fake_id}",
        headers=_auth_header(team_owner),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_webhooks_non_member_forbidden(client, team, db):
    """非团队成员不能列出 webhooks"""
    from app.models.user import User
    from app.core.security import hash_password

    outsider = User(
        username="outsider",
        email="outsider@example.com",
        display_name="Outsider",
        password_hash=hash_password("OutsiderPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(outsider)
    await db.flush()

    resp = await client.get(
        f"/api/v1/teams/{team.id}/webhooks",
        headers=_auth_header(outsider),
    )
    assert resp.status_code == 403


def test_webhook_signature_verification():
    """HMAC-SHA256 签名验证"""
    from app.services.webhook import WebhookService

    secret = "test-secret-key"
    body = json.dumps({"event": "package.published"}).encode()

    # 生成签名
    expected_sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    signature = f"sha256={expected_sig}"

    # 验证
    assert WebhookService.verify_signature(secret, body, signature) is True

    # 错误签名
    assert WebhookService.verify_signature(secret, body, "sha256=wrong") is False
