"""API Key Service 单元测试"""

import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import APIKey
from app.services.api_key import (
    APIKeyService,
    generate_api_key,
    hash_api_key,
    _last_used_update_cache,
    _pending_last_used_updates,
)


class TestGenerateApiKey:
    """generate_api_key 测试"""

    def test_generate_api_key_format(self):
        """生成的 key 应以 akit_ 开头"""
        full_key, _, key_prefix = generate_api_key()
        assert full_key.startswith("akit_")
        assert key_prefix.endswith("...")

    def test_generate_api_key_unique(self):
        """每次生成应产生不同的 key"""
        keys = [generate_api_key()[0] for _ in range(10)]
        assert len(set(keys)) == 10

    def test_key_hash_is_sha256(self):
        """key_hash 应为 SHA256 hex"""
        full_key, key_hash, _ = generate_api_key()
        expected = hashlib.sha256(full_key.encode()).hexdigest()
        assert key_hash == expected

    def test_key_prefix_truncates(self):
        """key_prefix 应是完整 key 的前 12 字符 + ..."""
        full_key, _, key_prefix = generate_api_key()
        assert key_prefix == full_key[:12] + "..."


class TestHashApiKey:
    """hash_api_key 测试"""

    def test_hash_consistent(self):
        """同一 key 每次 hash 结果相同"""
        h1 = hash_api_key("akit_key1")
        h2 = hash_api_key("akit_key1")
        assert h1 == h2

    def test_different_inputs_different_hashes(self):
        """不同 key 的 hash 不同"""
        h1 = hash_api_key("akit_key1")
        h2 = hash_api_key("akit_key2")
        assert h1 != h2


class TestVerifyKey:
    """verify_key 端到端测试（使用真实 AsyncSession）"""

    @pytest.fixture
    def clean_cache(self):
        """每个测试前清理全局状态"""
        _last_used_update_cache.clear()
        _pending_last_used_updates.clear()
        yield
        _last_used_update_cache.clear()
        _pending_last_used_updates.clear()

    @pytest.mark.asyncio
    async def test_verify_key_not_found(self, db: AsyncSession, clean_cache):
        """key 不存在返回 None"""
        svc = APIKeyService(db)
        result = await svc.verify_key("akit_nonexistentkey12345678901234567890")
        assert result is None

    @pytest.mark.asyncio
    async def test_verify_key_found(self, db: AsyncSession, clean_cache):
        """有效的 key 返回用户信息"""
        # 创建 API Key
        svc = APIKeyService(db)
        created = await svc.create_key(user_id="user-verify-001", name="Test Key")
        full_key = created["key"]

        result = await svc.verify_key(full_key)

        assert result is not None
        assert result["user_id"] == "user-verify-001"
        assert "read" in result["permissions"]

    @pytest.mark.asyncio
    async def test_verify_key_updates_last_used(self, db: AsyncSession, clean_cache):
        """verify_key 应更新 last_used_at"""
        svc = APIKeyService(db)
        created = await svc.create_key(user_id="user-lastused-001", name="Test Key")
        full_key = created["key"]
        key_hash = hash_api_key(full_key)

        # 第一次调用应更新 last_used
        await svc.verify_key(full_key)
        assert key_hash in _pending_last_used_updates
        assert key_hash in _last_used_update_cache

    @pytest.mark.asyncio
    async def test_verify_key_throttles_within_window(self, db: AsyncSession, clean_cache):
        """同一 key 在节流窗口内不重复更新"""
        svc = APIKeyService(db)
        created = await svc.create_key(user_id="user-throttle-001", name="Test Key")
        full_key = created["key"]
        key_hash = hash_api_key(full_key)

        # 第一次调用
        await svc.verify_key(full_key)
        first_update_time = _last_used_update_cache[key_hash]

        # 立即第二次调用（在节流窗口内）
        await svc.verify_key(full_key)

        # 时间不应改变
        assert _last_used_update_cache[key_hash] == first_update_time
        # 不应重复添加到 pending
        assert _pending_last_used_updates == {key_hash}


class TestFlushPendingUpdates:
    """flush_pending_updates 测试"""

    @pytest.fixture
    def clean_cache(self):
        _last_used_update_cache.clear()
        _pending_last_used_updates.clear()
        yield
        _last_used_update_cache.clear()
        _pending_last_used_updates.clear()

    @pytest.mark.asyncio
    async def test_flush_no_pending_returns_zero(self, db: AsyncSession, clean_cache):
        """无待更新时返回 0"""
        svc = APIKeyService(db)
        count = await svc.flush_pending_updates()
        assert count == 0

    @pytest.mark.asyncio
    async def test_flush_updates_pending_keys(self, db: AsyncSession, clean_cache):
        """有待更新时批量更新并清空"""
        svc = APIKeyService(db)

        # 手动添加 pending
        _pending_last_used_updates.add("hash_flush_1")
        _pending_last_used_updates.add("hash_flush_2")

        count = await svc.flush_pending_updates()

        assert count == 2
        assert len(_pending_last_used_updates) == 0
