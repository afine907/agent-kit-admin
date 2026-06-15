"""团队管理服务"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.team import Team, TeamMember
from app.models.user import User
from app.errors import AppError, ErrorCodes


class TeamService:
    """团队管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_team(
        self,
        owner_id: str,
        name: str,
        slug: str,
        description: str | None = None,
    ) -> Team:
        """创建团队，创建者成为 owner"""
        # 检查 slug 是否已存在
        existing = await self.get_by_slug(slug)
        if existing:
            raise AppError(
                code=ErrorCodes.TEAM_SLUG_EXISTS,
                message=f"Team slug '{slug}' already exists",
                status_code=409,
            )

        # 创建团队
        team = Team(
            name=name,
            slug=slug,
            description=description,
        )
        self.db.add(team)
        await self.db.flush()

        # 创建者成为 owner
        member = TeamMember(
            team_id=team.id,
            user_id=owner_id,
            role="owner",
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(team)
        return team

    async def get_team(self, team_id: str) -> Team:
        """获取团队详情"""
        result = await self.db.execute(select(Team).where(Team.id == team_id))
        team = result.scalar_one_or_none()

        if not team:
            raise AppError(
                code=ErrorCodes.NOT_FOUND,
                message=f"Team {team_id} not found",
                status_code=404,
            )

        return team

    async def get_by_slug(self, slug: str) -> Team | None:
        """通过 slug 获取团队"""
        result = await self.db.execute(select(Team).where(Team.slug == slug))
        return result.scalar_one_or_none()

    async def list_teams(self, user_id: str) -> list[Team]:
        """列出用户所属团队"""
        result = await self.db.execute(
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(TeamMember.user_id == user_id)
            .order_by(Team.name)
        )
        return list(result.scalars().all())

    async def update_team(
        self,
        team_id: str,
        user_id: str,
        data: dict,
    ) -> Team:
        """更新团队（需 admin 权限）"""
        team = await self.get_team(team_id)

        # 权限检查：需要 admin 或 owner
        await self._check_admin_permission(team_id, user_id)

        # 更新字段
        if "name" in data and data["name"] is not None:
            team.name = data["name"]
        if "description" in data:
            team.description = data["description"]
        if "avatar_url" in data:
            team.avatar_url = data["avatar_url"]

        await self.db.commit()
        await self.db.refresh(team)
        return team

    async def delete_team(self, team_id: str, user_id: str) -> None:
        """删除团队（需 owner 权限）"""
        team = await self.get_team(team_id)

        # 权限检查：需要 owner
        await self._check_owner_permission(team_id, user_id)

        # 删除团队（级联删除成员）
        await self.db.delete(team)
        await self.db.commit()

    async def add_member(
        self,
        team_id: str,
        user_id: str,
        role: str = "member",
    ) -> dict:
        """添加成员"""
        # 验证角色值
        if role not in ("admin", "member"):
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message=f"Invalid role: {role}. Must be 'admin' or 'member'",
                status_code=400,
            )

        # 验证团队存在
        await self.get_team(team_id)

        # 验证用户存在
        user = await self.db.get(User, user_id)
        if not user:
            raise AppError(
                code=ErrorCodes.NOT_FOUND,
                message=f"User {user_id} not found",
                status_code=404,
            )

        # 检查是否已是成员
        existing = await self._get_member(team_id, user_id)
        if existing:
            raise AppError(
                code=ErrorCodes.TEAM_MEMBER_EXISTS,
                message=f"User {user_id} is already a member of team {team_id}",
                status_code=409,
            )

        # 添加成员
        member = TeamMember(
            team_id=team_id,
            user_id=user_id,
            role=role,
        )
        self.db.add(member)
        await self.db.commit()

        return {
            "team_id": team_id,
            "user_id": user_id,
            "role": role,
            "joined_at": str(member.joined_at),
        }

    async def remove_member(self, team_id: str, user_id: str) -> None:
        """移除成员"""
        member = await self._get_member(team_id, user_id)
        if not member:
            raise AppError(
                code=ErrorCodes.NOT_FOUND,
                message=f"User {user_id} is not a member of team {team_id}",
                status_code=404,
            )

        # 不能移除 owner
        if member.role == "owner":
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="Cannot remove the team owner",
                status_code=400,
            )

        await self.db.delete(member)
        await self.db.commit()

    async def update_member_role(
        self,
        team_id: str,
        user_id: str,
        role: str,
    ) -> dict:
        """更新成员角色"""
        # 验证角色值
        if role not in ("admin", "member"):
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message=f"Invalid role: {role}. Must be 'admin' or 'member'",
                status_code=400,
            )

        member = await self._get_member(team_id, user_id)
        if not member:
            raise AppError(
                code=ErrorCodes.NOT_FOUND,
                message=f"User {user_id} is not a member of team {team_id}",
                status_code=404,
            )

        # 不能将角色改为 owner
        if role == "owner":
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="Cannot assign owner role directly",
                status_code=400,
            )

        # 不能修改 owner 的角色
        if member.role == "owner":
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="Cannot change the owner's role",
                status_code=400,
            )

        member.role = role
        await self.db.commit()

        return {
            "team_id": team_id,
            "user_id": user_id,
            "role": role,
            "joined_at": str(member.joined_at),
        }

    async def list_members(self, team_id: str) -> list[dict]:
        """列出成员"""
        # 验证团队存在
        await self.get_team(team_id)

        result = await self.db.execute(
            select(TeamMember)
            .where(TeamMember.team_id == team_id)
            .order_by(TeamMember.role, TeamMember.joined_at)
        )
        members = result.scalars().all()

        return [
            {
                "team_id": str(m.team_id),
                "user_id": str(m.user_id),
                "role": m.role,
                "joined_at": str(m.joined_at),
            }
            for m in members
        ]

    async def _get_member(self, team_id: str, user_id: str) -> TeamMember | None:
        """获取成员"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def _check_admin_permission(self, team_id: str, user_id: str) -> None:
        """检查 admin 权限"""
        member = await self._get_member(team_id, user_id)
        if not member or member.role not in ("owner", "admin"):
            raise AppError(
                code=ErrorCodes.AUTH_FORBIDDEN,
                message="Admin permission required",
                status_code=403,
            )

    async def _check_owner_permission(self, team_id: str, user_id: str) -> None:
        """检查 owner 权限"""
        member = await self._get_member(team_id, user_id)
        if not member or member.role != "owner":
            raise AppError(
                code=ErrorCodes.AUTH_FORBIDDEN,
                message="Owner permission required",
                status_code=403,
            )

    async def is_member(self, team_id: str, user_id: str) -> bool:
        """检查用户是否为团队成员"""
        member = await self._get_member(team_id, user_id)
        return member is not None
