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


# 错误码定义
class ErrorCodes:
    # 通用错误 (1xxx)
    UNKNOWN = 10001
    INVALID_PARAM = 10002
    NOT_FOUND = 10003
    RATE_LIMIT = 10004

    # 认证错误 (2xxx)
    AUTH_REQUIRED = 20001
    AUTH_INVALID_TOKEN = 20002
    AUTH_EXPIRED_TOKEN = 20003
    AUTH_OAUTH_FAILED = 20004
    AUTH_FORBIDDEN = 20005  # 无权限访问

    # 包错误 (3xxx)
    PACKAGE_NOT_FOUND = 30001
    PACKAGE_ALREADY_EXISTS = 30002
    PACKAGE_DELETED = 30003
    PACKAGE_NAME_RESERVED = 30004
    PACKAGE_INVALID_MANIFEST = 30005

    # 版本错误 (4xxx)
    VERSION_NOT_FOUND = 40001
    VERSION_ALREADY_EXISTS = 40002
    VERSION_INVALID_SEMVER = 40003
    VERSION_CONTENT_TOO_LARGE = 40004

    # 存储错误 (5xxx)
    STORAGE_UPLOAD_FAILED = 50001
    STORAGE_DOWNLOAD_FAILED = 50002
    STORAGE_INTEGRITY_ERROR = 50003
    STORAGE_DELETE_FAILED = 50004


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
