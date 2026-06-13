"""FastAPI 依赖注入"""

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.errors import AppError, ErrorCodes


async def get_current_user_optional(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """可选的用户认证 - 不强制要求登录

    - 无 Authorization header: 返回 None (匿名)
    - 有 Authorization header 但 token 无效: 返回 401 (明确拒绝)
    """
    if not authorization:
        return None

    token = authorization.replace("Bearer ", "")

    # API Key 认证 (Phase 2 实现)
    if token.startswith("akit_"):
        raise AppError(code=ErrorCodes.AUTH_REQUIRED, message="API Key 认证暂未实现", status_code=401)

    # JWT 认证
    from app.services.auth import AuthService

    auth_service = AuthService(db)
    user = await auth_service.verify_token(token)
    if not user:
        raise AppError(code=ErrorCodes.AUTH_INVALID_TOKEN, message="无效或过期的 Token", status_code=401)
    return user


async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    """强制用户认证 - 必须登录"""
    token = authorization.replace("Bearer ", "")

    # API Key 认证 (Phase 2 实现)
    if token.startswith("akit_"):
        raise AppError(code=ErrorCodes.AUTH_REQUIRED, message="API Key 认证暂未实现", status_code=401)

    # JWT 认证
    from app.services.auth import AuthService

    auth_service = AuthService(db)
    user = await auth_service.verify_token(token)
    if not user:
        raise AppError(code=ErrorCodes.AUTH_INVALID_TOKEN, message="无效或过期的 Token", status_code=401)
    return user
