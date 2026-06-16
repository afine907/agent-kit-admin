"""测试配置

使用 SQLite 内存数据库和嵌套事务实现测试隔离。
每个测试函数在独立的 savepoint 中运行，结束后自动回滚。
"""

import os

# 必须在导入 app 之前设置，否则 Settings 生产安全检查会失败
os.environ.setdefault("DEBUG", "true")

import pytest
from jose import jwt
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.middleware.rate_limit import _rate_limiter
from app.models.package import Package
from app.models.version import Version
from app.config import get_settings


# 测试数据库 URL - 使用真正的内存数据库
TEST_DATABASE_URL = "sqlite+aiosqlite://"

# 创建测试引擎
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
)

# 创建测试会话工厂
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
async def setup_db():
    """创建测试数据库表"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db(setup_db):
    """测试数据库会话 - 使用连接级事务实现隔离。

    在连接上开始事务，将 session 绑定到该连接。
    拦截 commit() 调用（改为 flush），测试结束后回滚整个事务。
    """
    async with test_engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)

        # 拦截 commit：service 层的 commit() 改为 flush()，
        # 数据留在事务内但不真正提交，最后统一回滚
        async def _no_commit():
            await session.flush()

        session.commit = _no_commit  # type: ignore[method-assign]

        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()


@pytest.fixture
async def client(db: AsyncSession):
    """异步测试客户端"""

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


def _generate_token(user: User) -> str:
    """生成 JWT Token 的通用辅助函数"""
    settings = get_settings()
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@pytest.fixture
async def test_user(db: AsyncSession):
    """创建测试用户 (OAuth 用户)"""
    user = User(
        username="testuser",
        email="test@example.com",
        display_name="Test User",
        avatar_url="https://example.com/avatar.png",
        oauth_provider="wechat_work",
        oauth_id="test-oauth-id-001",
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
async def local_user(db: AsyncSession):
    """创建本地注册用户"""
    from app.core.security import hash_password

    user = User(
        username="localuser",
        email="local@example.com",
        display_name="Local User",
        password_hash=hash_password("SecurePass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
async def admin_user(db: AsyncSession):
    """创建管理员用户"""
    from app.core.security import hash_password

    user = User(
        username="admin",
        email="admin@example.com",
        display_name="Admin User",
        password_hash=hash_password("AdminPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="admin",
        status="active",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
async def super_admin_user(db: AsyncSession):
    """创建超级管理员用户"""
    from app.core.security import hash_password

    user = User(
        username="superadmin",
        email="superadmin@example.com",
        display_name="Super Admin",
        password_hash=hash_password("SuperAdminPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="super_admin",
        status="active",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
async def suspended_user(db: AsyncSession):
    """创建已停用的用户"""
    from app.core.security import hash_password

    user = User(
        username="suspended",
        email="suspended@example.com",
        display_name="Suspended User",
        password_hash=hash_password("SuspendedPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="suspended",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
async def another_user(db: AsyncSession):
    """创建另一个测试用户"""
    user = User(
        username="anotheruser",
        email="another@example.com",
        display_name="Another User",
        oauth_provider="wechat_work",
        oauth_id="test-oauth-id-002",
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user: User):
    """生成测试 JWT Token"""
    return _generate_token(test_user)


@pytest.fixture
def auth_headers(auth_token: str):
    """认证 Headers"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def another_auth_token(another_user: User):
    """另一个用户的 JWT Token"""
    return _generate_token(another_user)


@pytest.fixture
def another_auth_headers(another_auth_token: str):
    """另一个用户的认证 Headers"""
    return {"Authorization": f"Bearer {another_auth_token}"}


@pytest.fixture
def local_user_token(local_user: User):
    """本地用户的 JWT Token"""
    return _generate_token(local_user)


@pytest.fixture
def local_user_headers(local_user_token: str):
    """本地用户的认证 Headers"""
    return {"Authorization": f"Bearer {local_user_token}"}


@pytest.fixture
def admin_token(admin_user: User):
    """管理员的 JWT Token"""
    return _generate_token(admin_user)


