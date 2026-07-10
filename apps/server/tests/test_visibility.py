"""包可见性（visibility）端到端测试

验证 public / team / private 三种可见性在 API 层正确过滤。
"""

import pytest

from app.models.user import User
from app.models.package import Package
from app.models.version import Version
from app.models.team import Team, TeamMember
from app.core.security import hash_password


@pytest.fixture
async def owner(db):
    """包所有者"""
    user = User(
        username="owner",
        email="owner@example.com",
        display_name="Owner",
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
async def member(db):
    """团队成员（非 owner）"""
    user = User(
        username="member",
        email="member@example.com",
        display_name="Member",
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
async def outsider(db):
    """非团队成员"""
    user = User(
        username="outsider",
        email="outsider@example.com",
        display_name="Outsider",
        password_hash=hash_password("OutsiderPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    return user


@pytest.fixture
async def team_with_members(db, owner, member):
    """团队 + owner 为 admin，member 为普通成员"""
    team = Team(
        name="Test Team",
        slug="testteam",
        description="A test team",
    )
    db.add(team)
    await db.flush()
    await db.refresh(team)

    # owner 为 admin
    admin_member = TeamMember(team_id=team.id, user_id=owner.id, role="admin")
    db.add(admin_member)
    await db.flush()

    # member 为普通 member
    regular_member = TeamMember(team_id=team.id, user_id=member.id, role="member")
    db.add(regular_member)
    await db.flush()
    return team


@pytest.fixture
async def public_pkg(db, owner):
    """公开包"""
    pkg = Package(
        name="public-pkg",
        scope="@owner",
        full_name="@owner/public-pkg",
        type="mcp",
        description="A public package",
        owner_id=owner.id,
        owner_type="user",
        visibility="public",
    )
    db.add(pkg)
    await db.flush()
    db.add(
        Version(
            version="1.0.0",
            package_id=pkg.id,
            manifest={},
            tarball_hash="abc",
            tarball_size=100,
            tarball_path="packages/public-pkg-1.0.0.tar.gz",
        )
    )
    await db.flush()
    return pkg


@pytest.fixture
async def team_pkg(db, team_with_members):
    """团队可见包"""
    pkg = Package(
        name="team-pkg",
        scope="@testteam",
        full_name="@testteam/team-pkg",
        type="mcp",
        description="A team package",
        owner_id=team_with_members.id,
        owner_type="team",
        visibility="team",
    )
    db.add(pkg)
    await db.flush()
    db.add(
        Version(
            version="1.0.0",
            package_id=pkg.id,
            manifest={},
            tarball_hash="def",
            tarball_size=200,
            tarball_path="packages/team-pkg-1.0.0.tar.gz",
        )
    )
    await db.flush()
    return pkg


@pytest.fixture
async def private_pkg(db, owner):
    """私有包"""
    pkg = Package(
        name="private-pkg",
        scope="@owner",
        full_name="@owner/private-pkg",
        type="mcp",
        description="A private package",
        owner_id=owner.id,
        owner_type="user",
        visibility="private",
    )
    db.add(pkg)
    await db.flush()
    db.add(
        Version(
            version="1.0.0",
            package_id=pkg.id,
            manifest={},
            tarball_hash="ghi",
            tarball_size=300,
            tarball_path="packages/private-pkg-1.0.0.tar.gz",
        )
    )
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


# =============================================================================
# Public 包测试
# =============================================================================


@pytest.mark.asyncio
async def test_public_package_visible_to_any_user(client, public_pkg, member):
    """公开包对任何已认证用户可见"""
    resp = await client.get(
        f"/api/v1/packages/{public_pkg.scope}/{public_pkg.name}",
        headers=_auth_header(member),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "public-pkg"


@pytest.mark.asyncio
async def test_public_package_visible_to_unauthenticated(client, public_pkg):
    """公开包对未认证用户也可见（只读）"""
    resp = await client.get(f"/api/v1/packages/{public_pkg.scope}/{public_pkg.name}")
    assert resp.status_code == 200


# =============================================================================
# Team 包测试
# =============================================================================


@pytest.mark.asyncio
async def test_team_package_visible_to_member(client, team_pkg, member):
    """团队包对团队成员可见"""
    resp = await client.get(
        f"/api/v1/packages/{team_pkg.scope}/{team_pkg.name}",
        headers=_auth_header(member),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "team-pkg"


@pytest.mark.asyncio
async def test_team_package_visible_to_owner(client, team_pkg, owner):
    """团队包对团队 owner 可见"""
    resp = await client.get(
        f"/api/v1/packages/{team_pkg.scope}/{team_pkg.name}",
        headers=_auth_header(owner),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_team_package_not_visible_to_outsider(client, team_pkg, outsider):
    """团队包对非成员不可见"""
    resp = await client.get(
        f"/api/v1/packages/{team_pkg.scope}/{team_pkg.name}",
        headers=_auth_header(outsider),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_team_package_not_visible_to_unauthenticated(client, team_pkg):
    """团队包对未认证用户不可见"""
    resp = await client.get(f"/api/v1/packages/{team_pkg.scope}/{team_pkg.name}")
    assert resp.status_code in (401, 404)


# =============================================================================
# Private 包测试
# =============================================================================


@pytest.mark.asyncio
async def test_private_package_visible_to_owner(client, private_pkg, owner):
    """私有包对 owner 可见"""
    resp = await client.get(
        f"/api/v1/packages/{private_pkg.scope}/{private_pkg.name}",
        headers=_auth_header(owner),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "private-pkg"


@pytest.mark.asyncio
async def test_private_package_not_visible_to_others(client, private_pkg, member):
    """私有包对其他人不可见"""
    resp = await client.get(
        f"/api/v1/packages/{private_pkg.scope}/{private_pkg.name}",
        headers=_auth_header(member),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_private_package_not_visible_to_unauthenticated(client, private_pkg):
    """私有包对未认证用户不可见"""
    resp = await client.get(f"/api/v1/packages/{private_pkg.scope}/{private_pkg.name}")
    assert resp.status_code in (401, 404)


# =============================================================================
# 搜索过滤测试
# =============================================================================


@pytest.mark.asyncio
async def test_search_excludes_non_visible_packages(client, public_pkg, team_pkg, private_pkg, outsider):
    """搜索结果排除不可见的包"""
    resp = await client.get(
        "/api/v1/packages",
        headers=_auth_header(outsider),
    )
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()["data"]]
    assert "public-pkg" in names
    # outsider 看不到 team 和 private 包
    assert "team-pkg" not in names
    assert "private-pkg" not in names


@pytest.mark.asyncio
async def test_search_includes_visible_team_packages(client, public_pkg, team_pkg, member):
    """团队成员的搜索结果包含团队包"""
    resp = await client.get(
        "/api/v1/packages",
        headers=_auth_header(member),
    )
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()["data"]]
    assert "public-pkg" in names
    assert "team-pkg" in names
