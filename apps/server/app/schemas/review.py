"""评价 Pydantic Schemas"""

from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from uuid import UUID


class ReviewCreate(BaseModel):
    """创建评价请求"""

    rating: int = Field(..., ge=1, le=5, description="评分 1-5")
    comment: str | None = Field(None, max_length=2000, description="评价内容")
    version_id: UUID | None = None


class ReviewUpdate(BaseModel):
    """更新评价请求"""

    rating: int | None = Field(None, ge=1, le=5, description="评分 1-5")
    comment: str | None = Field(None, max_length=2000, description="评价内容")

    @model_validator(mode="after")
    def at_least_one_field(self) -> "ReviewUpdate":
        if self.rating is None and self.comment is None:
            raise ValueError("至少需要提供 rating 或 comment 之一")
        return self


class ReviewResponse(BaseModel):
    """评价响应"""

    id: UUID
    package_id: UUID
    user_id: UUID
    version_id: UUID | None = None
    rating: int
    comment: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewListResponse(BaseModel):
    """评价列表响应"""

    data: list[ReviewResponse]
    total: int
    pagination: dict
