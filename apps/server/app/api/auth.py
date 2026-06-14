"""认证 API 路由"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth import AuthService
from app.services.api_key import APIKeyService
from app.api.deps import get_current_user, get_current_user_with_token
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, AuthResponse, CreateAPIKeyRequest

router = APIRouter(prefix="/auth", tags=["auth"])


class DevLoginRequest(BaseModel):
    """开发环境登录请求"""
    username: str
    display_name: str | None = None
    role: str | None = None  # 可选：指定角色 (super_admin / admin / member)


@router.post("/register", status_code=201)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """本地注册"""
    auth_service = AuthService(db)
    result = await auth_service.register(
        username=data.username,
        email=data.email,
        password=data.password,
        display_name=data.display_name,
    )
    return result


@router.post("/login")
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """本地登录"""
    auth_service = AuthService(db)
    result = await auth_service.login(
        email=data.email,
        password=data.password,
    )
    return result


@router.post("/refresh")
async def refresh_token(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """刷新 Access Token"""
    auth_service = AuthService(db)
    result = await auth_service.refresh_token(data.refresh_token)
    return result


@router.post("/logout")
async def logout(
    user_and_token: tuple = Depends(get_current_user_with_token),
    db: AsyncSession = Depends(get_db),
):
    """登出"""
    user, token = user_and_token
    auth_service = AuthService(db)
    # 将 token 加入黑名单
    auth_service.blacklist_token(token)
    return {"message": "登出成功"}


@router.post("/dev-login")
async def dev_login(
    data: DevLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """开发环境快速登录 - 仅用于测试"""
    from app.config import get_settings

    settings = get_settings()
    if not settings.DEBUG:
        return {"error": "Dev login only available in DEBUG mode"}

    auth_service = AuthService(db)
    user = await auth_service.get_or_create_dev_user(
        username=data.username,
        display_name=data.display_name or data.username,
        role=data.role,
    )

    # 复用 AuthService 的 create_token（使用 python-jose + timezone-aware datetime）
    token = auth_service.create_token(str(user.id), user.username)

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
    from app.config import get_settings

    settings = get_settings()
    if settings.OAUTH_PROVIDER and provider != settings.OAUTH_PROVIDER:
        from app.errors import AppError
        raise AppError(
            code="OAUTH_PROVIDER_DISABLED",
            message=f"OAuth provider '{provider}' is not enabled",
            status_code=403,
        )

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
    from app.config import get_settings

    settings = get_settings()
    if settings.OAUTH_PROVIDER and provider != settings.OAUTH_PROVIDER:
        from app.errors import AppError
        raise AppError(
            code="OAUTH_PROVIDER_DISABLED",
            message=f"OAuth provider '{provider}' is not enabled",
            status_code=403,
        )

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
        "role": user.role,
    }


# ============================================
# API Key 管理
# ============================================


@router.post("/api-keys", status_code=201)
async def create_api_key(
    data: CreateAPIKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建 API Key"""
    service = APIKeyService(db)
    return await service.create_key(user_id=str(user.id), name=data.name)


@router.get("/api-keys")
async def list_api_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户的所有 API Key"""
    service = APIKeyService(db)
    return await service.list_keys(user_id=str(user.id))


@router.delete("/api-keys/{key_id}", status_code=204)
async def delete_api_key(
    key_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除 API Key"""
    service = APIKeyService(db)
    await service.delete_key(user_id=str(user.id), key_id=key_id)
