"""Workspace 隔离测试 — Phase 1

三层可见性语义:
  public  — 任何人可读
  team    — 仅 owner_type=team 的团队成员可读
  private — 仅包 owner (user 或 team) 可读

TDD: 先写测试，验证失败后实现服务层。
"""

import pytest
from app.models.package import Package
from app.models.team import Team, TeamMember


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
async def team(db, test_user):
    """创建测试团队，test_user 成为 owner"""
    team = Team(
        name="Test Team",
        slug="test-team",
        description="A team for testing",
    )
    db.add(team)
    await db.flush()
    await db.refresh(team)

    # test_user 已经是 team owner
    member = TeamMember(
        team_id=team.id,
        user_id=test_user.id,
        role="owner",
    )
    db.add(member)
    await db.flush()
    return team


@pytest.fixture
async def team_admin(db, team, another_user):
    """another_user 作为 team admin"""
    member = TeamMember(
        team_id=team.id,
        user_id=another_user.id,
        role="admin",
    )
    db.add(member)
    await db.flush()
    return member


@pytest.fixture
async def team_member_only(db, team, local_user):
    """local_user 作为普通 member"""
    member = TeamMember(
        team_id=team.id,
        user_id=local_user.id,
        role="member",
    )
    db.add(member)
    await db.flush()
    return member


# --- Team-owned packages ---


@pytest.fixture
async def team_public_package(db, team):
    """团队拥有的 public 包 (visibility=public, owner_type=team)"""
    pkg = Package(
        name="team-public",
        scope="@test-team",
        type="mcp",
        full_name="@test-team/team-public",
        description="Team public package",
        owner_id=team.id,
        owner_type="team",
        visibility="public",
    )
    db.add(pkg)
    await db.flush()
    return pkg


@pytest.fixture
async def team_team_package(db, team):
    """团队拥有的 team 包 (visibility=team, owner_type=team)"""
    pkg = Package(
        name="team-scoped",
        scope="@test-team",
        type="mcp",
        full_name="@test-team/team-scoped",
        description="Team team-scoped package",
        owner_id=team.id,
        owner_type="team",
        visibility="team",
    )
    db.add(pkg)
    await db.flush()
    return pkg


@pytest.fixture
async def team_private_package(db, team):
    """团队拥有的 private 包 (visibility=private, owner_type=team)"""
    pkg = Package(
        name="team-private",
        scope="@test-team",
        type="mcp",
        full_name="@test-team/team-private",
        description="Team private package",
        owner_id=team.id,
        owner_type="team",
        visibility="private",
    )
    db.add(pkg)
    await db.flush()
    return pkg


# --- User-owned packages ---


@pytest.fixture
async def user_public_package(db, test_user):
    """用户拥有的 public 包"""
    pkg = Package(
        name="user-public",
        scope="@test",
        type="mcp",
        full_name="@test/user-public",
        description="User public package",
        owner_id=test_user.id,
        owner_type="user",
        visibility="public",
    )
    db.add(pkg)
    await db.flush()
    return pkg


@pytest.fixture
async def user_private_package(db, test_user):
    """用户拥有的 private 包"""
    pkg = Package(
        name="user-private",
        scope="@test",
        type="mcp",
        full_name="@test/user-private",
        description="User private package",
        owner_id=test_user.id,
        owner_type="user",
        visibility="private",
    )
    db.add(pkg)
    await db.flush()
    return pkg


# =============================================================================
# GET /api/v1/packages/{scope}/{name} — 详情可见性
# =============================================================================


