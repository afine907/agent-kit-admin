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
