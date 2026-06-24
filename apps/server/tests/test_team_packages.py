"""团队包管理 API 测试

测试范围（基于 docs/specs/team-skill-management.md）：
  - AC-01: 发布工具包到团队（Web）
  - AC-02: 发布工具包到团队（CLI）
  - AC-04: 安装团队包（CLI）
  - AC-07: 团队包列表显示安装状态
  - AC-08: CLI 查看团队包状态
  - AC-10: 非团队成员无法访问
  - AC-11: owner 添加/移除成员
"""

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from jose import jwt
from app.models.package import Package
from app.models.version import Version
from app.models.team import Team, TeamMember
from app.models.installed_package import InstalledPackage


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
async def team(db, test_user):
    """创建测试团队，test_user 为 owner"""
    team = Team(name="Frontend Team", slug="frontend", description="Frontend tools")
    db.add(team)
    await db.flush()
    await db.refresh(team)

    member = TeamMember(team_id=team.id, user_id=test_user.id, role="owner")
    db.add(member)
    await db.flush()
    return team


@pytest.fixture
async def another_team(db, another_user):
    """创建另一个团队，another_user 为 owner"""
    team = Team(name="Other Team", slug="other-team", description="Other tools")
    db.add(team)
    await db.flush()
    await db.refresh(team)

    member = TeamMember(team_id=team.id, user_id=another_user.id, role="owner")
    db.add(member)
    await db.flush()
    return team


@pytest.fixture
async def team_package_v1(db, team, test_user):
    """团队包 v1.0.0"""
    pkg = Package(
        name="web-search-mcp",
        scope="@frontend",
        type="mcp",
        full_name="@frontend/web-search-mcp",
        description="Web search tool",
        license="MIT",
        owner_id=team.id,
        owner_type="team",
        visibility="team",
        latest_version="v1.0.0",
    )
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    ver = Version(
        package_id=pkg.id,
        version="v1.0.0",
        manifest={"name": "web-search-mcp", "version": "v1.0.0", "type": "mcp"},
        tarball_hash="sha256:abc123",
        tarball_size=1024,
        tarball_path=f"packages/@frontend/web-search-mcp/v1.0.0.tar.gz",
        tag="latest",
        published_by=test_user.id,
    )
    db.add(ver)
    await db.flush()
    return pkg


@pytest.fixture
async def team_package_v2(db, team_package_v1, test_user):
    """团队包 v1.1.0（在 v1.0.0 基础上更新版本）"""
    pkg = await db.get(Package, team_package_v1.id)

    ver = Version(
        package_id=pkg.id,
        version="v1.1.0",
        manifest={"name": "web-search-mcp", "version": "v1.1.0", "type": "mcp"},
        tarball_hash="sha256:def456",
        tarball_size=1024,
        tarball_path=f"packages/@frontend/web-search-mcp/v1.1.0.tar.gz",
        tag="latest",
        published_by=test_user.id,
    )
    db.add(ver)
    pkg.latest_version = "v1.1.0"
    await db.flush()
    return pkg


@pytest.fixture
async def installed_package_v1(db, test_user, team_package_v1):
    """test_user 安装了 team_package_v1 (v1.0.0)"""
    installed = InstalledPackage(
        user_id=test_user.id,
        package_id=team_package_v1.id,
        version_installed="v1.0.0",
    )
    db.add(installed)
    await db.flush()
    return installed


# =============================================================================
# AC-01: 发布工具包到团队（Web）
# =============================================================================

