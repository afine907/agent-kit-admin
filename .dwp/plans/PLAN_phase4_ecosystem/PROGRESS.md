# PROGRESS.md — PLAN_phase4_ecosystem

## Task Summaries

### Task 1: Semver constraint support in dependency resolver
- (已完成，commit: b5dcb38)

### Task 2: Webhook notification system
- **Status:** completed
- **Files:** `apps/server/app/models/webhook.py`, `apps/server/app/services/webhook.py`, `apps/server/app/api/webhooks.py`
- **Integration:** `fire_webhooks()` 已在 `packages.py` (publish/delete) 和 `versions.py` (publish/yanked) 中调用
- **Events:** `package.published`, `package.deleted`, `version.published`, `version.yanked`
- **Delivery:** HMAC-SHA256 签名，3次重试（指数退避）
- **Tests:** 8 test cases 全部通过（CRUD + 签名验证 + 非成员禁止列表）
- **Validation:** ruff check ✅, ruff format --check ✅, pytest ✅

### Task 3: Package ownership transfer
- **Status:** completed
- **Files:** `apps/server/app/services/package.py`（transfer_package 方法），`apps/server/app/api/packages.py`（/transfer endpoint），`apps/server/app/schemas/package.py`（PackageTransferRequest + PackageResponse 新增字段）
- **Tests:** 6 test cases 全部通过（转移给用户/团队/非owner禁止/自我转移禁止/目标不存在/包不存在）
- **Schema 修复:** PackageResponse 补充 `owner_type` 和 `owner_id` 字段；`new_scope` pattern 允许下划线
- **Validation:** ruff check ✅, ruff format --check ✅, pytest ✅

## Key Decisions

- PackageResponse schema 缺少 owner_type/owner_id，修复并同步更新
- new_scope 的 regex pattern 原本不支持下划线，导致 @owner_a 这类 username 无法通过，改为允许 `_`

## Important Values & Paths

- Plan location: `.dwp/plans/PLAN_phase4_ecosystem/`
- Branch: `feature/phase4-ecosystem`
- Target: `master`
