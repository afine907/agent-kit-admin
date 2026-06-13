"""测试配置

使用 SQLite 内存数据库和嵌套事务实现测试隔离。
每个测试函数在独立的 savepoint 中运行，结束后自动回滚。
"""

import os

# 必须在导入 app 之前设置，否则 Settings 生产安全检查会失败
os.environ.setdefault("DEBUG", "true")

import pytest
import jwt
from datetime import datetime, timedelta, timezone
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models.user import User
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
    """测试数据库会话 - 使用嵌套事务实现隔离

    每个测试在 savepoint 中运行，结束后回滚，确保测试间数据隔离。
    """
    async with TestSessionLocal() as session:
        # 开始一个外层事务
        async with session.begin():
            # 创建 savepoint
            await session.begin_nested()

            yield session

            # 测试结束后回滚到 savepoint，不提交任何数据
            await session.rollback()


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
    """创建测试用户"""
    user = User(
        username="testuser",
        email="test@example.com",
        display_name="Test User",
        avatar_url="https://example.com/avatar.png",
        oauth_provider="wechat_work",
        oauth_id="test-oauth-id-001",
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
