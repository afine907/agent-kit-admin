---
description: "测试编写规范"
globs: ["**/*.test.ts", "**/*.spec.ts", "**/*.test.py", "**/test_*.py"]
---

# 测试规范

## 测试原则

- **AAA 模式**: Arrange（准备）→ Act（执行）→ Assert（验证）
- 每个测试只验证一个行为
- 测试之间相互独立，不依赖执行顺序

## TypeScript 测试 (Vitest)

### 文件组织
- 测试文件与源文件同目录：`user.ts` → `user.test.ts`
- 使用 `describe` 和 `it` 组织测试

### Mock 使用
```typescript
vi.mock('@/database', () => ({
  db: { user: { create: vi.fn() } }
}))

afterEach(() => vi.restoreAllMocks())
```

## Python 测试 (pytest)

### 文件组织
- 测试文件在 `tests/` 目录，命名 `test_*.py`
- 使用 `conftest.py` 共享 fixtures

### Fixtures 使用
```python
@pytest.fixture
async def db_session():
    async with async_session() as session:
        yield session
        await session.rollback()
```

## 测试覆盖

### 覆盖率目标
- 语句覆盖率: ≥ 80%
- 分支覆盖率: ≥ 70%
- 函数覆盖率: ≥ 90%

### 必须测试的场景
1. 正常路径：预期输入产生预期输出
2. 边界条件：最小值、最大值、空值
3. 错误处理：异常输入和错误情况
4. 集成点：外部服务和数据库交互

## 运行测试

```bash
# TypeScript
pnpm test                    # 运行所有测试
pnpm test:watch              # 监听模式

# Python
pytest                       # 运行所有测试
pytest -x                    # 首次失败后停止
pytest --cov=app             # 覆盖率报告
```

## API 变更时同步更新测试

- **错误**: 修改了 API 调用签名（如添加新字段），但测试中的 `expect().toHaveBeenCalledWith()` 仍用旧参数
- **原因**: 测试硬编码了 API 调用的期望参数，API 变更后不匹配
- **正确做法**: 改 API 签名时，同时更新对应测试的期望参数。常见的遗漏字段：`undefined` 值也需要写入期望对象
- **场景**: 修改 `api.ts` 中的 API 函数签名后
- **来源**: 2026-07-08

---
