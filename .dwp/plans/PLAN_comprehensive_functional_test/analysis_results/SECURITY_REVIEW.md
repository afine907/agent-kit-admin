# Security Review — PLAN_comprehensive_functional_test

## 审查范围

本计划为 v0.2.0 新功能编写了全面的测试代码，本次安全审查覆盖所有新增测试文件。

## 审查维度

### 1. 硬编码凭证检查

**结果：✅ 无问题**

扫描所有新增测试文件，未发现硬编码的 token、API key、密码或真实凭证。

- 测试中使用的 token 均为 mock 生成或测试 fixture
- API Key 测试使用动态创建的测试 key
- JWT token 使用测试 secret 生成

### 2. Mock 数据安全

**结果：✅ 无问题**

- 所有 mock 数据使用假值（如 `test@example.com`, `test-oauth-id-001`）
- 无真实用户数据
- 无真实 API endpoint

### 3. 测试 Fixtures 安全

**结果：✅ 无问题**

- `conftest.py` 使用 SQLite 内存数据库
- 测试隔离通过事务回滚实现
- 无文件系统副作用

### 4. 环境变量依赖

**结果：✅ 无问题**

- 测试不依赖真实环境变量
- 使用 `os.environ.setdefault("DEBUG", "true")` 设置测试环境

### 5. 数据库连接

**结果：✅ 无问题**

- 测试使用 `sqlite+aiosqlite://` 内存数据库
- 不连接生产数据库
- 每个测试在独立事务中运行

### 6. 文件路径

**结果：✅ 无问题**

- 测试使用 `tempfile` 创建临时目录
- 不读写生产环境路径
- 测试结束后自动清理

## 新增测试文件清单

| 文件 | 测试数 | 安全状态 |
|------|--------|----------|
| `apps/cli/tests/utils/tarball.test.ts` | 9 | ✅ Clean |
| `apps/cli/tests/commands/install.test.ts` | 3 | ✅ Clean |
| `apps/cli/tests/commands/update.test.ts` | 3 | ✅ Clean |
| `apps/cli/tests/agents/registry.test.ts` | 7 | ✅ Clean |
| `apps/server/tests/test_leave_team.py` | 6 | ✅ Clean |
| `apps/server/tests/test_uninstall_team_package.py` | 6 | ✅ Clean |
| `apps/server/tests/test_apikey_flush.py` | 5 | ✅ Clean |
| `apps/server/tests/test_e2e_journey.py` (新增部分) | 1 | ✅ Clean |
| `apps/web/src/pages/__tests__/AuthCallback.test.tsx` | 7 | ✅ Clean |
| `apps/web/src/lib/__tests__/api.test.ts` | 4 | ✅ Clean |
| `apps/web/src/__tests__/i18n.test.ts` | 6 | ✅ Clean |
| `apps/web/src/components/__tests__/TeamPackagesTab.test.tsx` | 5 | ✅ Clean |
| `apps/web/src/pages/__tests__/Home.test.tsx` | 4 | ✅ Clean |

## 结论

**安全审查通过，未发现安全问题。**

所有测试代码遵循安全最佳实践：
- 使用 mock 和 fixture 而非真实数据
- 测试环境与生产环境隔离
- 无硬编码凭证
- 临时文件自动清理
