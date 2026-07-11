# PROGRESS.md — PLAN_phase4_ecosystem

## Task Summaries

### Task 1: Semver constraint support in dependency resolver
- (已完成，commit: b5dcb38)

### Task 2: Webhook notification system
- **Status:** completed
- **Files:** `models/webhook.py`, `services/webhook.py`, `api/webhooks.py`
- **Integration:** `fire_webhooks()` 在 `packages.py` (publish/delete) 和 `versions.py` (publish/yanked) 中调用
- **Events:** `package.published`, `package.deleted`, `version.published`, `version.yanked`
- **Delivery:** HMAC-SHA256 签名，3次重试（指数退避）
- **Tests:** 8 test cases 全部通过
- **Validation:** ruff check ✅, ruff format --check ✅, pytest ✅

### Task 3: Package ownership transfer
- **Status:** completed
- **Files:** `services/package.py`（transfer_package），`api/packages.py`（/transfer endpoint），`schemas/package.py`
- **Tests:** 6 test cases 全部通过
- **Schema 修复:** PackageResponse 补充 `owner_type`/`owner_id`；`new_scope` pattern 允许下划线
- **Validation:** ruff check ✅, ruff format --check ✅, pytest ✅

### Task 4: Batch operations
- **Status:** completed
- **Files:** `services/package.py`（batch_delete_packages, batch_deprecate_packages, _can_write_package），`api/packages.py`（/batch/delete, /batch/deprecate），`schemas/package.py`（BatchPackageRequest, BatchDeprecateRequest, BatchResultItem, BatchResultResponse）
- **Tests:** 7 test cases 全部通过（批量删除/废弃/取消废弃/权限检查/不存在包/50限制）
- **Bug 修复:** Version.tarball_path 是必填字段，test_batch.py fixture 补充该字段
- **Schema 设计:** BatchPackageRequest/BatchDeprecateRequest 的 max_length=50 从 schema 移除，改为 endpoint 自行返回 400（避免 Pydantic 返回 422）
- **Validation:** ruff check ✅, ruff format ✅, pytest ✅

### Task 5: CLI webhook management commands
- **Status:** completed
- **Files:** `apps/cli/src/commands/webhook.ts`（新文件），`apps/cli/src/api/client.ts`（+3 webhook 方法），`apps/cli/src/bin/akit.ts`（注册命令），`apps/cli/src/i18n.ts`（+1 key）
- **Commands:** `akit webhook list --team @slug`，`akit webhook add --team @slug --url https://... --events publish delete`，`akit webhook remove --team @slug --id <id>`
- **Features:** 表格输出、事件类型校验（publish/delete/version.published/version.yanked）、删除确认提示
- **Tests:** 7 test cases 全部通过
- **Bug 修复:** Commander v14 `commands` 是属性不是方法（`commands()` → `commands`），`inquirer.Confirm` 改为 `inquirer.prompt`
- **Validation:** pnpm test ✅, pnpm lint ✅（既有 js-yaml/semver TS 警告与本次改动无关）

### Task 6: CLI batch operations support
- **Status:** completed
- **Files:** `apps/cli/src/commands/batch.ts`（新文件），`apps/cli/src/api/client.ts`（+batchDeletePackages/batchDeprecatePackages），`apps/cli/src/bin/akit.ts`（注册命令），`apps/cli/src/i18n.ts`（+1 key）
- **Commands:** `akit batch delete @scope/name [--yes]`，`akit batch deprecate @scope/name [--undeprecate] [--yes]`
- **Features:** 操作前摘要展示、确认提示（`inquirer.prompt`）、per-package 成功/失败结果、`--yes` 跳过确认、`--undeprecate` 取消废弃
- **Tests:** 6 test cases 全部通过
- **Validation:** pnpm test ✅, pnpm lint ✅

## Key Decisions

- PackageResponse schema 缺少 owner_type/owner_id，修复并同步更新
- new_scope regex pattern 原本不支持下划线，导致 @owner_a 这类 username 无法通过
- Batch request schema 的 max_length 约束会返回 422 而非 400，故移除由 endpoint 统一处理

## Important Values & Paths

- Plan location: `.dwp/plans/PLAN_phase4_ecosystem/`
- Branch: `feature/phase4-ecosystem`
- Target: `master`
