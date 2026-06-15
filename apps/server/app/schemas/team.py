"""团队管理 Pydantic Schemas"""

from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class TeamCreate(BaseModel):
    """创建团队请求"""

    name: str = Field(..., min_length=1, max_length=100, description="团队名称")
    slug: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z0-9][a-z0-9-]*$", description="URL 友好的标识")
    description: str | None = Field(None, max_length=1000, description="团队描述")


class TeamUpdate(BaseModel):
    """更新团队请求"""

    name: str | None = Field(None, min_length=1, max_length=100, description="团队名称")
    description: str | None = Field(None, max_length=1000, description="团队描述")
    avatar_url: str | None = Field(None, pattern=r"^https?://", description="头像 URL")


class TeamResponse(BaseModel):
    """团队响应"""

    id: UUID
    name: str
    slug: str
    description: str | None
    avatar_url: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TeamListResponse(BaseModel):
    """团队列表响应"""

    data: list[TeamResponse]
    pagination: dict


class MemberAdd(BaseModel):
    """添加成员请求"""

    user_id: UUID = Field(..., description="用户 ID")
    role: str = Field("member", pattern=r"^(admin|member)$", description="成员角色")


class MemberUpdateRole(BaseModel):
    """更新成员角色请求"""

    role: str = Field(..., pattern=r"^(admin|member)$", description="成员角色")


class MemberResponse(BaseModel):
    """成员响应"""

    team_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True
