# 复盘：迭代三遗留问题修复

**日期**: 2026-06-15
**范围**: 5 项低优先级遗留问题

## 做了什么

1. Team Model 迁移到 SQLAlchemy 2.0 `Mapped`/`mapped_column` 风格
2. Teams 页面接入后端 API（listTeams, listTeamMembers, createTeam, removeMember）
3. Team 类型从 Teams.tsx 内联定义迁移到 `api.ts` 统一导出
4. 新增 `PATCH /auth/me` 端点 + `UpdateProfileRequest` schema
5. `suggestNextVersion` 从模块 mock 重构为依赖注入模式

## 经验教训

### 1. 依赖注入优于模块 Mock
- **错误**: 之前 `suggestNextVersion` 直接 import `apiClient`，测试需要 `vi.mock('../src/api/client')`
- **正确做法**: 通过参数注入 fetcher 函数，提供默认实现，测试直接传 mock
- **写入**: `.claude/rules/typescript.md` → "可测试性设计" 章节

### 2. React 页面 API 集成标准模式
- **错误**: Teams.tsx 使用 placeholder 状态和内联类型定义
- **正确做法**: loading/error/data 三态 + useCallback + useEffect + 类型从 api.ts 导出
- **写入**: `.claude/rules/react.md` → "API 集成模式" 章节

### 3. 遵循已有规则
- python.md 已有 SQLAlchemy 2.0 示例，但实际代码（User, Team）仍用旧 Column 风格
- **教训**: 新代码必须遵循已有规则，发现不一致时立即修复
