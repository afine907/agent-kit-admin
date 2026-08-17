# MVP 规格说明

## MVP 目标

**一句话:** 让团队能在 3 分钟内完成从零到安装第一个 Skill 的全流程。

---

## MVP 范围

### 包含功能

| 模块 | 功能 | 说明 |
|---|---|---|
| **CLI** | `akit login` | OAuth 登录 + Token 登录 |
| | `akit publish` | 发布 Skill |
| | `akit install` | 安装包（下载解压 + 记录） |
| | `akit uninstall` | 卸载包 |
| | `akit list` | 查看已安装列表 |
| | `akit search` | 搜索包 |
| | `akit info` | 查看包详情 |
| **API** | 包管理 CRUD | 创建、查询、删除 |
| | 版本管理 | 发布版本、查询版本 |
| | 文件上传/下载 | MinIO 存储 |
| | 用户认证 | OAuth + JWT |
| **Web UI** | 包列表页 | 搜索、筛选、排序 |
| | 包详情页 | 描述、版本、安装命令 |
| | 登录页 | OAuth 登录 |
| | 个人中心 | 我的包列表 |
| **部署** | Docker Compose | 一键部署 |
| | 初始化脚本 | 自动生成配置 |

### 不包含功能

| 功能 | 推迟到 | 原因 |
|---|---|---|
| 评分/评论 | Phase 2 | 非核心流程 |
| 团队管理 | Phase 2 | 先支持个人使用 |
| 依赖管理 | Phase 3 | 增加复杂度 |
| 包签名 | Phase 3 | 安全增强 |
| Webhook | Phase 3 | 高级功能 |
| 多 Agent (Cursor 等) | Phase 2 | 先做 Claude Code + Codex |

---

## Agent 支持

### 安装行为

`akit install` 只负责下载并解压包到本地缓存目录，并记录到已安装列表。Skill 包安装后即可被各类 Agent（Claude Code、Codex、Cursor 等）发现和使用，CLI 不再写入任何 Agent 配置文件。

### 后续支持 (Phase 2+)

| Agent | 备注 |
|---|---|
| Cursor | 与 Claude Code 使用相同规范路径 |
| Windsurf | 与 Claude Code 使用相同规范路径 |
| Cline | 需要不同适配 |
| Aider | 需要不同适配 |

---

## MVP 验收标准

### 功能验收

| 场景 | 验收标准 | 测试方法 |
|---|---|---|
| 新用户注册 | OAuth 登录成功，获取 JWT Token | 手动测试 |
| 发布 Skill | `akit publish` 成功，Web UI 可见 | 手动测试 |
| 安装 Skill | `akit install` 成功，包可被 Agent 使用 | 手动测试 |
| 搜索包 | `akit search` 返回结果 | 手动测试 |
| Docker 部署 | `docker compose up` 一键启动 | 脚本测试 |

### 性能验收

| 指标 | 目标 | 测试方法 |
|---|---|---|
| CLI 安装 (10MB 包) | < 5s | 计时测试 |
| API 响应时间 | P95 < 200ms | 压力测试 |
| Web 首屏加载 | < 2s | Lighthouse |
| Docker 启动时间 | < 30s | 计时测试 |

### 体验验收

| 场景 | 目标 |
|---|---|
| 零到安装第一个 Skill | < 3 分钟 |
| 首次 Docker 部署 | < 5 分钟 |
| 学习成本 | 看 README 即可上手 |

---

## MVP 时间表

```
Week 1: 基础搭建
├── 项目脚手架 (server/cli/web)
├── 数据库 Schema
├── API 基础框架
└── Docker Compose 基础配置

Week 2: 核心功能
├── CLI: login, publish, install
├── API: 包 CRUD + 版本管理
├── 包安装链路: 下载 + 解压 + 记录
└── Web UI: 登录 + 包列表

Week 3: 完善和测试
├── CLI: list, search, info, uninstall
├── Web UI: 包详情 + 个人中心
├── 集成测试
└── 文档编写
```

---

## 成功指标

| 指标 | 目标 | 衡量方式 |
|---|---|---|
| 内部使用 | 3 人持续使用 1 周 | 用户反馈 |
| 核心流程 bug | 0 个 blocker | Bug 追踪 |
| 新用户上手时间 | < 3 分钟 | 用户测试 |
| Docker 部署成功率 | 100% | 自动化测试 |
