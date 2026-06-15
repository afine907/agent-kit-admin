"""团队管理 API 路由"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.team import TeamService
from app.api.deps import get_current_user, UserType
from app.errors import AppError, ErrorCodes
from app.schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    MemberAdd,
    MemberUpdateRole,
)

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("", response_model=TeamResponse, status_code=201)
async def create_team(
    data: TeamCreate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建团队"""
    service = TeamService(db)
    team = await service.create_team(
        owner_id=str(current_user.id),
        name=data.name,
        slug=data.slug,
        description=data.description,
    )
    return team


@router.get("")
async def list_teams(
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出我的团队"""
    service = TeamService(db)
    teams = await service.list_teams(str(current_user.id))
    return teams


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取团队详情（需为团队成员）"""
    service = TeamService(db)
    # 权限检查：必须是团队成员才能查看详情
    if not await service.is_member(team_id, str(current_user.id)):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="You must be a team member to view team details",
            status_code=403,
        )
    team = await service.get_team(team_id)
    return team


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    data: TeamUpdate,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新团队"""
    service = TeamService(db)
    team = await service.update_team(
        team_id=team_id,
        user_id=str(current_user.id),
        data=data.model_dump(exclude_unset=True),
    )
    return team


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除团队"""
    service = TeamService(db)
    await service.delete_team(team_id, str(current_user.id))


@router.get("/{team_id}/members")
async def list_members(
    team_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出成员（需为团队成员）"""
    service = TeamService(db)
    # 权限检查：必须是团队成员才能查看成员列表
    if not await service.is_member(team_id, str(current_user.id)):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="You must be a team member to view member list",
            status_code=403,
        )
    members = await service.list_members(team_id)
    return members


@router.post("/{team_id}/members", status_code=201)
async def add_member(
    team_id: str,
    data: MemberAdd,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """添加成员（需 admin/owner 权限）"""
    service = TeamService(db)
    # 权限检查：需要 admin 或 owner 权限
    await service._check_admin_permission(team_id, str(current_user.id))
    member = await service.add_member(
        team_id=team_id,
        user_id=str(data.user_id),
        role=data.role,
    )
    return member


@router.delete("/{team_id}/members/{user_id}", status_code=204)
async def remove_member(
    team_id: str,
    user_id: str,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """移除成员（需 admin/owner 权限，且不能移除自己）"""
    service = TeamService(db)
    # 权限检查：需要 admin 或 owner 权限
    await service._check_admin_permission(team_id, str(current_user.id))
    # 不能移除自己（应该用退出团队接口）
    if user_id == str(current_user.id):
        raise AppError(
            code=ErrorCodes.INVALID_PARAM,
            message="Cannot remove yourself, use leave team instead",
            status_code=400,
        )
    await service.remove_member(team_id, user_id)


@router.put("/{team_id}/members/{user_id}")
async def update_member_role(
    team_id: str,
    user_id: str,
    data: MemberUpdateRole,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新成员角色（需 owner 权限）"""
    service = TeamService(db)
    # 权限检查：需要 owner 权限
    await service._check_owner_permission(team_id, str(current_user.id))
    member = await service.update_member_role(
        team_id=team_id,
        user_id=user_id,
        role=data.role,
    )
    return member