class TestPublishTeamPackage:
    """AC-01 / AC-02: 发布包到团队"""

    @pytest.mark.asyncio
    async def test_publish_team_package_success(
        self, client: AsyncClient, auth_headers: dict, team
    ):
        """发布新包到团队 → 201"""
        response = await client.post(
            f"/api/v1/teams/{team.id}/packages",
            json={
                "name": "db-toolkit",
                "type": "mcp",
                "description": "Database toolkit",
                "visibility": "team",
                "owner_type": "team",
                "manifest": {"name": "db-toolkit", "version": "0.1.0", "type": "mcp"},
                "tarball": "dGVzdCB0YXJibGxlIGNvbnRlbnQ=",  # base64 dummy
            },
            headers=auth_headers,
        )
        assert response.status_code == 201, response.json()
        data = response.json()
        assert data["name"] == "db-toolkit"
        assert data["scope"] == "@frontend"
        assert data["owner_type"] == "team"
        assert data["visibility"] == "team"

    @pytest.mark.asyncio
    async def test_publish_team_package_duplicate(
        self, client: AsyncClient, auth_headers: dict, team, team_package_v1
    ):
        """同名包重复发布 → 409"""
        response = await client.post(
            f"/api/v1/teams/{team.id}/packages",
            json={
                "name": "web-search-mcp",  # 已在 team_package_v1
                "type": "mcp",
                "description": "Duplicate",
                "visibility": "team",
                "owner_type": "team",
                "manifest": {"name": "web-search-mcp", "version": "0.1.0", "type": "mcp"},
                "tarball": "dGVzdA==",
            },
            headers=auth_headers,
        )
        assert response.status_code == 409, response.json()

    @pytest.mark.asyncio
    async def test_publish_team_package_unauthorized(
        self, client: AsyncClient, team
    ):
        """未登录发布 → 401"""
        response = await client.post(
            f"/api/v1/teams/{team.id}/packages",
            json={
                "name": "new-pkg",
                "type": "mcp",
                "visibility": "team",
                "owner_type": "team",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_publish_to_non_member_team(
        self, client: AsyncClient, another_auth_headers: dict, team
    ):
        """非团队成员发布 → 403"""
        response = await client.post(
            f"/api/v1/teams/{team.id}/packages",
            json={
                "name": "hack-pkg",
                "type": "mcp",
                "visibility": "team",
                "owner_type": "team",
            },
            headers=another_auth_headers,
        )
        assert response.status_code == 403


# =============================================================================
# AC-07 / AC-08: 团队包列表（含安装状态）
# =============================================================================

class TestTeamPackageList:
    """AC-07: 团队包列表显示安装状态"""

    @pytest.mark.asyncio
    async def test_list_team_packages_as_member(
        self, client: AsyncClient, auth_headers: dict, team, team_package_v2, installed_package_v1
    ):
        """成员查看团队包列表 → 包含 my_installed_version + has_update"""
        response = await client.get(
            f"/api/v1/teams/{team.id}/packages",
            headers=auth_headers,
        )
        assert response.status_code == 200, response.json()
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        pkg = data[0]
        assert pkg["name"] == "web-search-mcp"
        assert pkg["latest_version"] == "v1.1.0"
        assert pkg["my_installed_version"] == "v1.0.0"
        assert pkg["has_update"] is True

    @pytest.mark.asyncio
    async def test_list_team_packages_up_to_date(
        self, client: AsyncClient, auth_headers: dict, team, team_package_v2, db, test_user
    ):
        """已装最新版本 → has_update = False"""
        # 安装 v1.1.0（最新）
        pkg = await db.get(Package, team_package_v2.id)
        installed = InstalledPackage(
            user_id=test_user.id,
            package_id=pkg.id,
            version_installed="v1.1.0",
        )
        db.add(installed)
        await db.flush()

        response = await client.get(
            f"/api/v1/teams/{team.id}/packages",
            headers=auth_headers,
        )
        data = response.json()
        assert data[0]["has_update"] is False
        assert data[0]["my_installed_version"] == "v1.1.0"

    @pytest.mark.asyncio
    async def test_list_team_packages_not_installed(
        self, client: AsyncClient, auth_headers: dict, team, team_package_v2
    ):
        """未安装 → my_installed_version = null, has_update = False"""
        response = await client.get(
            f"/api/v1/teams/{team.id}/packages",
            headers=auth_headers,
        )
        data = response.json()
        assert data[0]["my_installed_version"] is None
        assert data[0]["has_update"] is False

    @pytest.mark.asyncio
    async def test_list_team_packages_non_member_forbidden(
        self, client: AsyncClient, another_auth_headers: dict, team
    ):
        """非团队成员 → 403"""
        response = await client.get(
            f"/api/v1/teams/{team.id}/packages",
            headers=another_auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_list_other_team_packages_forbidden(
        self, client: AsyncClient, auth_headers: dict, another_team
    ):
        """访问其他团队包列表 → 403"""
        response = await client.get(
            f"/api/v1/teams/{another_team.id}/packages",
            headers=auth_headers,
        )
        assert response.status_code == 403


# =============================================================================
# 团队包详情
# =============================================================================

class TestTeamPackageDetail:
    """AC-05: 团队包详情"""

    @pytest.mark.asyncio
    async def test_get_team_package_detail(
        self, client: AsyncClient, auth_headers: dict, team, team_package_v1
    ):
        """获取团队包详情 → 200"""
        response = await client.get(
            f"/api/v1/teams/{team.id}/packages/{team_package_v1.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200, response.json()
        data = response.json()
        assert data["name"] == "web-search-mcp"
        assert data["latest_version"] == "v1.0.0"

    @pytest.mark.asyncio
    async def test_get_other_team_package_forbidden(
        self, client: AsyncClient, auth_headers: dict, another_team, another_user, db
    ):
        """获取其他团队包 → 403"""
        # 在 another_team 创建一个包
        other_pkg = Package(
            name="private-tool",
            scope="@other-team",
            type="mcp",
            full_name="@other-team/private-tool",
            owner_id=another_team.id,
            owner_type="team",
            visibility="team",
        )
        db.add(other_pkg)
        await db.flush()

        response = await client.get(
            f"/api/v1/teams/{another_team.id}/packages/{other_pkg.id}",
            headers=auth_headers,
        )
        assert response.status_code == 403


# =============================================================================
# 团队包版本历史
# =============================================================================

class TestTeamPackageVersions:
    """AC-01: 版本历史"""

    @pytest.mark.asyncio
    async def test_list_team_package_versions(
        self, client: AsyncClient, auth_headers: dict, team, team_package_v2
    ):
        """列出团队包所有版本 → 200，含 v1.0.0 + v1.1.0"""
        response = await client.get(
            f"/api/v1/teams/{team.id}/packages/{team_package_v2.id}/versions",
            headers=auth_headers,
        )
        assert response.status_code == 200, response.json()
        data = response.json()
        assert data["total"] == 2
        versions = [v["version"] for v in data["data"]]
        assert "v1.0.0" in versions
        assert "v1.1.0" in versions

    @pytest.mark.asyncio
    async def test_publish_new_version(
        self, client: AsyncClient, auth_headers: dict, team, team_package_v1
    ):
        """发布新版本 → 201"""
        response = await client.post(
            f"/api/v1/teams/{team.id}/packages/{team_package_v1.id}/versions",
            json={
                "version": "v2.0.0",
                "manifest": {"name": "web-search-mcp", "version": "v2.0.0", "type": "mcp"},
                "tarball": "dGVzdCB2Mi4wLjAgdGFyYmFsbGU=",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201, response.json()
        data = response.json()
        assert data["version"] == "v2.0.0"


# =============================================================================
# AC-10: 团队隔离
# =============================================================================

class TestTeamIsolation:
    """AC-10: 非团队成员无法访问"""

    @pytest.mark.asyncio
    async def test_non_member_cannot_install_team_package(
        self, client: AsyncClient, another_auth_headers: dict, team, team_package_v1
    ):
        """非成员安装 → 403"""
        # another_user 不在 team 中
        response = await client.post(
            f"/api/v1/teams/{team.id}/packages/{team_package_v1.id}/install",
            headers=another_auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_non_member_cannot_see_team_package_list(
        self, client: AsyncClient, another_auth_headers: dict, team
    ):
        """非成员查看团队包列表 → 403"""
        response = await client.get(
            f"/api/v1/teams/{team.id}/packages",
            headers=another_auth_headers,
        )
        assert response.status_code == 403


# =============================================================================
# AC-11: 成员管理（已在 team_api 测试，这里补充团队包发布权限）
# =============================================================================

class TestTeamMemberPermissions:
    """补充：团队成员工具包发布权限"""

    @pytest.mark.asyncio
    async def test_member_can_publish_team_package(
        self, client: AsyncClient, auth_headers: dict, team, db, another_user
    ):
        """普通成员可以发布团队包（MVP 阶段）"""
        # 先把 another_user 加为 member
        member = TeamMember(team_id=team.id, user_id=another_user.id, role="member")
        db.add(member)
        await db.flush()

        # 用 another_user 的 token
        from tests.conftest import _generate_token
        from app.config import get_settings
        settings = get_settings()
        payload = {
            "sub": str(another_user.id),
            "username": another_user.username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        }
        member_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        member_headers = {"Authorization": f"Bearer {member_token}"}

        response = await client.post(
            f"/api/v1/teams/{team.id}/packages",
            json={
                "name": "member-tool",
                "type": "mcp",
                "description": "Member published",
                "visibility": "team",
                "owner_type": "team",
                "manifest": {"name": "member-tool", "version": "0.1.0", "type": "mcp"},
                "tarball": "dGVzdA==",
            },
            headers=member_headers,
        )
        # MVP: 所有成员都可以发布
        assert response.status_code == 201, response.json()