@pytest.fixture
def admin_headers(admin_token: str):
    """管理员的认证 Headers"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def super_admin_token(super_admin_user: User):
    """超级管理员的 JWT Token"""
    return _generate_token(super_admin_user)


@pytest.fixture
def super_admin_headers(super_admin_token: str):
    """超级管理员的认证 Headers"""
    return {"Authorization": f"Bearer {super_admin_token}"}


@pytest.fixture
async def test_package(db: AsyncSession, test_user: User):
    """创建测试包"""
    package = Package(
        name="test-mcp",
        scope="@test",
        type="mcp",
        full_name="@test/test-mcp",
        description="Test MCP package",
        license="MIT",
        owner_id=test_user.id,
        visibility="public",
    )
    db.add(package)
    await db.flush()
    await db.refresh(package)
    return {
        "id": str(package.id),
        "name": package.name,
        "scope": package.scope,
        "type": package.type,
        "full_name": f"{package.scope}/{package.name}",
    }


@pytest.fixture
async def test_package_with_version(db: AsyncSession, test_user: User, test_package: dict):
    """创建带版本的测试包"""
    package = await db.get(Package, test_package["id"])
    version = Version(
        package_id=package.id,
        version="1.0.0",
        manifest={"name": "test-mcp", "version": "1.0.0", "type": "mcp"},
        tarball_hash="sha256:abc123def456",
        tarball_size=1024,
        tarball_path="packages/@test/test-mcp/1.0.0.tar.gz",
        tag="latest",
        published_by=test_user.id,
    )
    db.add(version)
    package.latest_version = "1.0.0"
    await db.flush()
    return test_package


@pytest.fixture
async def public_package(db: AsyncSession, test_user: User):
    """创建公开包"""
    package = Package(
        name="public-mcp",
        scope="@team",
        type="mcp",
        full_name="@team/public-mcp",
        description="Public MCP package",
        owner_id=test_user.id,
        visibility="public",
    )
    db.add(package)
    await db.flush()
    await db.refresh(package)
    return {
        "id": str(package.id),
        "name": package.name,
        "scope": package.scope,
        "type": package.type,
        "full_name": f"{package.scope}/{package.name}",
    }


@pytest.fixture
async def private_package(db: AsyncSession, test_user: User):
    """创建私有包"""
    package = Package(
        name="private-mcp",
        scope="@test",
        type="mcp",
        full_name="@test/private-mcp",
        description="Private MCP package",
        owner_id=test_user.id,
        visibility="private",
    )
    db.add(package)
    await db.flush()
    await db.refresh(package)
    return {
        "id": str(package.id),
        "name": package.name,
        "scope": package.scope,
        "type": package.type,
        "full_name": f"{package.scope}/{package.name}",
    }


@pytest.fixture
async def deleted_package(db: AsyncSession, test_user: User):
    """创建已删除的包"""
    package = Package(
        name="deleted-mcp",
        scope="@test",
        type="mcp",
        full_name="@test/deleted-mcp",
        description="Deleted MCP package",
        owner_id=test_user.id,
        visibility="public",
        deleted_at=datetime.now(timezone.utc),
    )
    db.add(package)
    await db.flush()
    await db.refresh(package)
    return {
        "id": str(package.id),
        "name": package.name,
        "scope": package.scope,
        "type": package.type,
        "full_name": f"{package.scope}/{package.name}",
    }


@pytest.fixture
async def multiple_packages(db: AsyncSession, test_user: User):
    """创建多个测试包"""
    packages = []
    for i in range(5):
        pkg_type = "mcp" if i % 2 == 0 else "skill"
        package = Package(
            name=f"package-{i}",
            scope="@test",
            type=pkg_type,
            full_name=f"@test/package-{i}",
            description=f"Test package {i}",
            owner_id=test_user.id,
            visibility="public",
        )
        db.add(package)
        packages.append(package)

    await db.flush()

    return [
        {
            "id": str(p.id),
            "name": p.name,
            "scope": p.scope,
            "type": p.type,
            "full_name": f"{p.scope}/{p.name}",
        }
        for p in packages
    ]


class MockStorageClient:
    """Mock S3 Client 用于健康检查"""

    def list_buckets(self):
        """模拟列出桶"""
        return {"Buckets": []}


class MockStorageService:
    """Mock StorageService 用于测试

    模拟 MinIO 存储服务，避免测试时连接真实服务。
    """

    def __init__(self):
        self.client = MockStorageClient()
        self.bucket = "packages"

    async def upload_tarball(self, scope: str, name: str, version: str, data: bytes) -> tuple[str, str]:
        """模拟上传包文件"""
        object_path = f"packages/{scope}/{name}/{version}.tar.gz"
        import hashlib

        sha256 = hashlib.sha256(data).hexdigest()
        return object_path, sha256

    async def upload_tarball_streaming(self, scope: str, name: str, version: str, file) -> tuple[str, str, int]:
        """模拟流式上传包文件"""
        object_path = f"packages/{scope}/{name}/{version}.tar.gz"
        # 读取文件内容以计算 hash 和大小
        content = await file.read()
        import hashlib

        sha256 = hashlib.sha256(content).hexdigest()
        return object_path, sha256, len(content)

    async def upload_content(self, object_path: str, data: bytes) -> None:
        """模拟上传内容文件"""
        pass

    async def get_presigned_url(self, object_path: str, expires: int = 900) -> str:
        """模拟生成预签名 URL"""
        return f"http://minio:9000/packages/{object_path}?presigned=true"

    async def delete_tarball(self, object_path: str) -> None:
        """模拟删除包文件"""
        pass

    async def get_tarball_size(self, object_path: str) -> int:
        """模拟获取文件大小"""
        return 1024


@pytest.fixture(autouse=True)
def mock_storage_service():
    """Mock StorageService 用于所有测试

    自动应用到所有测试，避免连接真实 MinIO。
    """
    mock_service = MockStorageService()

    with (
        patch("app.services.storage.get_storage_service", return_value=mock_service),
        patch("app.services.storage.StorageService", return_value=mock_service),
    ):
        yield mock_service


@pytest.fixture(autouse=True)
def disable_rate_limit(request):
    """禁用限流中间件，避免测试被 429 拦截

    test_rate_limit.py 中的测试专门测试限流逻辑，不自动 mock。
    """
    if "test_rate_limit" in request.fspath.basename:
        _rate_limiter.reset()
        yield
        return
    _rate_limiter.reset()
    with patch.object(_rate_limiter, "check", return_value=(True, 0)):
        yield
