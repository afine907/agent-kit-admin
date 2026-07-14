"""团队管理服务"""

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.team import Team, TeamMember, TeamInvite, PendingOwnershipTransfer, TeamSettings
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

    async def leave_team(self, team_id: str, user_id: str) -> None:
        """退出团队（成员自行移除）"""
        member = await self._get_member(team_id, user_id)
        if not member:
            raise AppError(
                code=ErrorCodes.NOT_FOUND,
                message=f"You are not a member of team {team_id}",
                status_code=404,
            )

        # Owner 不能退出团队
        if member.role == "owner":
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="Owner cannot leave team. Transfer ownership or delete the team.",
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
            select(TeamMember).where(TeamMember.team_id == team_id).order_by(TeamMember.role, TeamMember.joined_at)
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

    async def _is_team_admin(self, team_id: str, user_id: str) -> bool:
        """检查用户是否是团队 admin/owner"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
                TeamMember.role.in_(["owner", "admin"]),
            )
        )
        return result.scalar_one_or_none() is not None

    async def _is_team_member(self, team_id: str, user_id: str) -> bool:
        """检查用户是否是团队成员"""
        return await self.is_member(team_id, user_id)

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

    # ========================================================================
    # Invite Flow (Task 1)
    # ========================================================================

    def _generate_token(self) -> str:
        """生成安全的随机邀请码"""
        return secrets.token_urlsafe(8)[:16]

    async def generate_invite(
        self,
        team_id: str,
        user_id: str,
        expires_hours: int = 72,
        max_uses: int = 1,
    ) -> dict:
        """生成团队邀请码"""
        # 验证团队存在
        await self.get_team(team_id)
        # 验证 admin+ 权限
        await self._check_admin_permission(team_id, user_id)

        token = self._generate_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)

        invite = TeamInvite(
            team_id=team_id,
            token=token,
            created_by=user_id,
            expires_at=expires_at,
            max_uses=max_uses,
            use_count=0,
        )
        self.db.add(invite)
        await self.db.commit()

        invite_url = f"/teams/join?token={token}"
        return {
            "token": token,
            "expires_at": expires_at,
            "max_uses": max_uses,
            "use_count": 0,
            "invite_url": invite_url,
        }

    async def list_invites(self, team_id: str, user_id: str) -> list[dict]:
        """列出团队有效邀请"""
        await self._check_admin_permission(team_id, user_id)
        result = await self.db.execute(
            select(TeamInvite)
            .where(
                TeamInvite.team_id == team_id,
                TeamInvite.expires_at > datetime.now(timezone.utc),
                TeamInvite.use_count < TeamInvite.max_uses,
            )
            .order_by(TeamInvite.created_at.desc())
        )
        invites = result.scalars().all()
        return [
            {
                "token": i.token,
                "created_by": str(i.created_by),
                "expires_at": i.expires_at,
                "max_uses": i.max_uses,
                "use_count": i.use_count,
                "created_at": i.created_at,
            }
            for i in invites
        ]

    async def revoke_invite(self, team_id: str, token: str, user_id: str) -> None:
        """撤销邀请（admin+）"""
        await self._check_admin_permission(team_id, user_id)
        result = await self.db.execute(
            select(TeamInvite).where(TeamInvite.team_id == team_id, TeamInvite.token == token)
        )
        invite = result.scalar_one_or_none()
        if not invite:
            raise AppError(code=ErrorCodes.NOT_FOUND, message="Invite not found", status_code=404)
        await self.db.delete(invite)
        await self.db.commit()

    async def accept_invite(self, token: str, user_id: str) -> dict:
        """接受邀请加入团队"""
        result = await self.db.execute(select(TeamInvite).where(TeamInvite.token == token))
        invite = result.scalar_one_or_none()

        if not invite:
            raise AppError(code=ErrorCodes.NOT_FOUND, message="Invalid invite token", status_code=404)

        if invite.expires_at < datetime.now(timezone.utc):
            raise AppError(code=ErrorCodes.INVALID_PARAM, message="Invite token has expired", status_code=400)

        if invite.use_count >= invite.max_uses:
            raise AppError(code=ErrorCodes.INVALID_PARAM, message="Invite token has been fully used", status_code=400)

        # 检查用户是否已是成员
        existing = await self._get_member(str(invite.team_id), user_id)
        if existing:
            raise AppError(
                code=ErrorCodes.TEAM_MEMBER_EXISTS,
                message="You are already a member of this team",
                status_code=409,
            )

        # 增加使用计数
        invite.use_count += 1
        # 添加为成员
        member = TeamMember(team_id=invite.team_id, user_id=user_id, role="member")
        self.db.add(member)
        await self.db.commit()

        return {
            "team_id": str(invite.team_id),
            "user_id": user_id,
            "role": "member",
            "message": "Successfully joined the team",
        }

    # ========================================================================
    # RBAC (Task 2)
    # ========================================================================

    async def change_member_role(
        self,
        team_id: str,
        target_user_id: str,
        new_role: str,
        actor_user_id: str,
    ) -> dict:
        """变更成员角色（需 owner）"""
        await self._check_owner_permission(team_id, actor_user_id)

        member = await self._get_member(team_id, target_user_id)
        if not member:
            raise AppError(code=ErrorCodes.NOT_FOUND, message="Member not found", status_code=404)

        if member.role == "owner":
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="Cannot change owner's role. Use transfer ownership.",
                status_code=400,
            )

        if new_role == "owner":
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="Cannot assign owner role directly. Use transfer ownership.",
                status_code=400,
            )

        old_role = member.role
        member.role = new_role
        await self.db.commit()

        return {
            "team_id": team_id,
            "user_id": target_user_id,
            "old_role": old_role,
            "new_role": new_role,
        }

    async def initiate_ownership_transfer(
        self,
        team_id: str,
        from_user_id: str,
        to_user_id: str,
    ) -> dict:
        """发起所有权转让（需 owner）"""
        await self._check_owner_permission(team_id, from_user_id)

        # 验证目标用户存在且是 admin
        target = await self._get_member(team_id, to_user_id)
        if not target:
            raise AppError(code=ErrorCodes.NOT_FOUND, message="Target user is not a team member", status_code=404)
        if target.role not in ("admin",):
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="Ownership can only be transferred to an admin",
                status_code=400,
            )

        # 删除已有的待处理转让
        await self.db.execute(
            delete(PendingOwnershipTransfer).where(PendingOwnershipTransfer.team_id == team_id)
        )

        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        transfer = PendingOwnershipTransfer(
            team_id=team_id,
            from_owner_id=from_user_id,
            to_user_id=to_user_id,
            expires_at=expires_at,
        )
        self.db.add(transfer)
        await self.db.commit()

        return {
            "message": "Ownership transfer initiated. Target admin has 24h to accept.",
            "expires_at": expires_at,
        }

    async def accept_ownership_transfer(self, team_id: str, user_id: str) -> dict:
        """接受所有权转让"""
        result = await self.db.execute(
            select(PendingOwnershipTransfer).where(PendingOwnershipTransfer.team_id == team_id)
        )
        transfer = result.scalar_one_or_none()

        if not transfer:
            raise AppError(code=ErrorCodes.NOT_FOUND, message="No pending ownership transfer", status_code=404)

        if transfer.to_user_id != user_id:
            raise AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not authorized to accept this transfer", status_code=403)

        if transfer.expires_at < datetime.now(timezone.utc):
            raise AppError(code=ErrorCodes.INVALID_PARAM, message="Ownership transfer has expired", status_code=400)

        # 执行转让
        old_owner_member = await self._get_member(team_id, str(transfer.from_owner_id))
        new_owner_member = await self._get_member(team_id, str(transfer.to_user_id))

        if old_owner_member:
            old_owner_member.role = "member"
        if new_owner_member:
            new_owner_member.role = "owner"

        await self.db.delete(transfer)
        await self.db.commit()

        return {
            "message": "Ownership transferred successfully",
            "new_owner_id": str(transfer.to_user_id),
            "old_owner_id": str(transfer.from_owner_id),
        }

    async def cancel_ownership_transfer(self, team_id: str, user_id: str) -> None:
        """取消待处理的转让"""
        await self._check_owner_permission(team_id, user_id)
        await self.db.execute(
            delete(PendingOwnershipTransfer).where(PendingOwnershipTransfer.team_id == team_id)
        )
        await self.db.commit()

    # ========================================================================
    # Team Settings (Task 3)
    # ========================================================================

    async def get_settings(self, team_id: str) -> TeamSettings:
        """获取团队设置（不存在则创建默认设置）"""
        result = await self.db.execute(select(TeamSettings).where(TeamSettings.team_id == team_id))
        settings = result.scalar_one_or_none()

        if not settings:
            settings = TeamSettings(team_id=team_id, default_visibility="team")
            self.db.add(settings)
            await self.db.commit()
            await self.db.refresh(settings)

        return settings

    async def update_settings(
        self,
        team_id: str,
        user_id: str,
        updates: dict,
    ) -> TeamSettings:
        """更新团队设置（需 admin+）"""
        await self._check_admin_permission(team_id, user_id)

        settings = await self.get_settings(team_id)

        if "avatar_url" in updates and updates["avatar_url"] is not None:
            settings.avatar_url = updates["avatar_url"]
        if "default_visibility" in updates and updates["default_visibility"] is not None:
            if updates["default_visibility"] not in ("public", "private", "team"):
                raise AppError(
                    code=ErrorCodes.INVALID_PARAM,
                    message="default_visibility must be one of: public, private, team",
                    status_code=400,
                )
            settings.default_visibility = updates["default_visibility"]
        if "website" in updates:
            settings.website = updates["website"]

        await self.db.commit()
        await self.db.refresh(settings)
        return settings
