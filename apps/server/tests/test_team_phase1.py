"""Phase 1 团队邀请、RBAC、设置、可见性测试"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from app.errors import AppError, ErrorCodes


class FakeTeam:
    def __init__(self, id="team-1", name="Test Team", slug="test-team"):
        self.id = id
        self.name = name
        self.slug = slug
        self.description = "Test description"
        self.owner_id = "user-owner"
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)


class FakeTeamMember:
    def __init__(self, user_id, role="member"):
        self.user_id = user_id
        self.role = role


class FakeAsyncMock(MagicMock):
    """支持 async 方法的 MagicMock"""

    async def __call__(self, *args, **kwargs):
        return super().__call__(*args, **kwargs)


def make_execute_result(scalar_value):
    """构建一个 db.execute() 返回的 mock，支持 scalar_one_or_none()"""
    m = MagicMock()
    m.scalar_one_or_none.return_value = scalar_value
    return m


# =============================================================================
# Task 1: 邀请流程
# =============================================================================


class TestInviteFlow:
    def test_generate_token_alphanumeric(self):
        """邀请码是字母数字混合"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        service = TeamService(mock_db)
        token = service._generate_token()
        assert token.isalnum(), f"Token '{token}' should be alphanumeric"

    def test_generate_token_urlsafe(self):
        """邀请码是 URL 安全的"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        service = TeamService(mock_db)
        token = service._generate_token()
        assert "+" not in token and "/" not in token and "=" not in token

    @pytest.mark.asyncio
    async def test_generate_invite_requires_admin(self):
        """非 admin 无权生成邀请"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        service = TeamService(mock_db)

        service.get_team = FakeAsyncMock(return_value=FakeTeam())
        service._check_admin_permission = FakeAsyncMock(
            side_effect=AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not admin", status_code=403)
        )

        with pytest.raises(AppError) as exc_info:
            await service.generate_invite("team-1", "user-1")
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_accept_invite_invalid_token(self):
        """无效 token 返回 404"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        mock_db.execute = FakeAsyncMock(return_value=make_execute_result(None))
        service = TeamService(mock_db)

        with pytest.raises(AppError) as exc_info:
            await service.accept_invite("invalid-token", "user-1")
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_accept_invite_expired(self):
        """过期 token 返回 400"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        expired_invite = MagicMock()
        expired_invite.token = "valid-token"
        expired_invite.team_id = "team-1"
        expired_invite.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        expired_invite.max_uses = 1
        expired_invite.use_count = 0

        mock_db.execute = FakeAsyncMock(return_value=make_execute_result(expired_invite))
        service = TeamService(mock_db)

        with pytest.raises(AppError) as exc_info:
            await service.accept_invite("valid-token", "user-1")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_accept_invite_already_member(self):
        """已是成员返回 409"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        valid_invite = MagicMock()
        valid_invite.token = "valid-token"
        valid_invite.team_id = "team-1"
        valid_invite.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        valid_invite.max_uses = 1
        valid_invite.use_count = 0

        mock_db.execute = FakeAsyncMock(return_value=make_execute_result(valid_invite))
        service = TeamService(mock_db)
        service._get_member = FakeAsyncMock(return_value=FakeTeamMember("user-1", "member"))

        with pytest.raises(AppError) as exc_info:
            await service.accept_invite("valid-token", "user-1")
        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_accept_invite_max_uses_reached(self):
        """邀请次用尽返回 400"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        used_invite = MagicMock()
        used_invite.token = "valid-token"
        used_invite.team_id = "team-1"
        used_invite.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        used_invite.max_uses = 1
        used_invite.use_count = 1

        mock_db.execute = FakeAsyncMock(return_value=make_execute_result(used_invite))
        service = TeamService(mock_db)

        with pytest.raises(AppError) as exc_info:
            await service.accept_invite("valid-token", "user-1")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_revoke_invite_not_found(self):
        """撤销不存在的邀请返回 404"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        mock_db.execute = FakeAsyncMock(return_value=make_execute_result(None))
        service = TeamService(mock_db)
        service._check_admin_permission = FakeAsyncMock()

        with pytest.raises(AppError) as exc_info:
            await service.revoke_invite("team-1", "nonexistent-token", "user-1")
        assert exc_info.value.status_code == 404


# =============================================================================
# Task 2: RBAC
# =============================================================================


class TestRBAC:
    @pytest.mark.asyncio
    async def test_change_member_role_requires_owner(self):
        """非 owner 无权变更角色"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        service = TeamService(mock_db)
        service._check_owner_permission = FakeAsyncMock(
            side_effect=AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not owner", status_code=403)
        )

        with pytest.raises(AppError) as exc_info:
            await service.change_member_role("team-1", "user-2", "admin", "user-1")
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_change_owner_role_forbidden(self):
        """不能变更 owner 角色"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        service = TeamService(mock_db)
        service._check_owner_permission = FakeAsyncMock()
        service._get_member = FakeAsyncMock(return_value=FakeTeamMember("user-2", "owner"))

        with pytest.raises(AppError) as exc_info:
            await service.change_member_role("team-1", "user-2", "admin", "user-owner")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_transfer_ownership_target_must_be_admin(self):
        """转让目标必须是 admin"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        service = TeamService(mock_db)
        service._check_owner_permission = FakeAsyncMock()
        service._get_member = FakeAsyncMock(return_value=FakeTeamMember("user-2", "member"))

        with pytest.raises(AppError) as exc_info:
            await service.initiate_ownership_transfer("team-1", "user-owner", "user-2")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_accept_ownership_wrong_user_forbidden(self):
        """非指定用户不能接受转让"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        pending = MagicMock()
        pending.team_id = "team-1"
        pending.from_owner_id = "user-owner"
        pending.to_user_id = "user-admin"
        pending.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        mock_db.execute = FakeAsyncMock(return_value=make_execute_result(pending))
        service = TeamService(mock_db)

        with pytest.raises(AppError) as exc_info:
            await service.accept_ownership_transfer("team-1", "user-other")
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_accept_ownership_expired(self):
        """过期的转让不能接受"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        pending = MagicMock()
        pending.team_id = "team-1"
        pending.from_owner_id = "user-owner"
        pending.to_user_id = "user-admin"
        pending.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)

        mock_db.execute = FakeAsyncMock(return_value=make_execute_result(pending))
        service = TeamService(mock_db)

        with pytest.raises(AppError) as exc_info:
            await service.accept_ownership_transfer("team-1", "user-admin")
        assert exc_info.value.status_code == 400


