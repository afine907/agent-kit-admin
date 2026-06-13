"""认证 API 路由"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth import AuthService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


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
