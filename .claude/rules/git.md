---
description: "Git 工作流和提交规范"
globs: ["**/*"]
---

# Git 工作流规范

## 分支策略

- `main`: 生产环境，始终可部署
- `develop`: 开发分支，功能分支合并到此
- `feature/*`: 功能分支，从 develop 创建
- `fix/*`: 修复分支
- `release/*`: 发布分支

## 提交消息格式

使用 Conventional Commits:
```
<type>(<scope>): <subject>
```

**Type 类型**: `feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `ci`

**Scope 范围**: `server` `cli` `web` `deps` `config`

## 提交最佳实践

- 每个提交只做一件事
- 提交前运行 lint 和测试
- 提交消息使用中文（与项目语言一致）
- 使用 `git add -p` 精确暂存

## Pull Request 规范

- 标题使用提交消息格式
- 描述说明：做了什么、为什么、如何测试
- 关联相关 Issue

## 默认分支检测

**不要假设默认分支是 `main`**。先确认再操作：

```bash
# 方法 1：查看远程默认分支
git remote show origin 2>/dev/null | grep "HEAD branch"

# 方法 2：查看远程 HEAD
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null
```

确认后用实际分支名（`main` / `master`）执行 `git log`、`git diff` 等操作。

## gh CLI 多行参数传递

`gh pr create --body` 等命令传递多行内容时，**不要用双引号包裹**（反引号会被 shell 当命令替换执行）。

**正确做法**：用 heredoc 传递：

```bash
gh pr create --title "feat: xxx" --body "$(cat <<'EOF'
## Summary
描述内容
EOF
)"
```

**错误做法**：

```bash
# ❌ 反引号被 shell 吞掉
gh pr create --title "xxx" --body "## Summary
\`code\`"
```
