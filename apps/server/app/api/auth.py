"""认证 API 路由"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth import AuthService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class DevLoginRequest(BaseModel):
    """开发环境登录请求"""
    username: str
    display_name: str | None = None


@router.post("/dev-login")
async def dev_login(
    data: DevLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """开发环境快速登录 - 仅用于测试"""
    from app.config import get_settings
    import jwt
    from datetime import datetime, timedelta

    settings = get_settings()
    if not settings.DEBUG:
        return {"error": "Dev login only available in DEBUG mode"}

    auth_service = AuthService(db)
    user = await auth_service.get_or_create_dev_user(
        username=data.username,
        display_name=data.display_name or data.username,
    )

    # 生成 JWT Token
    token = jwt.encode(
        {
            "sub": str(user.id),
            "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )

    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
        },
    }


@router.get("/oauth/{provider}")
async def oauth_login(provider: str):
    """OAuth 登录跳转 - 302 重定向到授权页"""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        auth_service = AuthService(db)
        url = auth_service.get_oauth_url(provider)
    return RedirectResponse(url=url, status_code=302)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(..., description="OAuth state 参数，用于防止 CSRF 攻击"),
    db: AsyncSession = Depends(get_db),
):
    """OAuth 回调 - 返回 JWT Token 和用户信息"""
    auth_service = AuthService(db)
    result = await auth_service.handle_oauth_callback(provider, code, state)
    return result


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
):
    """获取当前用户信息"""
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
    }
