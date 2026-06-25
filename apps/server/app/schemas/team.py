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


# =============================================================================
# 团队包相关 schemas（基于 docs/specs/team-skill-management.md）
# =============================================================================


class TeamPackagePublish(BaseModel):
    """发布团队包请求"""

    name: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
    type: str = Field(..., pattern=r"^(mcp|skill)$")
    description: str | None = Field(None, max_length=500)
    visibility: str = Field("team", pattern=r"^(public|team|private)$")
    owner_type: str = Field("team", pattern=r"^(user|team)$")
    manifest: dict | None = Field(None, description="包清单")
    tarball: str | None = Field(None, description="base64 编码的 tarball")


class TeamPackageVersionPublish(BaseModel):
    """发布新版本请求"""

    version: str = Field(..., pattern=r"^v?\d+\.\d+\.\d+$")
    manifest: dict | None = None
    tarball: str | None = None


class TeamPackageResponse(BaseModel):
    """团队包响应（含安装状态）"""

    id: UUID
    name: str
    scope: str
    full_name: str
    type: str
    description: str | None
    visibility: str
    owner_type: str
    downloads_count: int
    latest_version: str | None
    created_at: datetime
    updated_at: datetime
    # 安装状态字段
    my_installed_version: str | None = None
    has_update: bool = False

    class Config:
        from_attributes = True


class TeamPackageVersionResponse(BaseModel):
    """版本响应"""

    id: UUID
    version: str
    manifest: dict
    tarball_hash: str
    tarball_size: int
    tag: str | None
    deprecated: bool
    yanked: bool
    published_at: datetime

    class Config:
        from_attributes = True


class TeamPackageVersionListResponse(BaseModel):
    """版本列表响应"""

    data: list[TeamPackageVersionResponse]
    total: int


class InstalledPackageResponse(BaseModel):
    """已安装包响应"""

    package_id: UUID
    version_installed: str
    installed_at: datetime
    # 包信息
    package_name: str | None = None
    package_scope: str | None = None
    package_type: str | None = None
    latest_version: str | None = None
    has_update: bool = False

    class Config:
        from_attributes = True


class InstalledPackageListResponse(BaseModel):
    """已安装包列表响应"""

    data: list[InstalledPackageResponse]
    total: int
