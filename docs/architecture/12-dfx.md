# DFX 需求规格

## 概述

DFX (Design for X) 是指在设计阶段就考虑的各种非功能性需求。

---

## DFX-01: 可部署性 (Deployability)

### 目标
中小团队能在 5 分钟内完成部署。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| D-001 | Docker Compose 一键部署 | P0 | `docker compose up -d` 成功启动 |
| D-002 | 自动生成默认密码 | P0 | 首次启动自动生成并输出 |
| D-003 | 自动初始化数据库 | P0 | 无需手动执行迁移 |
| D-004 | 环境变量配置 | P0 | 所有配置通过 .env 文件 |
| D-005 | 健康检查 | P0 | `/api/health` 返回服务状态 |
| D-006 | ARM64 支持 | P1 | Apple Silicon 可运行 |
| D-007 | 离线部署 | P2 | 支持导出镜像离线导入 |

### 最低硬件配置

| 资源 | 最低 | 推荐 |
|---|---|---|
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 2 GB |
| 磁盘 | 10 GB | 50 GB |

### 支持平台

| 平台 | 支持 |
|---|---|
| Linux amd64 | ✅ |
| Linux arm64 | ✅ |
| macOS (Docker Desktop) | ✅ |
| Windows (WSL2) | ✅ |

---

## DFX-02: 可靠性 (Reliability)

### 目标
核心流程 (发布-安装) 成功率 > 99.9%。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| R-001 | 数据库备份 | P0 | 支持手动 `pg_dump` |
| R-002 | 优雅关闭 | P0 | 处理完当前请求再关闭 |
| R-003 | 自动重试 | P0 | CLI 网络请求 3 次重试 |
| R-004 | 配置备份 | P0 | 写入 Agent 配置前备份 |
| R-005 | 事务保证 | P0 | 版本发布原子性 |
| R-006 | 心跳检测 | P1 | 定期检查服务健康 |
| R-007 | 自动恢复 | P1 | 服务崩溃自动重启 |

### 数据持久化

| 数据 | 存储 | 备份策略 |
|---|---|---|
| 用户数据 | PostgreSQL | 每日 pg_dump |
| 包文件 | MinIO | 定期同步 |
| 配置文件 | Docker Volume | 宿主机备份 |

### 故障场景处理

| 场景 | 处理方式 |
|---|---|
| 数据库连接失败 | 返回 503，提示稍后重试 |
| MinIO 连接失败 | 返回 503，包下载不可用 |
| 网络中断 (CLI) | 3 次重试，间隔 1s/2s/4s |
| 磁盘空间不足 | 返回 507，提示联系管理员 |
| 配置文件损坏 | CLI 自动备份并重建 |

---

## DFX-03: 安全性 (Security)

### 目标
满足基本安全要求，无高危漏洞。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| S-001 | HTTPS 传输 | P0 | Caddy 自动 HTTPS |
| S-002 | JWT 认证 | P0 | Token 有效期 24h |
| S-003 | 密码哈希 | P0 | bcrypt 哈希存储 |
| S-004 | 输入验证 | P0 | Pydantic 强校验 |
| S-005 | SQL 注入防护 | P0 | SQLAlchemy ORM |
| S-006 | CORS 配置 | P0 | 限制允许的域名 |
| S-007 | 限流 | P1 | 60 req/min/user |
| S-008 | 日志脱敏 | P1 | 不记录 Token/密码 |
| S-009 | 依赖扫描 | P1 | dependabot 集成 |
| S-010 | 包签名 | P2 | GPG 签名验证 |
| S-011 | 漏洞扫描 | P2 | Trivy 容器扫描 |

### 认证流程

```
用户 → OAuth Provider → 获取 Code → 换取 Token → JWT 签发
                                              ↓
                                        Token 存储 (客户端)
                                              ↓
                                        请求携带 Bearer Token
                                              ↓
                                        服务端验证 JWT
```

### 权限矩阵

| 操作 | 未登录 | 普通用户 | 团队成员 | 团队 Admin | 团队 Owner |
|---|---|---|---|---|---|
| 浏览公开包 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 下载公开包 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 浏览团队包 | ❌ | ❌ | ✅ | ✅ | ✅ |
| 发布包 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 删除自己的包 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 管理团队成员 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 删除团队 | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## DFX-04: 性能 (Performance)

