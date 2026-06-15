"""API 限流中间件测试

滑动窗口限流算法，按 IP + 端点分组。

测试场景：
1. 正常请求通过
2. 超过限制返回 429 + Retry-After 头
3. 不同端点不同限制
4. 不同 IP 独立计算
5. 限流窗口自动过期
6. 支持 X-Forwarded-For
"""

import time
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.database import get_db


@pytest.fixture
async def rl_client(db: AsyncSession):
    """限流测试客户端 - 复用 DB fixture 以支持需要数据库的端点"""

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """每个测试前重置限流器状态"""
    from app.middleware.rate_limit import _rate_limiter

    _rate_limiter.reset()
    yield
    _rate_limiter.reset()


@pytest.fixture(autouse=True)
def clear_login_failures():
    """每个测试前清除登录失败记录，避免登录锁干扰限流测试"""
    from app.services.auth import AuthService

    AuthService.clear_all_login_failures()
    yield
    AuthService.clear_all_login_failures()


@pytest.mark.asyncio
class TestRateLimitMiddleware:
    """API 限流中间件集成测试"""

    async def test_normal_request_passes(self, rl_client: AsyncClient):
        """正常请求应通过限流"""
        response = await rl_client.get("/api/health")
        assert response.status_code == 200

    async def test_returns_429_when_limit_exceeded(self, rl_client: AsyncClient):
        """超过限制后应返回 429

        使用 auth 端点，临时降低限流到 3/min 以在登录锁（5次）之前触发。
        """
        from app.middleware.rate_limit import _rate_limiter

        # 临时降低 auth 端点限制到 3/min，确保在登录锁之前触发
        _rate_limiter.limits["/api/v1/auth"] = {"requests": 3, "window": 60}

        for i in range(3):
            response = await rl_client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )
            assert response.status_code != 429, f"第 {i + 1} 次不应被限流"

        # 第 4 次应返回 429（来自我们的中间件，而非登录锁）
        response = await rl_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert response.status_code == 429

    async def test_429_response_contains_retry_after_header(self, rl_client: AsyncClient):
        """429 响应必须包含 Retry-After 头"""
        from app.middleware.rate_limit import _rate_limiter

        _rate_limiter.limits["/api/v1/auth"] = {"requests": 2, "window": 60}

        for _ in range(3):
            await rl_client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        response = await rl_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert response.status_code == 429
        assert "Retry-After" in response.headers
        retry_after = int(response.headers["Retry-After"])
        assert retry_after > 0
        assert retry_after <= 60

    async def test_429_response_body_format(self, rl_client: AsyncClient):
        """429 响应体应符合统一错误格式"""
        from app.middleware.rate_limit import _rate_limiter

        _rate_limiter.limits["/api/v1/auth"] = {"requests": 2, "window": 60}

        for _ in range(3):
            await rl_client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        response = await rl_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert response.status_code == 429
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == 20006  # ErrorCodes.RATE_LIMIT
        assert "message" in data["error"]
        assert "request_id" in data

    async def test_different_endpoints_different_limits(self, rl_client: AsyncClient):
        """不同端点应有不同限制"""
        from app.middleware.rate_limit import _rate_limiter

        # 降低 auth 限制到 3/min
        _rate_limiter.limits["/api/v1/auth"] = {"requests": 3, "window": 60}

        # 耗尽 auth 限制
        for _ in range(4):
            await rl_client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        # auth 应被限流
        response = await rl_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert response.status_code == 429

        # packages 端点不应受影响（限制 60/min）
        response = await rl_client.get("/api/v1/packages")
        assert response.status_code != 429

    async def test_different_ips_independent(self, rl_client: AsyncClient):
        """不同 IP 应独立计算限流"""
        from app.middleware.rate_limit import _rate_limiter

        _rate_limiter.limits["/api/v1/auth"] = {"requests": 3, "window": 60}

        # IP 1.2.3.4 耗尽限制
        for _ in range(4):
            await rl_client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
                headers={"X-Forwarded-For": "1.2.3.4"},
            )

        # IP 1.2.3.4 应被限流
        response = await rl_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
            headers={"X-Forwarded-For": "1.2.3.4"},
        )
        assert response.status_code == 429

        # IP 5.6.7.8 不应被限流
        response = await rl_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
            headers={"X-Forwarded-For": "5.6.7.8"},
        )
        assert response.status_code != 429

    async def test_health_endpoint_not_rate_limited(self, rl_client: AsyncClient):
        """健康检查端点不应被限流"""
        for _ in range(100):
            response = await rl_client.get("/api/health")
            assert response.status_code == 200

    async def test_rate_limit_window_resets(self, rl_client: AsyncClient):
        """限流窗口过期后应重置"""
        from app.middleware.rate_limit import _rate_limiter

        _rate_limiter.limits["/api/v1/auth"] = {"requests": 3, "window": 60}

        # 填充一些旧的时间戳（超过窗口期）
        old_timestamps = [time.time() - 120] * 10  # 2 分钟前
        _rate_limiter.store["testclient::/api/v1/auth/login"] = old_timestamps

        # 新请求应通过（旧时间戳已过期）
        response = await rl_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert response.status_code != 429


