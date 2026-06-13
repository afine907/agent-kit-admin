"""认证服务 - OAuth + JWT"""

import secrets
import httpx
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.models.user import User
from app.errors import AppError, ErrorCodes

settings = get_settings()

# OAuth state 存储 - 用于防止 CSRF 攻击
# 格式: {state_token: {"provider": str, "expires": datetime}}
# 生产环境应使用 Redis 等分布式存储
_oauth_state_store: dict[str, dict] = {}
_OAUTH_STATE_TTL_MINUTES = 10  # state 有效期 10 分钟


class AuthService:
    """认证服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # JWT Token
    # ============================================

    def create_token(self, user_id: str, username: str) -> str:
        """生成 JWT Token"""
        expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS)
        payload = {
            "sub": str(user_id),
            "username": username,
            "exp": expire,
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    async def verify_token(self, token: str) -> User | None:
        """验证 JWT Token 并返回用户"""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                return None

            result = await self.db.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()
        except JWTError:
            return None

    # ============================================
    # OAuth
    # ============================================

    def get_oauth_url(self, provider: str) -> str:
        """获取 OAuth 授权 URL"""
        # 使用配置的 APP_BASE_URL 构建回调地址
        base_url = settings.APP_BASE_URL.rstrip("/")

        # 生成随机 state token 用于防止 CSRF 攻击
        state_token = secrets.token_urlsafe(32)
        _oauth_state_store[state_token] = {
            "provider": provider,
            "expires": datetime.now(timezone.utc) + timedelta(minutes=_OAUTH_STATE_TTL_MINUTES),
        }

        # 清理过期的 state
        self._cleanup_expired_states()

        if provider == "wechat_work":
            if not settings.WECHAT_WORK_CORP_ID:
                raise AppError(code=ErrorCodes.AUTH_OAUTH_FAILED, message="企业微信未配置", status_code=500)
            return (
                f"https://open.work.weixin.qq.com/wwopen/sso/qrConnect"
                f"?appid={settings.WECHAT_WORK_CORP_ID}"
                f"&agentid={settings.WECHAT_WORK_AGENT_ID}"
                f"&redirect_uri={base_url}/api/v1/auth/oauth/wechat_work/callback"
                f"&state={state_token}"
            )
        elif provider == "feishu":
            if not settings.FEISHU_APP_ID:
                raise AppError(code=ErrorCodes.AUTH_OAUTH_FAILED, message="飞书未配置", status_code=500)
            return (
                f"https://open.feishu.cn/open-apis/authen/v1/authorize"
                f"?app_id={settings.FEISHU_APP_ID}"
                f"&redirect_uri={base_url}/api/v1/auth/oauth/feishu/callback"
                f"&state={state_token}"
            )
        elif provider == "dingtalk":
            if not settings.DINGTALK_APP_KEY:
                raise AppError(code=ErrorCodes.AUTH_OAUTH_FAILED, message="钉钉未配置", status_code=500)
            return (
                f"https://login.dingtalk.com/oauth2/auth"
                f"?client_id={settings.DINGTALK_APP_KEY}"
                f"&redirect_uri={base_url}/api/v1/auth/oauth/dingtalk/callback"
                f"&response_type=code"
                f"&scope=openid"
                f"&state={state_token}"
            )
        else:
            raise AppError(code=ErrorCodes.AUTH_OAUTH_FAILED, message=f"不支持的 Provider: {provider}", status_code=400)

    def _cleanup_expired_states(self) -> None:
        """清理过期的 OAuth state"""
        now = datetime.now(timezone.utc)
        expired_keys = [key for key, value in _oauth_state_store.items() if value["expires"] < now]
        for key in expired_keys:
            del _oauth_state_store[key]

    def _verify_oauth_state(self, state: str | None, provider: str) -> None:
        """验证 OAuth state token"""
        if not state:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message="缺少 OAuth state 参数",
                status_code=400,
            )

        # 先检查是否存在（不删除）
        state_data = _oauth_state_store.get(state)
        if not state_data:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message="无效或已过期的 OAuth state",
                status_code=400,
            )

        # 检查是否过期
        if state_data["expires"] < datetime.now(timezone.utc):
            # 过期后才删除
            del _oauth_state_store[state]
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message="OAuth state 已过期",
                status_code=400,
            )

        # 验证 provider
        if state_data["provider"] != provider:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message="OAuth state 与 provider 不匹配",
                status_code=400,
            )

        # 验证通过后删除 state（一次性使用）
        del _oauth_state_store[state]

    async def handle_oauth_callback(self, provider: str, code: str, state: str | None = None) -> dict:
        """处理 OAuth 回调，返回 token 和用户信息"""
        # 验证 OAuth state 以防止 CSRF 攻击
        self._verify_oauth_state(state, provider)

        # 获取 OAuth 用户信息
        oauth_user = await self._get_oauth_user(provider, code)

        # 查找或创建用户
        user = await self._find_or_create_user(
            provider=provider,
            oauth_id=oauth_user["oauth_id"],
            username=oauth_user["username"],
            display_name=oauth_user.get("display_name"),
            avatar_url=oauth_user.get("avatar_url"),
            email=oauth_user.get("email"),
        )

        # 生成 JWT Token
        token = self.create_token(str(user.id), str(user.username))

        return {
            "token": token,
            "user": {
                "id": str(user.id),
                "username": user.username,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
            },
        }

    async def _get_oauth_user(self, provider: str, code: str) -> dict:
        """通过 OAuth code 获取用户信息"""
        async with httpx.AsyncClient() as client:
            if provider == "wechat_work":
                return await self._wechat_work_callback(client, code)
            elif provider == "feishu":
                return await self._feishu_callback(client, code)
            elif provider == "dingtalk":
                return await self._dingtalk_callback(client, code)
            else:
                raise AppError(
                    code=ErrorCodes.AUTH_OAUTH_FAILED, message=f"不支持的 Provider: {provider}", status_code=400
                )

    async def _wechat_work_callback(self, client: httpx.AsyncClient, code: str) -> dict:
        """企业微信 OAuth 回调处理"""
        # 获取 access_token
        token_resp = await client.get(
            "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
            params={
                "corpid": settings.WECHAT_WORK_CORP_ID,
                "corpsecret": settings.WECHAT_WORK_SECRET,
            },
        )
        if token_resp.status_code != 200:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"企业微信获取 access_token 失败: HTTP {token_resp.status_code}",
                status_code=502,
            )
        token_data = token_resp.json()
        if token_data.get("errcode", 0) != 0:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"企业微信获取 access_token 失败: {token_data.get('errmsg', '未知错误')}",
                status_code=502,
            )
        access_token = token_data.get("access_token")

        # 获取用户信息
        user_resp = await client.get(
            "https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo",
            params={"access_token": access_token, "code": code},
        )
        if user_resp.status_code != 200:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"企业微信获取用户信息失败: HTTP {user_resp.status_code}",
                status_code=502,
            )
        user_data = user_resp.json()
        if user_data.get("errcode", 0) != 0:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"企业微信获取用户信息失败: {user_data.get('errmsg', '未知错误')}",
                status_code=502,
            )

        return {
            "oauth_id": user_data.get("userid", ""),
            "username": user_data.get("userid", ""),
            "display_name": user_data.get("name", ""),
            "avatar_url": user_data.get("avatar", ""),
        }

    async def _feishu_callback(self, client: httpx.AsyncClient, code: str) -> dict:
        """飞书 OAuth 回调处理"""
        # 获取 access_token
        token_resp = await client.post(
            "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token",
            json={"grant_type": "authorization_code", "code": code},
            headers={"Authorization": f"Bearer {settings.FEISHU_APP_ID}"},
        )
        if token_resp.status_code != 200:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"飞书获取 access_token 失败: HTTP {token_resp.status_code}",
                status_code=502,
            )
        token_data = token_resp.json()
        if token_data.get("code", 0) != 0:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"飞书获取 access_token 失败: {token_data.get('msg', '未知错误')}",
                status_code=502,
            )
        access_token = token_data.get("data", {}).get("access_token")

        # 获取用户信息
        user_resp = await client.get(
            "https://open.feishu.cn/open-apis/authen/v1/user_info",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"飞书获取用户信息失败: HTTP {user_resp.status_code}",
                status_code=502,
            )
        user_resp_data = user_resp.json()
        if user_resp_data.get("code", 0) != 0:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"飞书获取用户信息失败: {user_resp_data.get('msg', '未知错误')}",
                status_code=502,
            )
        user_data = user_resp_data.get("data", {})

        return {
            "oauth_id": user_data.get("open_id", ""),
            "username": user_data.get("name", ""),
            "display_name": user_data.get("name", ""),
            "avatar_url": user_data.get("avatar_url", ""),
            "email": user_data.get("email", ""),
        }

    async def _dingtalk_callback(self, client: httpx.AsyncClient, code: str) -> dict:
        """钉钉 OAuth 回调处理"""
        # 获取 access_token
        token_resp = await client.post(
            "https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
            json={
                "clientId": settings.DINGTALK_APP_KEY,
                "clientSecret": settings.DINGTALK_APP_SECRET,
                "code": code,
                "grantType": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"钉钉获取 access_token 失败: HTTP {token_resp.status_code}",
                status_code=502,
            )
        token_data = token_resp.json()
        access_token = token_data.get("accessToken")
        if not access_token:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"钉钉获取 access_token 失败: {token_data.get('message', '未返回 accessToken')}",
                status_code=502,
            )

        # 获取用户信息
        user_resp = await client.get(
            "https://api.dingtalk.com/v1.0/contact/users/me",
            headers={"x-acs-dingtalk-access-token": access_token},
        )
        if user_resp.status_code != 200:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"钉钉获取用户信息失败: HTTP {user_resp.status_code}",
                status_code=502,
            )
        user_data = user_resp.json()

        return {
            "oauth_id": user_data.get("openId", ""),
            "username": user_data.get("nick", ""),
            "display_name": user_data.get("nick", ""),
            "avatar_url": user_data.get("avatarUrl", ""),
        }

    async def _find_or_create_user(
        self,
        provider: str,
        oauth_id: str,
        username: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
        email: str | None = None,
    ) -> User:
        """查找或创建用户"""
        # 查找已有用户
        result = await self.db.execute(
            select(User).where(
                User.oauth_provider == provider,
                User.oauth_id == oauth_id,
            )
        )
        user = result.scalar_one_or_none()

        if user:
            # 更新用户信息
            if display_name:
                user.display_name = display_name  # type: ignore[assignment]
            if avatar_url:
                user.avatar_url = avatar_url  # type: ignore[assignment]
            if email:
                user.email = email  # type: ignore[assignment]
            await self.db.commit()
            await self.db.refresh(user)
            return user

        # 创建新用户
        user = User(
            username=username,
            display_name=display_name,
            avatar_url=avatar_url,
            email=email,
            oauth_provider=provider,
            oauth_id=oauth_id,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
