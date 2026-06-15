"""统一错误处理"""

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.requests import Request


class AppError(HTTPException):
    """应用层统一错误"""

    def __init__(self, code: int, message: str, status_code: int = 400, details: dict | None = None):
        self.error_code = code
        self.error_message = message
        self.error_details = details or {}
        super().__init__(status_code=status_code, detail=message)


# 错误码定义 (对齐设计文档 05-api-design.md)
class ErrorCodes:
    # 通用错误
    SUCCESS = 10000
    UNKNOWN = 30000
    INVALID_PARAM = 20000
    NOT_FOUND = 20003
    RATE_LIMIT = 20006

    # 认证错误
    AUTH_REQUIRED = 20001
    AUTH_INVALID_TOKEN = 20001  # Token 无效或过期统一用 20001
    AUTH_EXPIRED_TOKEN = 20001
    AUTH_OAUTH_FAILED = 20001
    AUTH_FORBIDDEN = 20002

    # 用户错误
    USER_ALREADY_EXISTS = 20004  # 用户名或邮箱冲突
    USER_SUSPENDED = 20002  # 账号已停用
    USER_BANNED = 20002  # 账号已封禁

    # 包错误
    PACKAGE_NOT_FOUND = 20003
    PACKAGE_ALREADY_EXISTS = 20004
    PACKAGE_DELETED = 20005
    PACKAGE_NAME_RESERVED = 20004  # 包名冲突也用 20004
    PACKAGE_INVALID_MANIFEST = 20000

    # 版本错误
    VERSION_NOT_FOUND = 20003
    VERSION_ALREADY_EXISTS = 20004
    VERSION_INVALID_SEMVER = 20000
    VERSION_CONTENT_TOO_LARGE = 20000

    # 存储错误
    STORAGE_UPLOAD_FAILED = 30002
    STORAGE_DOWNLOAD_FAILED = 30002
    STORAGE_INTEGRITY_ERROR = 30000
    STORAGE_DELETE_FAILED = 30000

    # 团队错误
    TEAM_NOT_FOUND = 20003
    TEAM_SLUG_EXISTS = 20004
    TEAM_MEMBER_EXISTS = 20004
    TEAM_PERMISSION_DENIED = 20002


def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """全局 AppError 异常处理器"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.error_message,
                "details": exc.error_details,
            },
            "request_id": getattr(request.state, "request_id", None),
        },
    )