# =============================================================================
# Task 3: 团队设置
# =============================================================================


class TestTeamSettings:
    @pytest.mark.asyncio
    async def test_update_settings_requires_admin(self):
        """非 admin 无权更新设置"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        service = TeamService(mock_db)
        service._check_admin_permission = FakeAsyncMock(
            side_effect=AppError(code=ErrorCodes.AUTH_FORBIDDEN, message="Not admin", status_code=403)
        )

        with pytest.raises(AppError) as exc_info:
            await service.update_settings("team-1", "user-1", {"default_visibility": "private"})
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_settings_invalid_visibility(self):
        """无效 visibility 值"""
        from app.services.team import TeamService

        mock_db = MagicMock()
        service = TeamService(mock_db)
        service._check_admin_permission = FakeAsyncMock()

        mock_settings = MagicMock()
        mock_settings.default_visibility = "team"
        mock_settings.website = None
        mock_settings.avatar_url = None
        service.get_settings = FakeAsyncMock(return_value=mock_settings)

        with pytest.raises(AppError) as exc_info:
            await service.update_settings("team-1", "user-1", {"default_visibility": "invalid"})
        assert exc_info.value.status_code == 400


# =============================================================================
# Task 4: 可见性强制
# =============================================================================


class TestVisibilityEnforcement:
    @pytest.mark.asyncio
    async def test_team_only_package_hidden_from_non_member(self):
        """team_only 包对非成员返回 404"""
        from app.services.team_package import TeamPackageService

        mock_db = MagicMock()
        service = TeamPackageService(mock_db)
        service._get_package = FakeAsyncMock(return_value=None)

        with pytest.raises(AppError) as exc_info:
            await service.get_package("team-1", "pkg-1", "user-outsider")
        assert exc_info.value.status_code == 404
        assert exc_info.value.code == ErrorCodes.PACKAGE_NOT_FOUND
