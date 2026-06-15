"""认证服务 - OAuth + JWT + 本地认证"""

import logging
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from cachetools import TTLCache
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import hash_password, verify_password
from app.errors import AppError, ErrorCodes
from app.models.user import User

logger = logging.getLogger(__name__)

settings = get_settings()

# 用户信息缓存 - 最多 1000 个用户，TTL 60 秒
# 存储 dict 而非 ORM 对象，避免 detached 问题
# TTL 60 秒：平衡性能与安全（封禁/角色变更后最多 60 秒生效）
_user_cache: TTLCache[str, dict] = TTLCache(maxsize=1000, ttl=60)

# 登录失败次数跟踪
# 格式: {email: {"count": int, "first_failure": datetime, "locked_until": datetime}}
# 生产环境应使用 Redis
_LOGIN_MAX_ATTEMPTS = 5  # 最大失败次数
_LOGIN_LOCKOUT_MINUTES = 15  # 锁定时间（分钟）
_login_failures: TTLCache[str, dict] = TTLCache(
    maxsize=10000,
    ttl=_LOGIN_LOCKOUT_MINUTES * 60,  # 自动过期，防止无限增长
)

logger.warning("认证服务使用内存存储（登录限制/OAuth state/Token 黑名单），多实例部署时请改用 Redis")


class UserSnapshot:
    """用户快照 - 用于缓存场景

    不绑定数据库 session 的轻量级用户对象。
    仅包含认证和权限检查所需的字段。
    """

    __slots__ = ("id", "username", "email", "display_name", "avatar_url", "oauth_provider", "role", "status")

    def __init__(
        self,
        id: str,
        username: str,
        email: str | None = None,
        display_name: str | None = None,
        avatar_url: str | None = None,
        oauth_provider: str = "local",
        role: str = "member",
        status: str = "active",
    ):
        self.id = id
        self.username = username
        self.email = email
        self.display_name = display_name
        self.avatar_url = avatar_url
        self.oauth_provider = oauth_provider
        self.role = role
        self.status = status


# OAuth state 存储 - 用于防止 CSRF 攻击
# 格式: {state_token: {"provider": str, "expires": datetime}}
# 生产环境应使用 Redis 等分布式存储
_oauth_state_store: dict[str, dict] = {}
_OAUTH_STATE_TTL_MINUTES = 10  # state 有效期 10 分钟


