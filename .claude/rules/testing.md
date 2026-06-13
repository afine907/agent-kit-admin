---
description: "测试编写规范"
globs: ["**/*.test.ts", "**/*.spec.ts", "**/*.test.py", "**/test_*.py"]
---

# 测试规范

## 测试原则

### FIRST 原则
- **Fast**: 测试应该快速执行
- **Independent**: 测试之间相互独立
- **Repeatable**: 测试在任何环境下都可重复
- **Self-Validating**: 测试应该有明确的通过/失败结果
- **Timely**: 测试应该在编写代码之前或同时编写

### AAA 模式
```typescript
// Arrange - 准备测试数据和环境
const user = { name: 'test', email: 'test@example.com' }

// Act - 执行被测试的操作
const result = await createUser(user)

// Assert - 验证结果
expect(result.name).toBe('test')
```

## TypeScript 测试 (Vitest)

### 文件组织
```
src/
├── services/
│   ├── user.ts
│   └── user.test.ts        # 同目录测试文件
└── utils/
    ├── helpers.ts
    └── helpers.test.ts
```

### 测试命名
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // 测试代码
    })

    it('should throw error when email is invalid', async () => {
      // 测试代码
    })

    it('should handle duplicate email', async () => {
      // 测试代码
    })
  })
})
```

### Mock 使用
```typescript
// Mock 外部依赖
vi.mock('@/database', () => ({
  db: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

// Mock 时钟
vi.useFakeTimers()

// 清理
afterEach(() => {
  vi.restoreAllMocks()
})
```

### 异步测试
```typescript
// async/await
it('should fetch data', async () => {
  const data = await fetchData()
  expect(data).toBeDefined()
})

// Promise
it('should resolve', () => {
  return expect(promise).resolves.toBe('value')
})

// 错误处理
it('should throw', async () => {
  await expect(asyncFn()).rejects.toThrow('error message')
})
```

## Python 测试 (pytest)

### 文件组织
```
app/
├── services/
│   ├── user.py
│   └── __init__.py
tests/
├── services/
│   ├── test_user.py        # 测试文件
│   └── __init__.py
├── conftest.py              # 共享 fixtures
└── __init__.py
```

### 测试命名
```python
class TestUserService:
    """用户服务测试类"""

    async def test_create_user_with_valid_data(self, db_session):
        """测试使用有效数据创建用户"""
        # 测试代码

    async def test_create_user_with_duplicate_email(self, db_session):
        """测试重复邮箱创建用户"""
        # 测试代码

    async def test_create_user_with_invalid_email(self, db_session):
        """测试无效邮箱创建用户"""
        # 测试代码
```

### Fixtures 使用
```python
# conftest.py
@pytest.fixture
async def db_session():
    """数据库会话 fixture"""
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest.fixture
def sample_user():
    """示例用户数据"""
    return {
        "name": "测试用户",
        "email": "test@example.com"
    }

# 使用
async def test_create_user(db_session, sample_user):
    user = await create_user(db_session, **sample_user)
    assert user.name == sample_user["name"]
```

### Mock 使用
```python
from unittest.mock import AsyncMock, patch

# Mock 整个模块
@patch('app.services.email.send_email')
async def test_send_welcome_email(mock_send_email):
    mock_send_email.return_value = True
    await send_welcome_email("user@example.com")
    mock_send_email.assert_called_once()

# Mock 对象方法
mock_db = AsyncMock()
mock_db.execute.return_value = [1, 2, 3]
```

## 测试覆盖

### 覆盖率目标
- 语句覆盖率: ≥ 80%
- 分支覆盖率: ≥ 70%
- 函数覆盖率: ≥ 90%

### 必须测试的场景
1. **正常路径**: 预期输入产生预期输出
2. **边界条件**: 最小值、最大值、空值
3. **错误处理**: 异常输入和错误情况
4. **并发场景**: 多线程/多进程访问
5. **集成点**: 外部服务和数据库交互

### 不需要测试的场景
1. 第三方库的内部实现
2. 简单的 getter/setter
3. 框架代码
4. 配置常量

## 测试工具

### TypeScript
- **测试框架**: Vitest
- **断言库**: Vitest 内置
- **Mock**: vi.fn(), vi.mock()
- **覆盖率**: c8 或 istanbul

### Python
- **测试框架**: pytest
- **断言**: Python 内置 assert
- **Mock**: unittest.mock
- **覆盖率**: pytest-cov
- **异步**: pytest-asyncio

## 运行测试

```bash
# TypeScript
pnpm test                    # 运行所有测试
pnpm test:watch              # 监听模式
pnpm test -- --coverage      # 覆盖率报告

# Python
pytest                       # 运行所有测试
pytest -x                    # 首次失败后停止
pytest --cov=app             # 覆盖率报告
pytest -k "test_user"        # 运行匹配的测试
```
