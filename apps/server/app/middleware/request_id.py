"""Request ID 中间件 - 为每个请求生成唯一标识"""

import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """为每个请求添加唯一 request_id"""

    async def dispatch(self, request: Request, call_next) -> Response:
        # 从 header 获取或生成新的 request_id
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        # 处理请求
        response = await call_next(request)

        # 在响应头中返回 request_id
        response.headers["X-Request-ID"] = request_id
        return response
