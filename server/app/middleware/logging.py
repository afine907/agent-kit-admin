"""日志中间件 - 记录请求和响应信息"""

import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("akit.access")


class LoggingMiddleware(BaseHTTPMiddleware):
    """记录 HTTP 请求日志"""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        # 处理请求
        response = await call_next(request)

        # 计算耗时
        duration = time.time() - start_time

        # 获取 request_id
        request_id = getattr(request.state, "request_id", "-")

        # 记录日志
        logger.info(
            "%s %s %d %.3fs [%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration,
            request_id,
        )

        return response