### 目标
满足中小团队使用，无明显卡顿。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| P-001 | API 响应时间 | P0 | P95 < 200ms |
| P-002 | CLI 安装速度 | P0 | 10MB 包 < 5s |
| P-003 | Web 首屏加载 | P0 | < 2s (LCP) |
| P-004 | 数据库连接池 | P0 | pool_size=20 |
| P-005 | 并发支持 | P1 | 50 QPS |
| P-006 | 包搜索响应 | P1 | P95 < 100ms |
| P-007 | 静态资源缓存 | P1 | Caddy 自动缓存 |

### 性能测试场景

| 场景 | 并发数 | 目标 |
|---|---|---|
| 包列表查询 | 50 | P95 < 200ms |
| 包详情查询 | 50 | P95 < 100ms |
| 包下载 | 20 | 带宽跑满 |
| 包发布 | 10 | < 5s (含上传) |

---

## DFX-05: 可维护性 (Maintainability)

### 目标
代码清晰，易于贡献和维护。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| M-001 | 代码规范 | P0 | Python: ruff, TS: oxlint |
| M-002 | 测试覆盖 | P1 | > 60% (MVP) |
| M-003 | CI/CD | P0 | GitHub Actions |
| M-004 | CHANGELOG | P0 | 每个版本记录变更 |
| M-005 | 贡献指南 | P1 | CONTRIBUTING.md |
| M-006 | 架构文档 | P1 | wiki 目录 |
| M-007 | API 文档 | P0 | OpenAPI 自动生成 |
| M-008 | 类型安全 | P0 | Python type hints, TS strict |

### 代码组织

```
agent-kit-admin/
├── server/           # Python 后端
│   ├── app/
│   │   ├── api/      # 路由层 (薄)
│   │   ├── services/ # 业务逻辑层
│   │   ├── models/   # 数据模型层
│   │   └── schemas/  # Pydantic schemas
│   └── tests/
│
├── cli/              # Node.js CLI
│   ├── src/
│   │   ├── commands/ # 命令层
│   │   ├── agents/   # Agent 适配器
│   │   ├── api/      # API 客户端
│   │   └── utils/    # 工具函数
│   └── tests/
│
└── web/              # React 前端
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── hooks/
    │   └── stores/
    └── tests/
```

### 测试策略

| 层 | 测试类型 | 覆盖目标 |
|---|---|---|
| API | 单元测试 + 集成测试 | > 70% |
| CLI | 单元测试 + E2E | > 60% |
| Web | 组件测试 + E2E | > 50% |

---

## DFX-06: 可观测性 (Observability)

### 目标
能快速定位和排查问题。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| O-001 | 结构化日志 | P0 | JSON 格式输出 |
| O-002 | 请求追踪 | P0 | X-Request-ID |
| O-003 | 错误码 | P0 | 统一错误码体系 |
| O-004 | 健康检查 | P0 | /api/health |
| O-005 | 日志级别 | P1 | DEBUG/INFO/WARN/ERROR |
| O-006 | 访问日志 | P1 | Caddy 记录请求 |
| O-007 | 指标暴露 | P2 | Prometheus metrics |
| O-008 | 审计日志 | P1 | 关键操作可追溯 |

### 审计日志

**需要记录审计日志的操作：**

| 操作 | 日志级别 | 记录内容 |
|---|---|---|
| 包发布 | INFO | user_id, package, version, tarball_size |
| 包删除 | WARN | user_id, package, reason |
| 版本撤回 (yank) | WARN | user_id, package, version, reason |
| 团队成员变更 | INFO | operator_id, team_id, target_user_id, action(invite/remove/role_change) |
| API Key 创建 | INFO | user_id, key_name, permissions |
| API Key 删除 | INFO | user_id, key_id |
| 可见性变更 | INFO | user_id, package, old_visibility, new_visibility |

