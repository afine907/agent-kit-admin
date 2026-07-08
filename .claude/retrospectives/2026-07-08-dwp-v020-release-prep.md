# 复盘：DWP v0.2.0 Release Preparation

**日期**: 2026-07-08
**任务**: PLAN_release_prep_v020 — 14 个任务的自主执行
**结果**: ✅ 全部完成

## 执行概况

| 指标 | 值 |
|------|-----|
| 总任务数 | 14 |
| 完成率 | 100% |
| 提交数 | 14 commits |
| 涉及组件 | CLI (2 files)、Server (4 files)、Web (8 files) |
| 测试结果 | CLI 163 ✅、Server 332 ✅、Web 26 ✅ |

## 关键决策

1. **自主执行模式** — 任务之间不需要确认，直接推进。对于这种批量同类任务非常高效。
2. **先读后改** — 每个任务先读取相关源文件，理解现有模式，再动手改。
3. **验证门禁** — 每个任务完成后立即运行 lint → typecheck → test，通过才提交。

## 遇到的问题

### 1. API 签名变更导致测试失败（Task 10）
- **现象**: 给 `updatePackage` 添加 `license/repository/homepage` 字段后，PackageEdit 测试失败
- **原因**: 测试中的 `expect().toHaveBeenCalledWith()` 仍用旧参数，新字段以 `undefined` 出现
- **解决**: 更新测试期望对象，加入新字段
- **教训**: 写入 `testing.md` — API 变更时同步更新测试

### 2. i18n `t()` 缺少 useCallback 依赖（Task 11）
- **现象**: oxlint 报 `react-hooks(exhaustive-deps)` 警告
- **原因**: 在 `useCallback` 中使用 `t()` 但未加入依赖数组
- **解决**: 将 `t` 加入依赖数组
- **教训**: 写入 `react.md` — i18n 与 Hooks 依赖

### 3. `pnpm typecheck` 跑全部包（Task 6）
- **现象**: `pnpm typecheck` 同时跑 cli 和 web，web 的 typecheck 失败但被 cli 的成功掩盖
- **解决**: 改用 `pnpm --filter agent-kit-web typecheck` 单独跑
- **教训**: 写入 `general.md` — monorepo 组件级验证

## 有效模式

1. **读→改→验证→提交** 循环 — 每个任务严格按此流程，无跳过
2. **组件级验证** — 只跑改动组件的 lint/typecheck/test，速度快且噪音少
3. **先功能后 i18n** — 先实现功能逻辑，最后统一替换硬编码字符串
4. **渐进式提交** — 每个任务一个 commit，方便 review 和 revert

## 改进建议

1. **E2E 测试** — 本次只有单元测试，缺少端到端测试覆盖 install/update 完整流程
2. **OAuth 集成测试** — 需要实际 OAuth provider 环境验证回调流程
3. **Docker 构建验证** — 改动后未验证 Docker 构建是否正常