class AuthService:
    """认证服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _user_to_dict(user: User) -> dict:
        """将 User ORM 对象转换为可缓存的 dict"""
        return {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "oauth_provider": user.oauth_provider,
            "role": user.role,
            "status": user.status,
        }

    # ============================================
    # JWT Token
    # ============================================

    # Token 黑名单 - 用于登出后使 token 失效
    # 格式: {token: expire_datetime}，自动清理过期 token 防止内存泄漏
    # 生产环境应使用 Redis
    _token_blacklist: dict[str, datetime] = {}
    _BLACKLIST_CLEANUP_INTERVAL = 100  # 每 100 次检查清理一次

    def create_token(self, user_id: str, username: str) -> str:
        """生成 Access Token"""
        expire = datetime.now(timezone.utc) + timedelta(hours=2)  # 2小时有效
        payload = {
            "sub": str(user_id),
            "username": username,
            "type": "access",
            "exp": expire,
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    def create_refresh_token(self, user_id: str) -> str:
        """生成 Refresh Token"""
        expire = datetime.now(timezone.utc) + timedelta(days=7)  # 7天有效
        payload = {
            "sub": str(user_id),
            "type": "refresh",
            "exp": expire,
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    async def verify_token(self, token: str) -> User | UserSnapshot | None:
        """验证 JWT Token 并返回用户"""
        # 检查黑名单（带过期时间）
        expire_time = self._token_blacklist.get(token)
        if expire_time:
            if expire_time > datetime.now(timezone.utc):
                return None  # token 在黑名单中且未过期
            else:
                # 已过期，清理后继续正常验证
                del self._token_blacklist[token]

        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                return None

            # 先查缓存（存储的是 dict，避免 detached 问题）
            cached_data = _user_cache.get(user_id)
            if cached_data:
                # 从 dict 创建轻量级 User 对象用于认证检查
                return self._user_from_dict(cached_data)

            # 缓存未命中，查数据库
            result = await self.db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                # 缓存 dict，避免 ORM 对象 detached 问题
                _user_cache[user_id] = self._user_to_dict(user)
            return user
        except JWTError:
            return None

    @staticmethod
    def _user_from_dict(data: dict) -> "UserSnapshot":
        """从 dict 创建轻量级用户快照（用于认证检查）

        创建一个不绑定数据库的用户对象，仅包含认证所需字段。
        使用 UserSnapshot 类而非 ORM 对象，避免 detached 问题。
        """
        return UserSnapshot(
            id=data["id"],
            username=data["username"],
            email=data.get("email"),
            display_name=data.get("display_name"),
            avatar_url=data.get("avatar_url"),
            oauth_provider=data.get("oauth_provider"),
            role=data.get("role", "member"),
            status=data.get("status", "active"),
        )

    async def verify_refresh_token(self, token: str) -> User | None:
        """验证 Refresh Token 并返回用户"""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("type") != "refresh":
                return None

            user_id = payload.get("sub")
            if not user_id:
                return None

            result = await self.db.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()
        except JWTError:
            return None

    def blacklist_token(self, token: str) -> None:
        """将 Token 加入黑名单

        设置过期时间为 token 原始过期时间，防止内存泄漏。
        """
        try:
            payload = jwt.decode(
                token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"verify_exp": False}
            )
            exp_timestamp = payload.get("exp")
            if exp_timestamp:
                expire_time = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
            else:
                # 无过期时间，使用默认 2 小时
                expire_time = datetime.now(timezone.utc) + timedelta(hours=2)
        except JWTError:
            expire_time = datetime.now(timezone.utc) + timedelta(hours=2)

        self._token_blacklist[token] = expire_time

        # 定期清理过期 token
        self._cleanup_blacklist()

    @classmethod
    def _cleanup_blacklist(cls) -> None:
        """清理过期的黑名单 token

        使用计数器控制清理频率，避免每次调用都遍历。
        """
        if not hasattr(cls, "_blacklist_cleanup_counter"):
            cls._blacklist_cleanup_counter = 0

        cls._blacklist_cleanup_counter += 1
        if cls._blacklist_cleanup_counter >= cls._BLACKLIST_CLEANUP_INTERVAL:
            cls._blacklist_cleanup_counter = 0
            now = datetime.now(timezone.utc)
            expired = [token for token, exp in cls._token_blacklist.items() if exp <= now]
            for token in expired:
                del cls._token_blacklist[token]

    @staticmethod
    def invalidate_user_cache(user_id: str) -> None:
        """清除指定用户的缓存

        在用户信息更新或登出时调用。
        """
        _user_cache.pop(user_id, None)

    @staticmethod
    def clear_user_cache() -> None:
        """清除所有用户缓存"""
        _user_cache.clear()

    # ============================================
    # 登录失败次数限制
    # ============================================

    def _check_login_rate_limit(self, email: str) -> None:
        """检查登录失败次数限制

        如果超过限制，抛出 429 错误。
        """
        now = datetime.now(timezone.utc)
        failure_info = _login_failures.get(email)

        if not failure_info:
            return

        # 检查是否在锁定期间
        locked_until = failure_info.get("locked_until")
        if locked_until and now < locked_until:
            remaining_seconds = int((locked_until - now).total_seconds())
            remaining_minutes = (remaining_seconds + 59) // 60  # 向上取整
            raise AppError(
                code=ErrorCodes.RATE_LIMIT,
                message=f"Too many failed login attempts, please try again in {remaining_minutes} minutes",
                status_code=429,
            )

        # 如果锁定已过期，清除记录
        if locked_until and now >= locked_until:
            del _login_failures[email]

    def _record_login_failure(self, email: str) -> None:
        """记录登录失败"""
        now = datetime.now(timezone.utc)
        failure_info = _login_failures.get(email)

        if not failure_info:
            _login_failures[email] = {
                "count": 1,
                "first_failure": now,
            }
            return

        failure_info["count"] += 1

        # 检查是否达到限制
        if failure_info["count"] >= _LOGIN_MAX_ATTEMPTS:
            failure_info["locked_until"] = now + timedelta(minutes=_LOGIN_LOCKOUT_MINUTES)

    def _clear_login_failures(self, email: str) -> None:
        """清除登录失败记录（成功登录时调用）"""
        _login_failures.pop(email, None)

    @staticmethod
    def clear_all_login_failures() -> None:
        """清除所有登录失败记录（用于测试）"""
        _login_failures.clear()

    # ============================================
    # 本地注册/登录
    # ============================================

    async def register(
        self,
        username: str,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> dict:
        """本地注册"""
        # 检查用户名是否已存在
        result = await self.db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            raise AppError(
                code=ErrorCodes.USER_ALREADY_EXISTS,
                message="Username already exists",
                status_code=409,
            )

        # 检查邮箱是否已存在
        result = await self.db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            raise AppError(
                code=ErrorCodes.USER_ALREADY_EXISTS,
                message="Email already exists",
                status_code=409,
            )

        # 创建用户
        user = User(
            username=username,
            email=email,
            display_name=display_name or username,
            password_hash=hash_password(password),
            oauth_provider="local",
            oauth_id=None,
            role="member",
            status="active",
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        # 生成 Token
        access_token = self.create_token(str(user.id), user.username)
        refresh_token = self.create_refresh_token(str(user.id))

        return {
            "token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "role": user.role,
                "status": user.status,
            },
        }

    async def register_with_auto_username(
        self,
        username: str,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> dict:
        """本地注册 - 用户名冲突时自动添加数字后缀

        如果用户名已存在，自动尝试 username-2, username-3, ... 直到找到可用名。
        """
        # 检查原始用户名
        final_username = username
        result = await self.db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            # 用户名冲突，自动递增后缀
            counter = 2
            while True:
                candidate = f"{username}-{counter}"
                result = await self.db.execute(select(User).where(User.username == candidate))
                if not result.scalar_one_or_none():
                    final_username = candidate
                    break
                counter += 1

        # 创建用户
        user = User(
            username=final_username,
            email=email,
            display_name=display_name or final_username,
            password_hash=hash_password(password),
            oauth_provider="local",
            oauth_id=None,
            role="member",
            status="active",
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        # 生成 Token
        access_token = self.create_token(str(user.id), user.username)
        refresh_token = self.create_refresh_token(str(user.id))

        return {
            "token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "role": user.role,
                "status": user.status,
            },
        }

    async def login(self, email: str, password: str) -> dict:
        """本地登录"""
        # 检查登录失败次数限制
        self._check_login_rate_limit(email)

        # 查找用户
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            self._record_login_failure(email)
            self._check_login_rate_limit(email)  # 记录后再次检查
            raise AppError(
                code=ErrorCodes.AUTH_REQUIRED,
                message="Invalid email or password",
                status_code=401,
            )

        # 检查账号状态
        if user.status == "suspended":
            raise AppError(
                code=ErrorCodes.USER_SUSPENDED,
                message="Account has been suspended",
                status_code=403,
            )
        if user.status == "banned":
            raise AppError(
                code=ErrorCodes.USER_BANNED,
                message="Account has been banned",
                status_code=403,
            )

        # 验证密码
        if not user.password_hash:
            self._record_login_failure(email)
            self._check_login_rate_limit(email)  # 记录后再次检查
            raise AppError(
                code=ErrorCodes.AUTH_REQUIRED,
                message="Password login is not supported for this account",
                status_code=401,
            )

        if not verify_password(password, user.password_hash):
            self._record_login_failure(email)
            self._check_login_rate_limit(email)  # 记录后再次检查
            raise AppError(
                code=ErrorCodes.AUTH_REQUIRED,
                message="Invalid email or password",
                status_code=401,
            )

        # 登录成功，清除失败记录
        self._clear_login_failures(email)

        # 更新最后登录时间
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)

        # 生成 Token
        access_token = self.create_token(str(user.id), user.username)
        refresh_token = self.create_refresh_token(str(user.id))

        return {
            "token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "role": user.role,
                "status": user.status,
            },
        }

    async def refresh_token(self, refresh_token: str) -> dict:
        """刷新 Access Token"""
        user = await self.verify_refresh_token(refresh_token)
        if not user:
            raise AppError(
                code=ErrorCodes.AUTH_INVALID_TOKEN,
                message="Invalid or expired refresh token",
                status_code=401,
            )

        # 检查账号状态
        if user.status != "active":
            raise AppError(
                code=ErrorCodes.AUTH_FORBIDDEN,
                message="Account status is abnormal",
                status_code=403,
            )

        # 生成新的 Access Token
        access_token = self.create_token(str(user.id), user.username)

        return {
            "token": access_token,
        }

    # ============================================
    # 开发环境登录
    # ============================================

    async def get_or_create_dev_user(
        self,
        username: str,
        display_name: str,
        role: str | None = None,
    ) -> User:
        """开发环境快速登录 - 查找或创建用户"""
        # 查找已有用户
        result = await self.db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if user:
            # 如果指定了 role，更新已有用户的角色
            if role and user.role != role:
                user.role = role
                await self.db.commit()
                await self.db.refresh(user)
            return user

        # 创建新用户
        user = User(
            username=username,
            display_name=display_name,
            oauth_provider="dev",
            oauth_id=f"dev_{username}",
            role=role or "member",
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

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
                raise AppError(
                    code=ErrorCodes.AUTH_OAUTH_FAILED, message="WeChat Work is not configured", status_code=500
                )
            return (
                f"https://open.work.weixin.qq.com/wwopen/sso/qrConnect"
                f"?appid={settings.WECHAT_WORK_CORP_ID}"
                f"&agentid={settings.WECHAT_WORK_AGENT_ID}"
                f"&redirect_uri={base_url}/api/v1/auth/oauth/wechat_work/callback"
                f"&state={state_token}"
            )
        elif provider == "feishu":
            if not settings.FEISHU_APP_ID:
                raise AppError(code=ErrorCodes.AUTH_OAUTH_FAILED, message="Feishu is not configured", status_code=500)
            return (
                f"https://open.feishu.cn/open-apis/authen/v1/authorize"
                f"?app_id={settings.FEISHU_APP_ID}"
                f"&redirect_uri={base_url}/api/v1/auth/oauth/feishu/callback"
                f"&state={state_token}"
            )
        elif provider == "dingtalk":
            if not settings.DINGTALK_APP_KEY:
                raise AppError(code=ErrorCodes.AUTH_OAUTH_FAILED, message="DingTalk is not configured", status_code=500)
            return (
                f"https://login.dingtalk.com/oauth2/auth"
                f"?client_id={settings.DINGTALK_APP_KEY}"
                f"&redirect_uri={base_url}/api/v1/auth/oauth/dingtalk/callback"
                f"&response_type=code"
                f"&scope=openid"
                f"&state={state_token}"
            )
        else:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED, message=f"Unsupported provider: {provider}", status_code=400
            )

    def _cleanup_expired_states(self) -> None:
        """清理过期的 OAuth state"""
        now = datetime.now(timezone.utc)
        expired_keys = [key for key, value in _oauth_state_store.items() if value["expires"] < now]
        for key in expired_keys:
            del _oauth_state_store[key]

    def _verify_oauth_state(self, state: str | None, provider: str) -> None:
        """验证 OAuth state token

        使用 dict.pop() 原子操作获取并删除 state，防止并发请求的竞态条件。
        两个并发请求同时通过 CSRF 防护的风险被消除，因为 pop() 是原子的。
        """
        if not state:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message="Missing OAuth state parameter",
                status_code=400,
            )

        # 原子操作: 获取并删除 state，防止竞态条件
        # pop() 确保同一 state 只能被一个请求成功获取
        state_data = _oauth_state_store.pop(state, None)
        if not state_data:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message="Invalid or expired OAuth state",
                status_code=400,
            )

        # 检查是否过期
        if state_data["expires"] < datetime.now(timezone.utc):
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message="OAuth state has expired",
                status_code=400,
            )

        # 验证 provider
        if state_data["provider"] != provider:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message="OAuth state does not match provider",
                status_code=400,
            )

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
                    code=ErrorCodes.AUTH_OAUTH_FAILED, message=f"Unsupported provider: {provider}", status_code=400
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
                message=f"WeChat Work failed to get access_token: HTTP {token_resp.status_code}",
                status_code=502,
            )
        token_data = token_resp.json()
        if token_data.get("errcode", 0) != 0:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"WeChat Work failed to get access_token: {token_data.get('errmsg', 'unknown error')}",
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
                message=f"WeChat Work failed to get user info: HTTP {user_resp.status_code}",
                status_code=502,
            )
        user_data = user_resp.json()
        if user_data.get("errcode", 0) != 0:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"WeChat Work failed to get user info: {user_data.get('errmsg', 'unknown error')}",
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
        # 先获取 tenant_access_token
        tenant_resp = await client.post(
            "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
            json={
                "app_id": settings.FEISHU_APP_ID,
                "app_secret": settings.FEISHU_APP_SECRET,
            },
        )
        if tenant_resp.status_code != 200:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"Feishu failed to get tenant_access_token: HTTP {tenant_resp.status_code}",
                status_code=502,
            )
        tenant_data = tenant_resp.json()
        tenant_token = tenant_data.get("app_access_token")
        if not tenant_token:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"Feishu failed to get tenant_access_token: {tenant_data.get('msg', 'unknown error')}",
                status_code=502,
            )

        # 使用 tenant_access_token 获取用户 access_token
        token_resp = await client.post(
            "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token",
            json={"grant_type": "authorization_code", "code": code},
            headers={"Authorization": f"Bearer {tenant_token}"},
        )
        if token_resp.status_code != 200:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"Feishu failed to get access_token: HTTP {token_resp.status_code}",
                status_code=502,
            )
        token_data = token_resp.json()
        if token_data.get("code", 0) != 0:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"Feishu failed to get access_token: {token_data.get('msg', 'unknown error')}",
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
                message=f"Feishu failed to get user info: HTTP {user_resp.status_code}",
                status_code=502,
            )
        user_resp_data = user_resp.json()
        if user_resp_data.get("code", 0) != 0:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"Feishu failed to get user info: {user_resp_data.get('msg', 'unknown error')}",
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
                message=f"DingTalk failed to get access_token: HTTP {token_resp.status_code}",
                status_code=502,
            )
        token_data = token_resp.json()
        access_token = token_data.get("accessToken")
        if not access_token:
            raise AppError(
                code=ErrorCodes.AUTH_OAUTH_FAILED,
                message=f"DingTalk failed to get access_token: {token_data.get('message', 'accessToken not returned')}",
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
                message=f"DingTalk failed to get user info: HTTP {user_resp.status_code}",
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
