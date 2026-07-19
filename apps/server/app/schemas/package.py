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
    owner_type: str = Field("user", pattern=r"^(user|team)$")
    category: str | None = Field(None, max_length=50)


class PackageUpdate(BaseModel):
    """编辑包请求 - 所有字段可选"""

    description: str | None = Field(None, max_length=500)
    license: str | None = None
    repository: str | None = None
    homepage: str | None = None
    tags: list[str] | None = None
    category: str | None = Field(None, max_length=50)
    visibility: str | None = Field(None, pattern=r"^(public|team|private)$")


class DependencyCheckRequest(BaseModel):
    """依赖检查请求"""

    # 扁平依赖列表 {包名: 版本约束}
    dependencies: dict[str, str] = Field(default_factory=dict, description="依赖列表 {包名: 版本约束}")
    # 可选：嵌套依赖图 {包名: [其依赖列表]}，用于循环检测
    dependency_graph: dict[str, list[str]] | None = Field(default=None, description="依赖图 {包名: [依赖包列表]}")


class DependencyCheckResult(BaseModel):
    """单个依赖检查结果"""

    name: str
    constraint: str
    exists: bool
    latest_version: str | None = None
    constraint_satisfied: bool | None = None


class DependencyCheckResponse(BaseModel):
    """依赖检查响应"""

    all_exist: bool
    results: list[DependencyCheckResult]
    circular_error: str | None = None


class PackageResponse(BaseModel):
    """包响应"""

    id: UUID
    name: str
    scope: str
    full_name: str
    type: str
    owner_type: str
    owner_id: UUID
    description: str | None
    license: str
    repository: str | None
    homepage: str | None
    visibility: str
    downloads_count: int
    latest_version: str | None
    tags: list[str]
    category: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PackageTransferRequest(BaseModel):
    """转移包所有权请求"""

    new_owner_type: str = Field(..., pattern=r"^(user|team)$")
    new_owner_id: str = Field(..., description="新 owner 的用户 ID 或团队 ID")
    new_scope: str = Field(..., min_length=2, max_length=50, pattern=r"^@[a-z0-9][a-z0-9_-]*$")


class BatchPackageRequest(BaseModel):
    """批量操作请求"""

    packages: list[str] = Field(..., min_length=1, description="包名列表，如 @scope/name")


class BatchDeprecateRequest(BaseModel):
    """批量废弃请求"""

    packages: list[str] = Field(..., min_length=1)
    deprecated: bool = Field(..., description="true=废弃，false=取消废弃")


class BatchResultItem(BaseModel):
    """单个包的批量操作结果"""

    name: str
    error: str | None = None


class BatchResultResponse(BaseModel):
    """批量操作结果"""

    success: list[str]
    failed: list[BatchResultItem]


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
    deprecation_reason: str | None = None
    yanked: bool
    published_at: datetime

    class Config:
        from_attributes = True


class VersionListResponse(BaseModel):
    """版本列表响应"""

    data: list[VersionResponse]
    total: int


class TagInfo(BaseModel):
    """标签信息"""

    tag: str
    count: int


class TagListResponse(BaseModel):
    """标签列表响应"""

    tags: list[TagInfo]


class DeprecateRequest(BaseModel):
    """废弃包请求"""

    reason: str = Field(..., min_length=1, max_length=500)
    version: str | None = Field(None, description="指定版本，不指定则废弃所有版本")


class UndeprecateRequest(BaseModel):
    """取消废弃包请求"""

    version: str | None = Field(None, description="指定版本，不指定则取消所有版本的废弃")


class DependencyGraphResponse(BaseModel):
    """依赖图响应"""

    dependencies: dict[str, dict]  # {pkg: {version, deps: {...}}}
    cycles: list[list[str]]  # 检测到的循环列表
