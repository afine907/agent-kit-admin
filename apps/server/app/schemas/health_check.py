"""健康检测请求/响应模型"""

from pydantic import BaseModel
from datetime import datetime


class DimensionResult(BaseModel):
    """单维度结果"""

    status: str
    detail: dict


class HealthCheckResponse(BaseModel):
    """检测结果响应"""

    overall: str
    compliance: DimensionResult
    content: DimensionResult
    functional: DimensionResult
    freshness: DimensionResult
    checked_at: datetime | None = None
    trigger: str | None = None


class HealthOverviewResponse(BaseModel):
    """平台健康概览"""

    total: int
    healthy: int
    degraded: int
    error: int
    pending: int
    last_run_at: datetime | None = None
