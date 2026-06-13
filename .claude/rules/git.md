---
description: "Git 工作流和提交规范"
globs: ["**/*"]
---

# Git 工作流规范

## 分支策略

- `main`: 生产环境分支，始终保持可部署状态
- `develop`: 开发分支，功能分支合并到此
- `feature/*`: 功能分支，从 develop 分支创建
- `fix/*`: 修复分支
- `release/*`: 发布分支

## 提交消息格式

使用 Conventional Commits 格式:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Type 类型

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响逻辑）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链更新
- `ci`: CI/CD 配置

### Scope 范围

根据项目结构，使用以下范围:
- `server`: 后端 API 相关
- `cli`: CLI 工具相关
- `web`: 前端界面相关
- `deps`: 依赖更新
- `config`: 配置文件更新

### 示例

```
feat(server): 添加包版本查询 API

- 实现 GET /packages/:name/versions 端点
- 支持分页和排序参数

Closes #123
```

```
fix(cli): 修复安装时路径解析错误

Windows 环境下路径分隔符处理不正确
```

## 提交最佳实践

- 每个提交只做一件事
- 提交前运行 lint 和测试
- 保持提交历史清晰可读
- 使用 `git add -p` 进行精确暂存
- 提交消息使用中文（与项目语言一致）

## Pull Request 规范

- 标题使用与提交消息相同的格式
- 描述中说明:
  - 做了什么改动
  - 为什么做这个改动
  - 如何测试
- 关联相关 Issue
- 请求适当的 Reviewer

## 代码审查

- 审查代码逻辑和设计
- 检查错误处理
- 验证测试覆盖
- 确保文档更新
- 保持友好和建设性的反馈
