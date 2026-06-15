"""API 限流中间件 - 滑动窗口算法

基于内存的滑动窗口限流，按 IP + 端点分组。

限制：
- 单实例场景，多实例部署请使用 Redis 替代。
- 内存中的时间戳列表会定期清理过期条目。

配置（对齐 docs/architecture/05-api-design.md）：
- /api/v1/auth        -> 10 req/min
- /api/v1/packages    -> 60 req/min
- /api/v1/packages/*/download -> 100 req/min
- /api/v1/packages/*/versions -> 10 req/min (publish)
- /api/v1/reviews     -> 5 req/min
"""

import asyncio
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("akit.rate_limit")

# 端点限流配置：prefix -> {requests, window_seconds}
# 按前缀长度降序排列，匹配时取最长前缀
RATE_LIMITS: dict[str, dict[str, int]] = {
    "/api/v1/packages/": {"requests": 100, "window": 60},  # download 等具体操作
    "/api/v1/auth": {"requests": 10, "window": 60},
    "/api/v1/packages": {"requests": 60, "window": 60},
    "/api/v1/reviews": {"requests": 5, "window": 60},
}

# 按前缀长度降序排序，确保最长匹配优先
_SORTED_PREFIXES = sorted(RATE_LIMITS.keys(), key=len, reverse=True)

# 不限流的路径
_EXEMPT_PATHS = {"/api/health", "/", "/docs", "/redoc", "/openapi.json"}


class SlidingWindowLimiter:
    """滑动窗口限流器

    使用 asyncio.Lock 保护共享状态，支持异步并发安全。
    """

    def __init__(self, limits: dict[str, dict[str, int]] | None = None):
        self.limits = limits or RATE_LIMITS
        self.store: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    def reset(self) -> None:
        """清空所有限流状态（用于测试）"""
        self.store.clear()

    def _match_endpoint(self, path: str) -> dict[str, int] | None:
        """匹配端点限流配置，取最长前缀"""
        for prefix in _SORTED_PREFIXES:
            if path.startswith(prefix):
                return self.limits[prefix]
        return None

    def _get_matched_prefix(self, path: str) -> str:
        """获取匹配到的前缀，用于限流 key"""
        for prefix in _SORTED_PREFIXES:
            if path.startswith(prefix):
                return prefix
        return path

    async def check(self, client_ip: str, path: str) -> tuple[bool, int]:
        """检查是否允许请求

        Returns:
            (allowed, retry_after): allowed=True 表示放行，
            retry_after 表示需要等待的秒数（仅当 allowed=False 时有意义）
        """
        if path in _EXEMPT_PATHS:
            return True, 0

        config = self._match_endpoint(path)
        if config is None:
            return True, 0

        max_requests = config["requests"]
        window = config["window"]
        # 使用匹配到的前缀而非完整 path，防止通过变换路径参数绕过限流
        matched_prefix = self._get_matched_prefix(path)
        key = f"{client_ip}::{matched_prefix}"
        now = time.time()
        cutoff = now - window

        async with self._lock:
            # 定期清理过期数据（每 100 次检查清理一次）
            self._cleanup_counter = getattr(self, '_cleanup_counter', 0) + 1
            if self._cleanup_counter >= 100:
                self._cleanup_counter = 0
                self._cleanup_expired(cutoff)

            timestamps = self.store.get(key, [])
            # 清除窗口外的旧时间戳
            valid_timestamps = [ts for ts in timestamps if ts > cutoff]

            if len(valid_timestamps) >= max_requests:
                # 计算 retry_after：最旧的有效时间戳 + 窗口 - 当前时间
                oldest = valid_timestamps[0]
                retry_after = min(window, max(1, int(oldest + window - now) + 1))
                self.store[key] = valid_timestamps
                return False, retry_after

            # 放行，记录时间戳
            valid_timestamps.append(now)
            self.store[key] = valid_timestamps
            return True, 0

    def _cleanup_expired(self, cutoff: float) -> None:
        """清理所有过期的时间戳数据"""
        keys_to_delete = []
        for key, timestamps in self.store.items():
            valid = [ts for ts in timestamps if ts > cutoff]
            if not valid:
                keys_to_delete.append(key)
            else:
                self.store[key] = valid
        for key in keys_to_delete:
            del self.store[key]


# 全局单例，供测试重置
_rate_limiter = SlidingWindowLimiter()


def _get_client_ip(request: Request) -> str:
    """获取客户端 IP

    优先使用 request.client.host（直接连接）。
    仅在配置了反向代理信任时才使用 X-Forwarded-For。
    """
    # 直接连接的 IP
    if request.client:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """API 限流中间件 - 滑动窗口算法"""

    def __init__(self, app, limiter: SlidingWindowLimiter | None = None):
        super().__init__(app)
        self.limiter = limiter or _rate_limiter

    async def dispatch(self, request: Request, call_next):
        client_ip = _get_client_ip(request)
        path = request.url.path

        allowed, retry_after = await self.limiter.check(client_ip, path)

        if not allowed:
            logger.warning(
                "Rate limit exceeded: ip=%s path=%s retry_after=%d",
                client_ip,
                path,
                retry_after,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": 20006,  # ErrorCodes.RATE_LIMIT
                        "message": f"Too many requests. Retry after {retry_after} seconds",
                        "details": {"retry_after": retry_after},
                    },
                    "request_id": getattr(request.state, "request_id", None),
                },
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        return response
