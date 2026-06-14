"""FastAPI 依赖注入"""

import re

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.services.auth import UserSnapshot
from app.errors import AppError, ErrorCodes

# 严格匹配 Bearer token 格式：必须以 "Bearer " 开头，后面跟非空白字符
_BEARER_TOKEN_RE = re.compile(r"^Bearer\s+(\S+)$", re.IGNORECASE)

# 用户类型 - 支持 ORM 对象和缓存快照
UserType = User | UserSnapshot


# 角色层级定义
ROLE_HIERARCHY = {
    "member": 0,
    "admin": 1,
    "super_admin": 2,
}


async def get_current_user_optional(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> UserType | None:
    """可选的用户认证 - 不强制要求登录

    - 无 Authorization header: 返回 None (匿名)
    - 有 Authorization header 但 token 无效: 返回 401 (明确拒绝)
    """
    if not authorization:
        return None

    match = _BEARER_TOKEN_RE.match(authorization)
    if not match:
        raise AppError(code=ErrorCodes.AUTH_INVALID_TOKEN, message="Invalid Authorization format", status_code=401)
    token = match.group(1)

    # API Key 认证 (Phase 2 实现)
    if token.startswith("akit_"):
        raise AppError(
            code=ErrorCodes.AUTH_REQUIRED, message="API Key authentication not yet implemented", status_code=401
        )

    # JWT 认证
    from app.services.auth import AuthService

    auth_service = AuthService(db)
    user = await auth_service.verify_token(token)
    if not user:
        raise AppError(code=ErrorCodes.AUTH_INVALID_TOKEN, message="Invalid or expired token", status_code=401)
    return user


async def get_current_user(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> UserType:
    """强制用户认证 - 必须登录"""
    if not authorization:
        raise AppError(code=ErrorCodes.AUTH_REQUIRED, message="No authentication provided", status_code=401)

    match = _BEARER_TOKEN_RE.match(authorization)
    if not match:
        raise AppError(code=ErrorCodes.AUTH_INVALID_TOKEN, message="Invalid Authorization format", status_code=401)
    token = match.group(1)

    # API Key 认证 (Phase 2 实现)
    if token.startswith("akit_"):
        raise AppError(
            code=ErrorCodes.AUTH_REQUIRED, message="API Key authentication not yet implemented", status_code=401
        )

    # JWT 认证
    from app.services.auth import AuthService

    auth_service = AuthService(db)
    user = await auth_service.verify_token(token)
    if not user:
        raise AppError(code=ErrorCodes.AUTH_INVALID_TOKEN, message="Invalid or expired token", status_code=401)
    return user


async def get_current_user_with_token(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> tuple[UserType, str]:
    """获取当前用户和原始 token - 用于需要 token 操作的场景（如登出）"""
    if not authorization:
        raise AppError(code=ErrorCodes.AUTH_REQUIRED, message="No authentication provided", status_code=401)

    match = _BEARER_TOKEN_RE.match(authorization)
    if not match:
        raise AppError(code=ErrorCodes.AUTH_INVALID_TOKEN, message="Invalid Authorization format", status_code=401)
    token = match.group(1)

    # JWT 认证
    from app.services.auth import AuthService

    auth_service = AuthService(db)
    user = await auth_service.verify_token(token)
    if not user:
        raise AppError(code=ErrorCodes.AUTH_INVALID_TOKEN, message="Invalid or expired token", status_code=401)
    return user, token


async def require_admin(
    user: UserType = Depends(get_current_user),
) -> UserType:
    """要求管理员权限（admin 或 super_admin）"""
    if user.role not in ("admin", "super_admin"):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="Admin access required",
            status_code=403,
        )
    return user


async def require_super_admin(
    user: UserType = Depends(get_current_user),
) -> UserType:
    """要求超级管理员权限"""
    if user.role != "super_admin":
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="Super admin access required",
            status_code=403,
        )
    return user
