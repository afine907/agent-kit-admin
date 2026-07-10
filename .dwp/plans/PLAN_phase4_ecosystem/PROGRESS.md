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

## Key Decisions

- Webhook 投递使用 `asyncio.create_task` 异步执行，不阻塞主请求
- Task 2 的大部分代码在 Task 1 提交 (050bac9) 中已经存在，本次补全了缺失的测试用例

## Important Values & Paths

- Plan location: `.dwp/plans/PLAN_phase4_ecosystem/`
- Branch: `feature/phase4-ecosystem`
- Target: `master`
