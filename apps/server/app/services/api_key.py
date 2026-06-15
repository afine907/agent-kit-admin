"""API Key 服务 - 管理用户的 API Key"""

import hashlib
import secrets
from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.api_key import APIKey
from app.errors import AppError, ErrorCodes

# last_used_at 更新节流：同一 key 在 N 秒内只更新一次
_last_used_update_cache: dict[str, datetime] = {}
_LAST_USED_THROTTLE_SECONDS = 300  # 5 分钟

# 待持久化的 key hash 集合 - 延迟批量更新 last_used_at
_pending_last_used_updates: set[str] = set()


def generate_api_key() -> tuple[str, str, str]:
    """生成 API Key

    Returns:
        (full_key, key_hash, key_prefix) 元组
    """
    # 生成随机 key：akit_ + 32 字节随机字符
    random_part = secrets.token_urlsafe(32)
    full_key = f"akit_{random_part}"

    # 计算 SHA256 哈希用于存储
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()

    # 前缀用于展示：取前 12 个字符
    key_prefix = full_key[:12] + "..."

    return full_key, key_hash, key_prefix


def hash_api_key(key: str) -> str:
    """计算 API Key 的 SHA256 哈希"""
    return hashlib.sha256(key.encode()).hexdigest()


class APIKeyService:
    """API Key 管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_key(self, user_id: str, name: str) -> dict:
        """创建 API Key"""
        full_key, key_hash, key_prefix = generate_api_key()

        api_key = APIKey(
            user_id=user_id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            permissions=["read", "write"],
        )
        self.db.add(api_key)
        await self.db.commit()
        await self.db.refresh(api_key)

        return {
            "id": str(api_key.id),
            "name": api_key.name,
            "key": full_key,  # 只在创建时返回完整 key
            "key_prefix": api_key.key_prefix,
            "permissions": api_key.permissions,
            "created_at": api_key.created_at.isoformat() if api_key.created_at else None,
        }

    async def list_keys(self, user_id: str) -> list[dict]:
        """列出用户的所有 API Key"""
        result = await self.db.execute(
            select(APIKey).where(APIKey.user_id == user_id).order_by(APIKey.created_at.desc())
        )
        keys = result.scalars().all()

        return [
            {
                "id": str(key.id),
                "name": key.name,
                "key_prefix": key.key_prefix,
                "permissions": key.permissions,
                "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
                "created_at": key.created_at.isoformat() if key.created_at else None,
            }
            for key in keys
        ]

    async def delete_key(self, user_id: str, key_id: str) -> None:
        """删除 API Key（只能删除自己的）"""
        result = await self.db.execute(
            select(APIKey).where(
                APIKey.id == key_id,
                APIKey.user_id == user_id,
            )
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            raise AppError(
                code=ErrorCodes.NOT_FOUND,
                message="API Key not found",
                status_code=404,
            )

        await self.db.delete(api_key)
        await self.db.commit()

    async def verify_key(self, key: str) -> dict | None:
        """验证 API Key 并返回关联的用户信息

        用于 CLI 通过 API Key 认证。
        last_used_at 使用内存缓存 + 延迟批量更新机制，避免每次请求都 commit 数据库。
        - 内存缓存: 同一 key 在 N 秒内不触发任何数据库写入
        - 延迟更新: 节流到期后只标记为待更新，由 flush_pending_updates() 批量持久化
        """
        key_hash = hash_api_key(key)

        result = await self.db.execute(select(APIKey).where(APIKey.key_hash == key_hash))
        api_key = result.scalar_one_or_none()

        if not api_key:
            return None

        # 检查是否过期（兼容 SQLite 返回 naive datetime）
        if api_key.expires_at:
            expires_at = api_key.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                return None

        # 节流更新 last_used_at：同一 key 在 N 秒内不触发数据库写入
        now = datetime.now(timezone.utc)
        last_update = _last_used_update_cache.get(key_hash)
        if not last_update or (now - last_update).total_seconds() > _LAST_USED_THROTTLE_SECONDS:
            # 仅更新内存中的 ORM 对象（不 commit），标记为待批量持久化
            api_key.last_used_at = now
            _last_used_update_cache[key_hash] = now
            _pending_last_used_updates.add(key_hash)

        return {
            "key_id": str(api_key.id),
            "user_id": str(api_key.user_id),
            "permissions": api_key.permissions,
        }

    async def flush_pending_updates(self) -> int:
        """批量持久化待更新的 last_used_at

        由后台定时任务或应用关闭钩子调用，将内存中累积的
        last_used_at 更新一次性写入数据库，显著减少 commit 频率。

        Returns:
            成功更新的记录数
        """
        if not _pending_last_used_updates:
            return 0

        now = datetime.now(timezone.utc)
        batch = _pending_last_used_updates.copy()
        _pending_last_used_updates.clear()

        # 批量 UPDATE - 一次 commit 更新所有待持久化的 key
        await self.db.execute(update(APIKey).where(APIKey.key_hash.in_(batch)).values(last_used_at=now))
        await self.db.commit()

        return len(batch)
