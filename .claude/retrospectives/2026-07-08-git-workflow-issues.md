# 复盘：Git 工作流执行问题

**日期**: 2026-07-08
**场景**: 使用 `/git-workflow` 推送 PR #15 并合并

---

## 问题 1：默认分支名不匹配

**现象**: `git log origin/main..HEAD` 和 `git diff origin/main...HEAD` 失败

**根因**: `.claude/rules/git.md` 写的是 `main`，但实际仓库默认分支是 `master`

**修复**:
- 更新 `.claude/rules/git.md` — 增加"默认分支检测"章节
- 更新 `git-workflow` skill — Step 1 动态检测默认分支名

**教训**: 不要假设默认分支名，先 `git remote show origin` 确认

---

## 问题 2：gh pr create --body 反引号被 shell 解释

**现象**: PR body 中的 markdown 代码块（反引号）导致 shell 报错：
```
/usr/bin/bash: line 38: apps/cli/: Is a directory
/usr/bin/bash: line 38: POST: command not found
```

**根因**: Bash 中反引号 `` ` `` 是命令替换语法，`--body "..."` 中的反引号被 shell 吞掉

**修复**: 更新 `.claude/rules/git.md` — 增加"gh CLI 多行参数传递"章节，推荐用 heredoc

**教训**: 多行内容传给 CLI 参数时，用 `$(cat <<'EOF' ... EOF)` 避免 shell 解释

---

## 改进措施

| 文件 | 变更 |
|------|------|
| `.claude/rules/git.md` | 新增默认分支检测、gh CLI 多行参数规则 |
| `.claude/skills/git-workflow/skill.md` | Step 1 动态检测默认分支名 |