class TestGetPackageVisibility:
    """get_package 可见性测试"""

    # --- public 包：任何人可读 ---

    async def test_public_package_guest_can_read(self, client, team_public_package):
        """未登录用户可以读取 public 包"""
        resp = await client.get(f"/api/v1/packages/{team_public_package.scope}/{team_public_package.name}")
        assert resp.status_code == 200
        assert resp.json()["name"] == team_public_package.name

    async def test_public_package_logged_in_can_read(self, client, auth_headers, team_public_package):
        """登录用户可以读取 public 包"""
        resp = await client.get(
            f"/api/v1/packages/{team_public_package.scope}/{team_public_package.name}",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_public_package_stranger_can_read(self, client, another_auth_headers, team_public_package):
        """非团队成员的登录用户可以读取 public 包"""
        resp = await client.get(
            f"/api/v1/packages/{team_public_package.scope}/{team_public_package.name}",
            headers=another_auth_headers,
        )
        assert resp.status_code == 200

    # --- team 包：仅团队成员可读 ---

    async def test_team_package_team_owner_can_read(self, client, auth_headers, team_team_package, test_user):
        """团队 owner 可以读取 team-visibility 包"""
        resp = await client.get(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_team_package_team_admin_can_read(self, client, team, team_admin, team_team_package, another_user):
        """团队 admin 可以读取 team-visibility 包"""
        # 重新生成 token 因为 another_user 变成了 admin
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import get_settings

        settings = get_settings()
        payload = {
            "sub": str(another_user.id),
            "username": another_user.username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        }
        admin_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        headers = {"Authorization": f"Bearer {admin_token}"}

        resp = await client.get(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=headers,
        )
        assert resp.status_code == 200

    async def test_team_package_team_member_can_read(
        self, client, team, team_member_only, team_team_package, local_user
    ):
        """团队 member 可以读取 team-visibility 包"""
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import get_settings

        settings = get_settings()
        payload = {
            "sub": str(local_user.id),
            "username": local_user.username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        }
        member_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        headers = {"Authorization": f"Bearer {member_token}"}

        resp = await client.get(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=headers,
        )
        assert resp.status_code == 200

    async def test_team_package_guest_cannot_read(self, client, team_team_package):
        """未登录用户不能读取 team-visibility 包（返回 404）"""
        resp = await client.get(f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}")
        assert resp.status_code == 404

    async def test_team_package_stranger_cannot_read(self, client, another_auth_headers, team_team_package):
        """非团队成员的登录用户不能读取 team-visibility 包（返回 404）"""
        resp = await client.get(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=another_auth_headers,
        )
        assert resp.status_code == 404

    # --- private 包：仅 owner 可读 ---

    async def test_private_package_owner_can_read(self, client, auth_headers, user_private_package):
        """包 owner 可以读取自己的 private 包"""
        resp = await client.get(
            f"/api/v1/packages/{user_private_package.scope}/{user_private_package.name}",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_private_package_stranger_cannot_read(self, client, another_auth_headers, user_private_package):
        """非 owner 不能读取 private 包（返回 404）"""
        resp = await client.get(
            f"/api/v1/packages/{user_private_package.scope}/{user_private_package.name}",
            headers=another_auth_headers,
        )
        assert resp.status_code == 404

    async def test_private_team_package_team_owner_can_read(self, client, auth_headers, team_private_package):
        """团队 owner 可以读取团队 private 包"""
        resp = await client.get(
            f"/api/v1/packages/{team_private_package.scope}/{team_private_package.name}",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_private_team_package_team_member_cannot_read(
        self, client, team, team_member_only, team_private_package, local_user
    ):
        """团队 member 不能读取 team private 包"""
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import get_settings

        settings = get_settings()
        payload = {
            "sub": str(local_user.id),
            "username": local_user.username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        }
        member_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        headers = {"Authorization": f"Bearer {member_token}"}

        resp = await client.get(
            f"/api/v1/packages/{team_private_package.scope}/{team_private_package.name}",
            headers=headers,
        )
        # member 不是 owner，应该 404
        assert resp.status_code == 404

    async def test_private_team_package_stranger_cannot_read(self, client, another_auth_headers, team_private_package):
        """非团队成员不能读取 team private 包"""
        resp = await client.get(
            f"/api/v1/packages/{team_private_package.scope}/{team_private_package.name}",
            headers=another_auth_headers,
        )
        assert resp.status_code == 404


# =============================================================================
# GET /packages — 列表可见性
# =============================================================================


class TestListPackagesVisibility:
    """list_packages 可见性过滤测试"""

    async def test_guest_sees_only_public_packages(
        self, client, team_public_package, team_team_package, user_public_package, user_private_package
    ):
        """未登录用户只能看到 public 包"""
        resp = await client.get("/api/v1/packages")
        assert resp.status_code == 200
        data = resp.json()

        names = {p["name"] for p in data["data"]}

        # public 包可见
        assert team_public_package.name in names
        assert user_public_package.name in names
        # team-visibility 包不可见
        assert team_team_package.name not in names
        # private 包不可见
        assert user_private_package.name not in names

    async def test_team_owner_sees_team_packages(
        self, client, auth_headers, team_public_package, team_team_package, user_public_package
    ):
        """团队 owner 看到: public + 团队 team-visibility 包"""
        resp = await client.get("/api/v1/packages", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        names = {p["name"] for p in data["data"]}

        # public 包可见
        assert user_public_package.name in names
        assert team_public_package.name in names
        # team-visibility 包对团队成员可见
        assert team_team_package.name in names

    async def test_stranger_cannot_see_team_visibility_packages(
        self, client, another_auth_headers, team_public_package, team_team_package, user_public_package
    ):
        """非团队成员的登录用户: 只能看到 public 包，看不到 team-visibility 包"""
        resp = await client.get("/api/v1/packages", headers=another_auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        names = {p["name"] for p in data["data"]}

        assert user_public_package.name in names
        assert team_public_package.name in names  # public visibility
        # team-visibility 包不应出现
        assert team_team_package.name not in names

    async def test_team_package_filter(self, client, auth_headers, team, team_team_package):
        """scope 过滤对 team-visibility 包也生效"""
        resp = await client.get(f"/api/v1/packages?scope=@{team.slug}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        names = {p["name"] for p in data["data"]}
        assert team_team_package.name in names

    async def test_stranger_filter_team_scope_cannot_see_team_package(
        self, client, another_auth_headers, team, team_team_package
    ):
        """非成员用 scope 过滤查询团队包时返回空（不泄露存在）"""
        resp = await client.get(f"/api/v1/packages?scope=@{team.slug}", headers=another_auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        names = {p["name"] for p in data["data"]}
        assert team_team_package.name not in names


# =============================================================================
# POST /packages — 创建 team 包需要团队成员身份
# =============================================================================


class TestCreateTeamPackage:
    """创建团队包的权限测试"""

    async def test_create_team_package_requires_team_membership(self, client, auth_headers, team):
        """登录用户必须是团队成员才能创建 @team-slug 包"""
        resp = await client.post(
            "/api/v1/packages",
            headers=auth_headers,
            json={
                "name": "new-package",
                "scope": f"@{team.slug}",
                "type": "mcp",
                "visibility": "team",
                "owner_type": "team",
            },
        )
        # test_user 是团队 owner，应该可以创建
        assert resp.status_code == 201

    async def test_create_team_package_requires_team_membership_neg(self, client, another_auth_headers, team):
        """非团队成员不能创建 @team-slug 包（返回 403）"""
        resp = await client.post(
            "/api/v1/packages",
            headers=another_auth_headers,
            json={
                "name": "new-package-2",
                "scope": f"@{team.slug}",
                "type": "mcp",
                "visibility": "team",
                "owner_type": "team",
            },
        )
        assert resp.status_code == 403

    async def test_create_team_package_public_requires_membership(self, client, another_auth_headers, team):
        """非团队成员不能创建 public 包但 scope 为 @team-slug"""
        resp = await client.post(
            "/api/v1/packages",
            headers=another_auth_headers,
            json={
                "name": "new-public",
                "scope": f"@{team.slug}",
                "type": "mcp",
                "visibility": "public",
            },
        )
        assert resp.status_code == 403

    async def test_team_member_can_create_public_team_scope_package(self, client, team, team_member_only, local_user):
        """团队 member 可以在 @team-slug 下创建 public 包"""
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import get_settings

        settings = get_settings()
        payload = {
            "sub": str(local_user.id),
            "username": local_user.username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        }
        member_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        headers = {"Authorization": f"Bearer {member_token}"}

        resp = await client.post(
            "/api/v1/packages",
            headers=headers,
            json={
                "name": "member-created",
                "scope": f"@{team.slug}",
                "type": "mcp",
                "visibility": "public",
            },
        )
        assert resp.status_code == 201


# =============================================================================
# PUT /api/v1/packages/{scope}/{name} — 编辑权限
# =============================================================================


class TestUpdatePackage:
    """编辑包的权限测试"""

    async def test_team_package_only_owner_or_admin_can_update(
        self, client, team, team_team_package, auth_headers, another_auth_headers, another_user
    ):
        """团队 owner 可以更新 team-visibility 包"""
        resp = await client.patch(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=auth_headers,
            json={"description": "updated"},
        )
        assert resp.status_code == 200

    async def test_team_member_cannot_update_team_package(
        self, client, team, team_member_only, team_team_package, local_user
    ):
        """团队 member 不能更新 team-visibility 包"""
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import get_settings

        settings = get_settings()
        payload = {
            "sub": str(local_user.id),
            "username": local_user.username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        }
        member_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        headers = {"Authorization": f"Bearer {member_token}"}

        resp = await client.patch(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=headers,
            json={"description": "updated"},
        )
        assert resp.status_code == 403

    async def test_stranger_cannot_update_team_package(self, client, another_auth_headers, team_team_package):
        """非团队成员不能更新 team-visibility 包"""
        resp = await client.patch(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=another_auth_headers,
            json={"description": "updated"},
        )
        assert resp.status_code == 404  # 看不到包


# =============================================================================
# DELETE /api/v1/packages/{scope}/{name} — 删除权限
# =============================================================================


class TestDeletePackage:
    """删除包的权限测试"""

    async def test_team_owner_can_delete_team_package(self, client, auth_headers, team_team_package):
        """团队 owner 可以删除 team-visibility 包"""
        resp = await client.delete(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_team_member_cannot_delete_team_package(
        self, client, team, team_member_only, team_team_package, local_user
    ):
        """团队 member 不能删除 team-visibility 包"""
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import get_settings

        settings = get_settings()
        payload = {
            "sub": str(local_user.id),
            "username": local_user.username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        }
        member_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        headers = {"Authorization": f"Bearer {member_token}"}

        resp = await client.delete(
            f"/api/v1/packages/{team_team_package.scope}/{team_team_package.name}",
            headers=headers,
        )
        assert resp.status_code == 403
