"""API Key 服务 - 管理用户的 API Key"""

import hashlib
import secrets
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.api_key import APIKey
from app.errors import AppError, ErrorCodes


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
            select(APIKey)
            .where(APIKey.user_id == user_id)
            .order_by(APIKey.created_at.desc())
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
                message="API Key 不存在",
                status_code=404,
            )

        await self.db.delete(api_key)
        await self.db.commit()

    async def verify_key(self, key: str) -> dict | None:
        """验证 API Key 并返回关联的用户信息

        用于 CLI 通过 API Key 认证。
        """
        key_hash = hash_api_key(key)

        result = await self.db.execute(
            select(APIKey).where(APIKey.key_hash == key_hash)
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            return None

        # 检查是否过期
        if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
            return None

        # 更新最后使用时间
        api_key.last_used_at = datetime.now(timezone.utc)
        await self.db.commit()

        return {
            "key_id": str(api_key.id),
            "user_id": str(api_key.user_id),
            "permissions": api_key.permissions,
        }
