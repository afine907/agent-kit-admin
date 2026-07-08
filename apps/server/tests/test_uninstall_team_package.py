"""uninstall-team-package 端点测试

测试 DELETE /teams/{team_id}/packages/{package_id}/install 端点。
"""

import pytest
from httpx import AsyncClient
from app.models.user import User
from app.models.package import Package
from app.models.team import Team, TeamMember
from app.models.installed_package import InstalledPackage


@pytest.fixture
async def team_with_member(db, test_user: User, another_user: User):
    """创建团队，test_user 为 owner，another_user 为 member"""
    team = Team(name="Uninstall Team", slug="uninstall-team")
    db.add(team)
    await db.flush()
    await db.refresh(team)

    owner = TeamMember(team_id=team.id, user_id=test_user.id, role="owner")
    member = TeamMember(team_id=team.id, user_id=another_user.id, role="member")
    db.add_all([owner, member])
    await db.flush()
    return team


@pytest.fixture
async def team_package(db, test_user: User, team_with_member):
    """创建团队包"""
    package = Package(
        name="uninstall-pkg",
        scope="@team",
        type="mcp",
        full_name="@team/uninstall-pkg",
        description="Test package for uninstall",
        owner_id=test_user.id,
        visibility="public",
    )
    db.add(package)
    await db.flush()
    await db.refresh(package)
    return package


@pytest.fixture
async def installed_package(db, another_user: User, team_package: Package):
    """创建已安装的包记录"""
    installed = InstalledPackage(
        user_id=another_user.id,
        package_id=team_package.id,
        version_installed="1.0.0",
    )
    db.add(installed)
    await db.flush()
    return installed


class TestUninstallTeamPackage:
    """卸载团队包测试"""

    @pytest.mark.asyncio
    async def test_uninstall_success(
        self,
        client: AsyncClient,
        another_auth_headers: dict,
        team_with_member,
        team_package: Package,
        installed_package,
    ):
        """正常卸载团队包"""
        response = await client.delete(
            f"/api/v1/teams/{team_with_member.id}/packages/{team_package.id}/install",
            headers=another_auth_headers,
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_uninstall_not_installed(
        self,
        client: AsyncClient,
        another_auth_headers: dict,
        team_with_member,
        team_package: Package,
    ):
        """卸载未安装的包"""
        response = await client.delete(
            f"/api/v1/teams/{team_with_member.id}/packages/{team_package.id}/install",
            headers=another_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_uninstall_non_member(
        self,
        client: AsyncClient,
        auth_headers: dict,
        another_auth_headers: dict,
        test_user: User,
        another_user: User,
        db,
    ):
        """非团队成员不能卸载"""
        # 创建另一个团队，只有 test_user
        team = Team(name="Other Team", slug="other-uninstall")
        db.add(team)
        await db.flush()
        await db.refresh(team)

        owner = TeamMember(team_id=team.id, user_id=test_user.id, role="owner")
        db.add(owner)
        await db.flush()

        # 创建包
        package = Package(
            name="other-pkg",
            scope="@other",
            type="mcp",
            full_name="@other/other-pkg",
            owner_id=test_user.id,
            visibility="public",
        )
        db.add(package)
        await db.flush()
        await db.refresh(package)

        # another_user 不是这个团队的成员
        response = await client.delete(
            f"/api/v1/teams/{team.id}/packages/{package.id}/install",
            headers=another_auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_uninstall_unauthorized(
        self,
        client: AsyncClient,
        team_with_member,
        team_package: Package,
    ):
        """未认证请求"""
        response = await client.delete(
            f"/api/v1/teams/{team_with_member.id}/packages/{team_package.id}/install",
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_uninstall_nonexistent_team(
        self,
        client: AsyncClient,
        another_auth_headers: dict,
        team_package: Package,
    ):
        """团队不存在"""
        response = await client.delete(
            f"/api/v1/teams/00000000-0000-0000-0000-000000000000/packages/{team_package.id}/install",
            headers=another_auth_headers,
        )
        assert response.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_uninstall_nonexistent_package(
        self,
        client: AsyncClient,
        another_auth_headers: dict,
        team_with_member,
    ):
        """包不存在"""
        response = await client.delete(
            f"/api/v1/teams/{team_with_member.id}/packages/00000000-0000-0000-0000-000000000000/install",
            headers=another_auth_headers,
        )
        assert response.status_code == 404