@pytest.mark.asyncio
class TestRateLimitSlidingWindow:
    """滑动窗口算法单元测试"""

    async def test_sliding_window_cleans_old_entries(self):
        """滑动窗口应清除过期条目"""
        from app.middleware.rate_limit import SlidingWindowLimiter

        limiter = SlidingWindowLimiter(
            limits={"/test": {"requests": 5, "window": 60}},
        )

        now = time.time()
        # 添加 3 个过期时间戳和 2 个有效时间戳
        limiter.store["ip::/test"] = [
            now - 120,  # 过期
            now - 90,  # 过期
            now - 70,  # 过期
            now - 10,  # 有效
            now - 5,  # 有效
        ]

        allowed, retry_after = await limiter.check("ip", "/test")
        assert allowed is True  # 只有 2 个有效，限制是 5

    async def test_sliding_window_returns_correct_retry_after(self):
        """滑动窗口应返回正确的 retry_after 时间"""
        from app.middleware.rate_limit import SlidingWindowLimiter

        limiter = SlidingWindowLimiter(
            limits={"/test": {"requests": 2, "window": 60}},
        )

        now = time.time()
        # 填满限制
        limiter.store["ip::/test"] = [now - 5, now - 3]

        allowed, retry_after = await limiter.check("ip", "/test")
        assert allowed is False
        assert retry_after > 0
        assert retry_after <= 60

    async def test_sliding_window_exact_limit_boundary(self):
        """恰好达到限制时应拒绝下一个请求"""
        from app.middleware.rate_limit import SlidingWindowLimiter

        limiter = SlidingWindowLimiter(
            limits={"/test": {"requests": 3, "window": 60}},
        )

        # 前 3 个请求应通过
        for _ in range(3):
            allowed, _ = await limiter.check("ip", "/test")
            assert allowed is True

        # 第 4 个请求应被拒绝
        allowed, retry_after = await limiter.check("ip", "/test")
        assert allowed is False
        assert retry_after > 0

    async def test_different_keys_independent(self):
        """不同的 key 应独立计算"""
        from app.middleware.rate_limit import SlidingWindowLimiter

        limiter = SlidingWindowLimiter(
            limits={"/test": {"requests": 2, "window": 60}},
        )

        # ip1 用完配额
        for _ in range(2):
            await limiter.check("ip1", "/test")

        # ip1 应被拒绝
        allowed, _ = await limiter.check("ip1", "/test")
        assert allowed is False

        # ip2 应仍可通过
        allowed, _ = await limiter.check("ip2", "/test")
        assert allowed is True

    async def test_no_matching_endpoint_passes(self):
        """未匹配的端点应放行"""
        from app.middleware.rate_limit import SlidingWindowLimiter

        limiter = SlidingWindowLimiter(
            limits={"/api/v1/auth": {"requests": 1, "window": 60}},
        )

        # 不匹配的路径应始终放行
        for _ in range(100):
            allowed, _ = await limiter.check("ip", "/api/v1/other")
            assert allowed is True

    async def test_exempt_paths_always_pass(self):
        """豁免路径应始终放行"""
        from app.middleware.rate_limit import SlidingWindowLimiter

        limiter = SlidingWindowLimiter(
            limits={"/api": {"requests": 1, "window": 60}},
        )

        # /api/health 是豁免路径，即使 /api 前缀有低限制
        for _ in range(100):
            allowed, _ = await limiter.check("ip", "/api/health")
            assert allowed is True
