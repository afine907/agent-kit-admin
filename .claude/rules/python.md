---
description: "Python 开发规范"
globs: ["apps/server/**/*.py"]
---

# Python 开发规范

## Python 版本

使用 Python 3.11+，充分利用新特性：`match` 语句、改进的错误消息、性能优化

## 类型注解

### 函数签名
```python
# ✅ 完整类型注解
async def get_user(
    user_id: str,
    *,
    include_posts: bool = False
) -> User | None:
    """获取用户信息"""
    # 实现
```

### 复杂类型
```python
from typing import Optional, Sequence
from collections.abc import Awaitable

# 函数类型
AsyncUserHandler = Callable[[str], Awaitable[User]]

# 容器类型
UserList = list[User]
UserMap = dict[str, User]
OptionalUser = User | None
```

## 异步编程

### 使用 async/await
```python
# ✅ 正确的异步编程
async def fetch_users() -> list[User]:
    async with httpx.AsyncClient() as client:
        response = await client.get('/api/users')
        response.raise_for_status()
        return response.json()

# ❌ 阻塞调用在异步上下文中
async def fetch_users() -> list[User]:
    response = requests.get('/api/users')  # 阻塞！
    return response.json()
```

### 异步上下文管理器
```python
# ✅ 使用异步上下文管理器
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
        await session.rollback()
```

## FastAPI 规范

### 路由组织
```python
# ✅ 使用 APIRouter 组织路由
router = APIRouter(prefix='/users', tags=['users'])

@router.get('/')
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session)
) -> list[UserResponse]:
    """获取用户列表"""
    return await UserService(db).list_users(skip, limit)
```

### Pydantic 模型
```python
# ✅ 使用 Pydantic v2 模型
from pydantic import BaseModel, Field, EmailStr

class UserCreate(BaseModel):
    """创建用户请求模型"""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserResponse(BaseModel):
    """用户响应模型"""
    id: str
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True  # 支持 ORM 对象转换
```

## SQLAlchemy 规范

### 模型定义
```python
# ✅ 使用 SQLAlchemy 2.0 风格
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
```

### 查询模式
```python
# ✅ 使用 select 语句
from sqlalchemy import select

async def get_user_by_email(
    db: AsyncSession,
    email: str
) -> User | None:
    """通过邮箱获取用户"""
    stmt = select(User).where(
        User.email == email,
        User.deleted_at.is_(None)  # 软删除过滤
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
```

## 错误处理

### 自定义异常
```python
# ✅ 层次化的异常体系
class AppError(Exception):
    """应用基础异常"""
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)

class UserNotFoundError(AppError):
    """用户不存在"""
    def __init__(self, user_id: str):
        super().__init__(
            code='USER_NOT_FOUND',
            message=f'User {user_id} not found',
            status_code=404
        )
```

### 全局异常处理
```python
# ✅ FastAPI 全局异常处理器
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(AppError)
async def app_error_handler(
    request: Request,
    exc: AppError
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            'error': {
                'code': exc.code,
                'message': exc.message
            }
        }
    )
```

## 常见陷阱

### 避免可变默认参数
```python
# ❌ 使用可变默认参数
def add_user(user: User, users: list[User] = []):
    users.append(user)
    return users

# ✅ 使用 None 作为默认值
def add_user(user: User, users: list[Context] | None = None) -> list[User]:
    if users is None:
        users = []
    users.append(user)
    return users
```

### 避免循环导入
```python
# ✅ 使用 TYPE_CHECKING 避免循环导入
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from module_b import ClassB

def function_a(obj: ClassB) -> None:
    # 实现
    pass
```
