"""Package ownership transfer API tests"""

import pytest
from app.models.user import User
from app.models.team import Team, TeamMember
from app.models.package import Package
from app.core.security import hash_password


@pytest.fixture
async def user_a(db):
    """原始 owner"""
    user = User(
        username="owner_a",
        email="owner_a@example.com",
        display_name="Owner A",
        password_hash=hash_password("OwnerAPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    return user


@pytest.fixture
async def user_b(db):
    """新 owner"""
    user = User(
        username="owner_b",
        email="owner_b@example.com",
        display_name="Owner B",
        password_hash=hash_password("OwnerBPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    return user


@pytest.fixture
async def target_team(db, user_b):
    """目标团队"""
    t = Team(name="Target Team", slug="target-team", description="Transfer target")
    db.add(t)
    await db.flush()
    await db.refresh(t)
    db.add(TeamMember(team_id=t.id, user_id=user_b.id, role="admin"))
    await db.flush()
    return t


@pytest.fixture
async def package_a(db, user_a):
    """测试包"""
    pkg = Package(
        name="test-pkg",
        scope=f"@{user_a.username}",
        full_name=f"@{user_a.username}/test-pkg",
        type="mcp",
        owner_id=user_a.id,
        owner_type="user",
        visibility="public",
    )
    db.add(pkg)
    await db.flush()
    return pkg


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
async def test_transfer_to_user(client, package_a, user_a, user_b):
    """owner 可以将包转移给另一个用户"""
    resp = await client.post(
        f"/api/v1/packages/{package_a.scope}/{package_a.name}/transfer",
        json={
            "new_owner_type": "user",
            "new_owner_id": str(user_b.id),
            "new_scope": f"@{user_b.username}",
        },
        headers=_auth_header(user_a),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["scope"] == f"@{user_b.username}"
    assert data["owner_type"] == "user"


@pytest.mark.asyncio
async def test_transfer_to_team(client, package_a, user_a, user_b, target_team):
    """owner 可以将包转移给团队"""
    resp = await client.post(
        f"/api/v1/packages/{package_a.scope}/{package_a.name}/transfer",
        json={
            "new_owner_type": "team",
            "new_owner_id": str(target_team.id),
            "new_scope": f"@{target_team.slug}",
        },
        headers=_auth_header(user_a),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["scope"] == f"@{target_team.slug}"
    assert data["owner_type"] == "team"


@pytest.mark.asyncio
async def test_transfer_non_owner_forbidden(client, package_a, user_b):
    """非 owner 不能转移"""
    resp = await client.post(
        f"/api/v1/packages/{package_a.scope}/{package_a.name}/transfer",
        json={
            "new_owner_type": "user",
            "new_owner_id": str(user_b.id),
            "new_scope": f"@{user_b.username}",
        },
        headers=_auth_header(user_b),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_transfer_self_forbidden(client, package_a, user_a):
    """不能转移给自己"""
    resp = await client.post(
        f"/api/v1/packages/{package_a.scope}/{package_a.name}/transfer",
        json={
            "new_owner_type": "user",
            "new_owner_id": str(user_a.id),
            "new_scope": package_a.scope,
        },
        headers=_auth_header(user_a),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_transfer_target_not_found(client, package_a, user_a):
    """目标用户不存在"""
    resp = await client.post(
        f"/api/v1/packages/{package_a.scope}/{package_a.name}/transfer",
        json={
            "new_owner_type": "user",
            "new_owner_id": "00000000-0000-0000-0000-000000000000",
            "new_scope": "@nonexistent",
        },
        headers=_auth_header(user_a),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_transfer_package_not_found(client, user_a):
    """包不存在"""
    resp = await client.post(
        "/api/v1/packages/@owner_a/nonexistent/transfer",
        json={
            "new_owner_type": "user",
            "new_owner_id": str(user_a.id),
            "new_scope": "@owner_a",
        },
        headers=_auth_header(user_a),
    )
    assert resp.status_code == 404
