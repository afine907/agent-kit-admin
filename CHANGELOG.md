# 更新日志

所有重要的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

---

## [1.0.0] - 2026-08-22

### Added
- Agent Health Inspector: automated package health inspection system with four dimensions (compliance, content, freshness, functional)
- Health Check API endpoints for querying and managing package health status
- Background worker service with APScheduler for periodic health checks
- Health Check Badge component in Web UI for Package detail pages
- Skill Testing Chat Agent for validating skill behavior via LLM conversation
- Package edit, search sort, deprecate/yank, and visibility features
- Package dependency check on install
- CLI adapters for Cursor and Windsurf editors
- Install config recording for editor integration
- Team collaboration: team package management API (Phase 1 & 2)
- Team package download endpoint and CLI install support
- E2E journey tests covering full publish/install lifecycle
- Workspace isolation (Phase 1-4)
- CLI test suite with vitest
- i18n support for CLI and Web (Chinese primary)
- API Key authentication for CLI operations
- Reviews/rating system for packages
- Webhooks event system
- Token management and automatic refresh on 401
- Open-source governance files (CONTRIBUTING.md, CODE_OF_CONDUCT.md, Issue/PR templates)
- Architecture Decision Record (ADR) documentation

### Changed
- Removed OAuth login (WeChat Work/Feishu/DingTalk), now email-only authentication
- Removed `oauth_provider` and `oauth_id` fields from users table
- Removed OAuth-related configuration variables
- `User.password_hash` changed to non-nullable
- Updated development environment documentation
- CLI module system changed to Node16 (from NodeNext)
- Skill type refactored: removed MCP support, introduced Skill Testing Chat Agent

### Security
- Soft delete prevents package name re-registration (namespace squatting protection)
- Version immutability: published versions cannot be overwritten
- Rate limiting on all API endpoints
- Secrets never logged or returned in API responses

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
