# 迭代三：功能补齐计划

> 基于设计文档与当前代码库的 Gap Analysis，2026-06-15 生成

---

## 一、目标

补齐设计文档中已定义但尚未实现的功能，使系统达到 MVP 完整可用状态。

---

## 二、任务清单

### 🔴 P0 — 核心流程缺陷

| # | 功能 | 设计文档 | 现状 | 工作量 |
|---|------|---------|------|--------|
| 1 | **API Key 认证中间件** | `05-api-design.md`、`07-auth-design.md` | CRUD 端点 + `verify_key` 方法存在，但 `deps.py` 拒绝 `akit_` token | S |
| 2 | **评价/评分系统** | `05-api-design.md` Reviews 章节 | `Review` 模型存在，无 API 路由、无 Web UI | M |
| 3 | **团队管理** | `05-api-design.md` Team Management 章节 | 无 Team 模型、无 API、无页面 | L |
| 4 | **包下载统计端点** | `05-api-design.md` Stats 章节 | `downloads` 表有数据，`GET /packages/:scope/:name/stats` 未实现 | S |

### 🟡 P1 — 可靠性 & UX 缺陷

| # | 功能 | 设计文档 | 现状 | 工作量 |
|---|------|---------|------|--------|
| 5 | **API 限流中间件** | `05-api-design.md` Rate Limit 章节 | 仅登录失败限流，无通用限流 | M |
| 6 | **CLI 下载重试** | `13-edge-cases.md` EC-04 | 无 retry 逻辑，需指数退避 | S |
| 7 | **CLI 文件锁** | `13-edge-cases.md` EC-11 | 无 flock/lockfile 机制 | S |
| 8 | **CLI 缺失选项** | `06-cli-design.md` | `publish` 缺 `--tag`/`--dry-run`；`install` 缺 `--global`/`--agent`/`--no-config` | S |
| 9 | **`akit setup-claude-skill` 命令** | `17-akit-skill-design.md` | skill 文件存在，无自动安装命令 | S |

### 🟢 P2 — 边界情况处理

| # | 功能 | 设计文档 | 现状 | 工作量 |
|---|------|---------|------|--------|
| 10 | **CLI 配置文件损坏恢复** | `13-edge-cases.md` EC-02/EC-03 | 无损坏备份/恢复逻辑 | S |
| 11 | **CLI 包大小预检** | `13-edge-cases.md` EC-14 | 服务端限制 50MB，CLI 无 100MB 预检 | S |
| 12 | **用户名冲突自动编号** | `13-edge-cases.md` EC-18 | 直接 409 拒绝，无 `-2` 后缀自动追加 | S |
| 13 | **版本号自动递增建议** | `13-edge-cases.md` EC-20 | `publish` 不建议下一个 patch 版本号 | S |
| 14 | **429 响应 + `Retry-After` 头** | `05-api-design.md` | 无此响应格式 | S |
| 15 | **依赖解析 & 循环检测** | `13-edge-cases.md` EC-12/EC-13 | `dependencies` 字段存在但无解析逻辑 | M |

### 🔵 P3 — Web UI 补齐

| # | 功能 | 设计文档 | 现状 | 工作量 |
|---|------|---------|------|--------|
| 16 | **包评价 UI** | `05-api-design.md` | 无评分/评价提交和展示 | M |
| 17 | **包下载统计展示** | `05-api-design.md` Stats 章节 | 公开包详情页无下载量展示 | S |
| 18 | **评分分布图** | `05-api-design.md` | 无 | S |
| 19 | **用户设置页** | `09-roadmap.md` v0.3.0 | 仅 Profile 页基础编辑 | M |
| 20 | **团队管理页** | `09-roadmap.md` v0.3.0 | 无 | L |
| 21 | **Web 发布向导** | `09-roadmap.md` v0.3.0 | 发布仅支持 CLI | L |

---

## 三、详细说明

### 1. API Key 认证中间件

**现状**：`apps/server/app/deps.py` 第 46-48 行，检测到 `akit_` 前缀后直接抛出 401。

**实现方案**：
- 在 `deps.py` 的 `get_current_user` 中，调用 `ApiKeyService.verify_key()`
- 验证通过后关联到对应 User 对象
- 记录 API Key 使用时间（`last_used_at`）

**影响范围**：所有需要认证的 API 端点，CI/CD 流程

