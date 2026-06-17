"""包管理 Pydantic Schemas"""

from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class PackageCreate(BaseModel):
    """创建包请求"""

    name: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
    scope: str = Field(..., min_length=2, max_length=50, pattern=r"^@[a-z0-9][a-z0-9-]*$")
    type: str = Field(..., pattern=r"^(mcp|skill)$")
    description: str | None = Field(None, max_length=500)
    license: str = "MIT"
    repository: str | None = None
    homepage: str | None = None
    visibility: str = Field("public", pattern=r"^(public|team|private)$")


class PackageUpdate(BaseModel):
    """编辑包请求 - 所有字段可选"""

    description: str | None = Field(None, max_length=500)
    license: str | None = None
    repository: str | None = None
    homepage: str | None = None
    tags: list[str] | None = None
    visibility: str | None = Field(None, pattern=r"^(public|team|private)$")


class DependencyCheckRequest(BaseModel):
    """依赖检查请求"""

    dependencies: dict[str, str] = Field(default_factory=dict, description="依赖列表 {包名: 版本约束}")


class DependencyCheckResult(BaseModel):
    """单个依赖检查结果"""

    name: str
    constraint: str
    exists: bool
    latest_version: str | None = None


class DependencyCheckResponse(BaseModel):
    """依赖检查响应"""

    all_exist: bool
    results: list[DependencyCheckResult]


class PackageResponse(BaseModel):
    """包响应"""

    id: UUID
    name: str
    scope: str
    full_name: str
    type: str
    description: str | None
    license: str
    repository: str | None
    homepage: str | None
    visibility: str
    downloads_count: int
    latest_version: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PackageListResponse(BaseModel):
    """包列表响应"""

    data: list[PackageResponse]
    pagination: dict


class VersionResponse(BaseModel):
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


class VersionListResponse(BaseModel):
    """版本列表响应"""

    data: list[VersionResponse]
    total: int
