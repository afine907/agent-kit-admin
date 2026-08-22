# 更新日志

所有重要的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### 移除
- 移除 OAuth 登录功能（企微/飞书/钉钉），改为纯本地邮箱密码认证
- 移除 `users` 表的 `oauth_provider` 和 `oauth_id` 字段
- 移除 OAuth 相关配置项（`OAUTH_PROVIDER`、`WECHAT_WORK_*`、`FEISHU_*`、`DINGTALK_*`）

### 新增
- 添加 MIT LICENSE
- 添加 README.md（更新技术栈描述）
- 添加 CONTRIBUTING.md 贡献指南
- 添加 Issue 模板（bug report / feature request）
- 添加 PR 模板
- 添加 CODE_OF_CONDUCT.md 行为准则
- 添加 CHANGELOG.md

### 变更
- `User.password_hash` 改为非空字段
- 更新开发环境搭建文档

---

## [0.1.0] - 2024-01-01

### 新增
- 包注册/版本管理 API
- 团队管理 API
- 用户认证（JWT + Refresh Token）
- RBAC 权限控制（super_admin / admin / member）
- Webhooks 事件系统
- Reviews 评价系统
- Health Inspection 包健康检测
- API Key 管理
- Agent Chat（Skill 测试对话）
- `akit` CLI 工具
- React Web UI
- Docker Compose 部署
- 中英文双语支持