---

### 2. 评价/评分系统

**现状**：`apps/server/app/models/review.py` 模型存在，无 API。

**实现方案**：
- **Server**：新建 `apps/server/app/api/reviews.py` + `apps/server/app/services/review.py`
  - `GET /packages/:scope/:name/reviews` — 分页列表
  - `POST /packages/:scope/:name/reviews` — 创建评价（需登录，每人一包一评）
  - `PUT /packages/:scope/:name/reviews/:id` — 更新自己的评价
  - `DELETE /packages/:scope/:name/reviews/:id` — 删除自己的评价
  - 包评分自动聚合（`rating` 字段更新）
- **Web**：在 `PackageDetail.tsx` 添加评价列表、星级评分、提交表单

---

### 3. 团队管理

**现状**：完全未实现。

**实现方案**：
- **Server**：
  - 新建 `apps/server/app/models/team.py`（Team + TeamMember 模型）
  - 新建 `apps/server/app/api/teams.py`（CRUD + 成员管理）
  - 新建 `apps/server/app/services/team.py`
  - 包可见性 `team` 逻辑：仅团队成员可访问
  - 命名空间：`@team-slug` 与 `@username` 不冲突
- **Web**：团队列表、创建、成员管理页面
- **数据库**：新增 Alembic migration

---

### 4. 包下载统计端点

**现状**：`Download` 模型 + 后台任务已存在，仅 Admin 有聚合查询。

**实现方案**：
- `GET /packages/:scope/:name/stats` — 返回最近 N 天下载趋势、总下载量
- 在 `PackageDetail.tsx` 展示下载量折线图

---

### 5. API 限流中间件

**实现方案**：
- 基于内存（单实例）或 Redis（多实例）的滑动窗口限流
- 中间件按端点分组：auth 10/min、packages 60/min、download 100/min、publish 10/min
- 响应 `429 Too Many Requests` + `Retry-After` 头

---

### 6. CLI 下载重试

**实现方案**：
- 在 `apps/cli/src/api/client.ts` 添加 axios-retry 拦截器
- 3 次重试，指数退避（1s → 2s → 4s）
- 仅对 5xx 和网络错误重试

---

### 7. CLI 文件锁

**实现方案**：
- `install`/`uninstall` 写入 `mcp.json` 前获取 lockfile
- 使用 `proper-lockfile` 包，超时 10s
- 死锁自动释放

---

### 8. CLI 缺失选项

**实现方案**：

| 命令 | 选项 | 行为 |
|------|------|------|
| `publish` | `--tag <name>` | 设置版本 tag（latest/next/beta） |
| `publish` | `--dry-run` | 仅验证打包，不上传 |
| `install` | `--global` | 全局安装 |
| `install` | `--agent <name>` | 指定 Agent 写入配置 |
| `install` | `--no-config` | 仅下载，不写 Agent 配置 |

---

### 9-15. 其他 P1/P2 功能

详见各设计文档章节，均为小工作量改动，可穿插在主要任务中完成。

---

## 四、里程碑建议

| 阶段 | 范围 | 预计周期 |
|------|------|---------|
| **3.1** | #1 API Key 认证 + #4 包统计端点 + #8 CLI 选项 + #6 下载重试 | 1 周 |
| **3.2** | #2 评价系统（全栈） + #5 限流中间件 | 1.5 周 |
| **3.3** | #3 团队管理（全栈） + #16-21 Web UI 补齐 | 2 周 |
| **3.4** | #7 文件锁 + #9-15 边界情况处理 | 1 周 |

**总计预估**：5-6 周

---

## 五、依赖关系

```
API Key 认证 (#1) ──→ CI/CD 流程可用
团队管理 (#3)   ──→ 包可见性 team 逻辑 ──→ 团队管理页 (#20)
评价系统 (#2)   ──→ 评价 UI (#16) + 评分分布图 (#18)
包统计端点 (#4) ──→ 包下载统计展示 (#17)
API 限流 (#5)   ──→ 429 响应 (#14)
```

---

## 六、风险项

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 团队管理复杂度高 | 影响迭代周期 | 3.3 独立阶段，可延后 |
| Redis 引入增加运维成本 | 部署复杂度 | 先用内存实现，文档标注多实例限制 |
| API Key 认证安全性 | CI/CD 安全 | 实现后需安全审查 |
