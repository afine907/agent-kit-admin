"""团队模型和服务测试"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.team import Team, TeamMember
from app.models.user import User
from app.services.team import TeamService
from app.errors import AppError


class TestTeamModel:
    """团队模型测试"""

    @pytest.mark.asyncio
    async def test_create_team(self, db: AsyncSession, test_user: User):
        """测试创建团队模型"""
        team = Team(
            name="Test Team",
            slug="test-team",
            description="A test team",
        )
        db.add(team)
        await db.flush()
        await db.refresh(team)

        assert team.id is not None
        assert team.name == "Test Team"
        assert team.slug == "test-team"
        assert team.description == "A test team"
        assert team.created_at is not None
        assert team.updated_at is not None

    @pytest.mark.asyncio
    async def test_create_team_member(self, db: AsyncSession, test_user: User):
        """测试创建团队成员"""
        team = Team(name="Test Team", slug="test-team")
        db.add(team)
        await db.flush()

        member = TeamMember(
            team_id=team.id,
            user_id=test_user.id,
            role="owner",
        )
        db.add(member)
        await db.flush()

        assert member.team_id == team.id
        assert member.user_id == test_user.id
        assert member.role == "owner"
        assert member.joined_at is not None


class TestTeamService:
    """团队服务测试"""

    @pytest.mark.asyncio
    async def test_create_team(self, db: AsyncSession, test_user: User):
        """测试创建团队"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="My Team",
            slug="my-team",
            description="A great team",
        )

        assert team.name == "My Team"
        assert team.slug == "my-team"
        assert team.description == "A great team"

        # 验证创建者成为 owner
        members = await service.list_members(str(team.id))
        assert len(members) == 1
        assert members[0]["user_id"] == str(test_user.id)
        assert members[0]["role"] == "owner"

    @pytest.mark.asyncio
    async def test_create_team_duplicate_slug(self, db: AsyncSession, test_user: User):
        """测试创建重复 slug 的团队"""
        service = TeamService(db)
        await service.create_team(
            owner_id=str(test_user.id),
            name="Team 1",
            slug="same-slug",
        )

        with pytest.raises(AppError) as exc_info:
            await service.create_team(
                owner_id=str(test_user.id),
                name="Team 2",
                slug="same-slug",
            )
        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_get_team(self, db: AsyncSession, test_user: User):
        """测试获取团队详情"""
        service = TeamService(db)
        created = await service.create_team(
            owner_id=str(test_user.id),
            name="Get Team",
            slug="get-team",
        )

        team = await service.get_team(str(created.id))
        assert team.name == "Get Team"
        assert team.slug == "get-team"

    @pytest.mark.asyncio
    async def test_get_team_not_found(self, db: AsyncSession):
        """测试获取不存在的团队"""
        service = TeamService(db)
        with pytest.raises(AppError) as exc_info:
            await service.get_team("nonexistent-id")
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_list_teams(self, db: AsyncSession, test_user: User, another_user: User):
        """测试列出用户所属团队"""
        service = TeamService(db)

        # 创建两个团队
        await service.create_team(
            owner_id=str(test_user.id),
            name="Team 1",
            slug="team-1",
        )
        await service.create_team(
            owner_id=str(test_user.id),
            name="Team 2",
            slug="team-2",
        )

        # test_user 应该有两个团队
        teams = await service.list_teams(str(test_user.id))
        assert len(teams) == 2

        # another_user 没有团队
        teams = await service.list_teams(str(another_user.id))
        assert len(teams) == 0

    @pytest.mark.asyncio
    async def test_update_team(self, db: AsyncSession, test_user: User):
        """测试更新团队"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Old Name",
            slug="old-slug",
        )

        updated = await service.update_team(
            team_id=str(team.id),
            user_id=str(test_user.id),
            data={"name": "New Name", "description": "Updated description"},
        )

        assert updated.name == "New Name"
        assert updated.description == "Updated description"

    @pytest.mark.asyncio
    async def test_update_team_requires_admin(self, db: AsyncSession, test_user: User, another_user: User):
        """测试更新团队需要 admin 权限"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        # 添加 another_user 为 member
        await service.add_member(str(team.id), str(another_user.id), role="member")

        # member 不能更新团队
        with pytest.raises(AppError) as exc_info:
            await service.update_team(
                team_id=str(team.id),
                user_id=str(another_user.id),
                data={"name": "Hacked"},
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_team(self, db: AsyncSession, test_user: User):
        """测试删除团队"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Delete Team",
            slug="delete-team",
        )

        await service.delete_team(str(team.id), str(test_user.id))

        # 验证团队已被删除
        with pytest.raises(AppError) as exc_info:
            await service.get_team(str(team.id))
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_team_requires_owner(self, db: AsyncSession, test_user: User, another_user: User):
        """测试删除团队需要 owner 权限"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        # 添加 another_user 为 admin
        await service.add_member(str(team.id), str(another_user.id), role="admin")

        # admin 不能删除团队
        with pytest.raises(AppError) as exc_info:
            await service.delete_team(str(team.id), str(another_user.id))
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_add_member(self, db: AsyncSession, test_user: User, another_user: User):
        """测试添加成员"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        member = await service.add_member(str(team.id), str(another_user.id), role="member")
        assert member["user_id"] == str(another_user.id)
        assert member["role"] == "member"

    @pytest.mark.asyncio
    async def test_add_duplicate_member(self, db: AsyncSession, test_user: User, another_user: User):
        """测试添加重复成员"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        await service.add_member(str(team.id), str(another_user.id), role="member")

        with pytest.raises(AppError) as exc_info:
            await service.add_member(str(team.id), str(another_user.id), role="member")
        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_remove_member(self, db: AsyncSession, test_user: User, another_user: User):
        """测试移除成员"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        await service.add_member(str(team.id), str(another_user.id), role="member")
        await service.remove_member(str(team.id), str(another_user.id))

        members = await service.list_members(str(team.id))
        assert len(members) == 1  # 只剩 owner

    @pytest.mark.asyncio
    async def test_remove_owner(self, db: AsyncSession, test_user: User):
        """测试不能移除 owner"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        with pytest.raises(AppError) as exc_info:
            await service.remove_member(str(team.id), str(test_user.id))
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_member_role(self, db: AsyncSession, test_user: User, another_user: User):
        """测试更新成员角色"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        await service.add_member(str(team.id), str(another_user.id), role="member")
        updated = await service.update_member_role(str(team.id), str(another_user.id), role="admin")
        assert updated["role"] == "admin"

    @pytest.mark.asyncio
    async def test_update_member_role_to_owner(self, db: AsyncSession, test_user: User, another_user: User):
        """测试不能将角色改为 owner"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        await service.add_member(str(team.id), str(another_user.id), role="member")

        with pytest.raises(AppError) as exc_info:
            await service.update_member_role(str(team.id), str(another_user.id), role="owner")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_list_members(self, db: AsyncSession, test_user: User, another_user: User):
        """测试列出成员"""
        service = TeamService(db)
        team = await service.create_team(
            owner_id=str(test_user.id),
            name="Team",
            slug="team",
        )

        await service.add_member(str(team.id), str(another_user.id), role="admin")

        members = await service.list_members(str(team.id))
        assert len(members) == 2

        # 验证成员信息
        roles = {m["user_id"]: m["role"] for m in members}
        assert roles[str(test_user.id)] == "owner"
        assert roles[str(another_user.id)] == "admin"
