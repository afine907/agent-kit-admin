---
description: "API 设计规范"
globs: ["apps/server/**/*.py"]
---

# API 设计规范

## RESTful 设计原则

### URL 命名
```python
# ✅ 使用名词复数形式
/users          # 用户列表
/users/{id}     # 单个用户
/packages       # 包列表
/packages/{name}/versions  # 包的版本列表

# ❌ 使用动词
/getUsers       # 不要使用动词
/createUser     # 不要使用动词
```

### HTTP 方法
- **GET** - 获取资源
- **POST** - 创建资源（返回 201）
- **PUT** - 完整更新资源
- **PATCH** - 部分更新资源
- **DELETE** - 删除资源（返回 204）

## 响应格式

### 成功响应
```python
# ✅ 统一响应格式
{
    "data": { ... },
    "meta": {
        "timestamp": "2024-01-13T10:00:00Z"
    }
}

# ✅ 列表响应
{
    "data": [ ... ],
    "pagination": {
        "total": 100,
        "page": 1,
        "pageSize": 20,
        "totalPages": 5
    }
}
```

### 错误响应
```python
# ✅ 统一错误格式
{
    "error": {
        "code": "USER_NOT_FOUND",
        "message": "用户不存在",
        "details": { "user_id": "user-123" }
    }
}
```

## 分页设计

### 查询参数
```python
@router.get('/users')
async def list_users(
    page: int = Query(1, ge=1, description='页码'),
    pageSize: int = Query(20, ge=1, le=100, description='每页数量'),
    sortBy: str = Query('created_at', description='排序字段'),
    sortOrder: str = Query('desc', regex='^(asc|desc)$', description='排序方向'),
    search: str | None = Query(None, description='搜索关键词'),
) -> PaginatedResponse[UserResponse]:
    pass
```

## 认证和授权

### API Key 认证
```python
# ✅ 使用 Header 传递 API Key
async def get_current_user(
    x_api_key: str = Header(..., alias='X-API-Key'),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """通过 API Key 获取当前用户"""
    user = await UserService(db).get_user_by_api_key(x_api_key)
    if not user:
        raise HTTPException(status_code=401, detail='Invalid API Key')
    return user
```

### 权限检查
```python
# ✅ 使用依赖注入进行权限检查
async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """要求管理员权限"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail='Admin access required')
    return current_user
```

## 输入验证

### 请求体验证
```python
# ✅ 使用 Pydantic 进行输入验证
from pydantic import BaseModel, Field, validator

class PackageCreate(BaseModel):
    """创建包请求"""
    name: str = Field(
        ...,
        min_length=1,
        max_length=214,
        regex=r'^[a-z0-9-]+$',
        description='包名称'
    )
    version: str = Field(
        ...,
        regex=r'^\d+\.\d+\.\d+$',
        description='版本号'
    )
    description: str | None = Field(
        None,
        max_length=1000,
        description='包描述'
    )

    @validator('name')
    def validate_name(cls, v: str) -> str:
        if v.startswith('-') or v.endswith('-'):
            raise ValueError('Package name cannot start or end with hyphen')
        return v
```

## 错误处理

### 错误码规范
```python
# ✅ 定义错误码枚举
from enum import Enum

class ErrorCode(str, Enum):
    # 通用错误
    INTERNAL_ERROR = 'INTERNAL_ERROR'
    INVALID_REQUEST = 'INVALID_REQUEST'
    NOT_FOUND = 'NOT_FOUND'

    # 认证错误
    UNAUTHORIZED = 'UNAUTHORIZED'
    FORBIDDEN = 'FORBIDDEN'
    INVALID_TOKEN = 'INVALID_TOKEN'
    TOKEN_EXPIRED = 'TOKEN_EXPIRED'

    # 用户错误
    USER_NOT_FOUND = 'USER_NOT_FOUND'
    DUPLICATE_EMAIL = 'DUPLICATE_EMAIL'
    INVALID_PASSWORD = 'INVALID_PASSWORD'

    # 包错误
    PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND'
    VERSION_EXISTS = 'VERSION_EXISTS'
    INVALID_MANIFEST = 'INVALID_MANIFEST'
```

### 错误响应
```python
# ✅ 使用统一的错误响应格式
class ErrorResponse(BaseModel):
    """错误响应"""
    error: ErrorDetail
    meta: ResponseMeta

class ErrorDetail(BaseModel):
    """错误详情"""
    code: ErrorCode
    message: str
    details: dict | None = None
```

## 缓存控制

### 响应缓存
```python
from fastapi.responses import Response

@router.get('/packages/{name}')
async def get_package(
    name: str,
    response: Response,
) -> PackageResponse:
    # 设置缓存头
    response.headers['Cache-Control'] = 'public, max-age=300'  # 5 分钟
    response.headers['ETag'] = f'"package-{name}-{version}"'
    # 实现
    pass
```

## 文档注释

### OpenAPI 文档
```python
@router.get(
    '/packages/{name}',
    response_model=PackageResponse,
    summary='获取包信息',
    description='根据包名获取包的详细信息',
    responses={
        404: {
            'description': '包不存在',
            'content': {
                'application/json': {
                    'example': {
                        'error': {
                            'code': 'PACKAGE_NOT_FOUND',
                            'message': 'Package not found'
                        }
                    }
                }
            }
        }
    },
)
async def get_package(
    name: str = Path(..., description='包名称'),
) -> PackageResponse:
    """
    获取包信息

    - **name**: 包名称（小写字母、数字、连字符）

    返回包的详细信息，包括：
    - 基本信息（名称、描述、作者）
    - 版本信息
    - 下载统计
    """
    pass
```
