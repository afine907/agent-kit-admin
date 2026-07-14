# 复盘: CI 流水线修复

**日期**: 2026-06-28
**场景**: CI 流水线长期失败，Lint Server / Lint Web / TypeCheck 三个 Job 持续红色

## 根因

CI 流水线从多个早期 commit 开始就处于失败状态，但未被及时修复。主要问题：

1. **ruff format --check 被忽略** — CLAUDE.md 只写了 "Ruff: Lint + 格式化"，但实际 CI 运行的 `ruff format --check .` 与开发者的 `ruff check --fix` 是两个独立命令，后者不检查格式化
2. **Web 存在未使用的 import** — `Badge`（Home.tsx）、`GitFork`、`Shield`（PackageCard.tsx）被导入但从未使用。oxlint 使用 `--deny-warnings`，所有警告=报错
3. **TypeCheck 被遗漏** — CLAUDE.md 的提交前清单只列了 lint，没列出 `pnpm typecheck`

## 教训

- **本地和 CI 的命令必须一致**：开发者跑 `ruff check .` 以为够了，但 CI 跑了 `ruff format --check .`。必须运行 CI 的完整命令链
- **`--deny-warnings` 模式**：Web 和 CLI 的 lint 都用 `--deny-warnings`，意味着任何 oxlint 警告（未使用 import、未使用的变量）都会导致 CI 失败
- **CI 挂了就应立刻修**：多个连续 commit 都有 CI 失败，形成了"反正都红着"的惯性。应该在第一个失败后立即排查

## 修复内容

- `ruff format` 重新格式化 `app/api/teams.py`、`app/services/team_package.py`
- 移除 Home.tsx 的 Badge import、PackageCard.tsx 的 GitFork/Shield import
- 更新 CLAUDE.md Code Quality Gates 表格，列出完整命令和注意事项
