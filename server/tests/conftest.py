"""测试配置"""

import pytest
from httpx import AsyncClient
from app.main import app
from app.database import Base, engine


@pytest.fixture(scope="session")
async def setup_db():
    """创建测试数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client(setup_db):
    """异步测试客户端"""
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c


@pytest.fixture
def auth_headers():
    """认证 headers（需要先登录获取 token）"""
    # 这里使用测试 token，实际测试中需要先登录
    return {"Authorization": "Bearer test-token"}