**审计日志格式（扩展结构化日志）：**

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "type": "audit",
  "action": "package.published",
  "request_id": "req-abc123",
  "user_id": "user-uuid",
  "target": "@team/web-search@1.0.0",
  "details": {
    "tarball_size": 1048576,
    "visibility": "public"
  },
  "ip_address": "192.168.1.100"
}
```

**实现方式：**
- MVP 阶段：通过结构化日志输出到 stdout，由 Docker 日志收集
- Phase 2+：可选写入独立的 `audit_logs` 数据库表，支持查询和导出

### 日志格式

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "Package published",
  "request_id": "req-abc123",
  "user_id": "user-uuid",
  "package": "@team/web-search",
  "version": "1.0.0",
  "duration_ms": 150
}
```

### 错误码体系

| 码 | 含义 | HTTP Status |
|---|---|---|
| 10000 | 成功 | 200 |
| 20000 | 参数错误 / 验证失败 | 400 |
| 20001 | 未认证 / Token 过期 | 401 |
| 20002 | 无权限 | 403 |
| 20003 | 资源不存在 | 404 |
| 20004 | 资源冲突 | 409 |
| 20005 | 资源已删除 | 410 |
| 20006 | 请求过于频繁 | 429 |
| 30000 | 内部错误 | 500 |
| 30001 | 数据库错误 | 500 |
| 30002 | 存储服务不可用 | 503 |
| 30003 | 存储空间不足 | 507 |

---

## DFX-07: 可扩展性 (Extensibility)

### 目标
易于添加新功能，不修改核心代码。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| E-001 | Agent 适配器 | P0 | 插件化，新增不改核心 |
| E-002 | OAuth Provider | P0 | 适配器模式 |
| E-003 | 存储后端 | P1 | 接口抽象，可替换 S3 |
| E-004 | 包类型 | P1 | 支持扩展新的包类型 |
| E-005 | Webhook | P2 | 事件驱动扩展 |

### Agent 适配器扩展

```typescript
// 只需实现接口，注册即可
interface AgentAdapter {
  name: string
  detect(): Promise<boolean>
  getConfigPath(): string
  readConfig(): Promise<any>
  writeConfig(entry: MCPEntry): Promise<void>
  removeConfig(name: string): Promise<void>
}

// 注册
agentRegistry.register(new CursorAdapter())
```

---

## DFX-08: 兼容性 (Compatibility)

### 目标
在主流环境下正常运行。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| C-001 | Node.js 兼容 | P0 | >= 18 |
| C-002 | Python 兼容 | P0 | >= 3.11 |
| C-003 | Docker 兼容 | P0 | >= 20.10 |
| C-004 | 浏览器兼容 | P0 | Chrome/Firefox/Safari 最新两版 |
| C-005 | 向后兼容 API | P1 | v1 API 不破坏性变更 |
| C-006 | 配置迁移 | P1 | 升级时自动迁移配置 |

---

## DFX-09: 国际化 (i18n)

### 目标
MVP 中文优先，v1.0 支持英文。

### 需求

| ID | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| I-001 | CLI 中文输出 | P0 | 默认中文 |
| I-002 | Web UI 中文 | P0 | 默认中文 |
| I-003 | 错误提示中文 | P0 | 用户可见的错误中文 |
| I-004 | CLI 英文支持 | P2 | `--lang=en` 参数 |
| I-005 | Web UI 英文 | P2 | 语言切换功能 |

---

## DFX 检查清单

### MVP 发布前必须满足

- [ ] D-001: Docker Compose 一键部署
- [ ] D-002: 自动生成默认密码
- [ ] D-003: 自动初始化数据库
- [ ] D-005: 健康检查端点
- [ ] R-001: 数据库备份支持
- [ ] R-004: 配置写入前备份
- [ ] S-001: HTTPS 传输
- [ ] S-002: JWT 认证
- [ ] S-004: 输入验证
- [ ] P-001: API 响应 < 200ms
- [ ] P-003: Web 首屏 < 2s
- [ ] M-001: 代码规范配置
- [ ] M-003: CI/CD 配置
- [ ] M-007: API 文档生成
- [ ] O-001: 结构化日志
- [ ] O-004: 健康检查端点
- [ ] E-001: Agent 适配器设计
- [ ] C-001: Node.js >= 18
- [ ] I-001: CLI 中文输出
