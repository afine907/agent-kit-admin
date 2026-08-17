# Agent Health Inspector 设计文档

> 创建日期：2026-08-17
> 状态：待实现
> 作者：Claude + ppp07

## 1. 背景与目标

### 1.1 背景

Agent Kit Admin 是团队级 Agent Skill 管理平台。当前核心功能（CRUD Skill 包、Test Agent 对话）已就绪，但缺少**自动化质量保障**机制。随着平台上 Skill 数量增长，需要独立运行的巡检服务来自动检测 Skill 是否存在问题。

### 1.2 目标

- 新增独立 Worker 进程，定时 + 事件触发检测平台上所有 Skill 的健康状态
- 四维检测：静态合规、内容可访问、LLM 功能实测、版本新鲜度
- 问题 Skill 自动标记为 `degraded`，前端展示警告
- 支持手动触发「重新检测」
- 控制 LLM Token 消耗成本

### 1.3 非目标

- 不检测 Skill 调用的外部 API/依赖可达性（D 维度）
- 不下架问题包，仅标记降级
- 不做实时检测（分钟级延迟可接受）

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│  FastAPI Server (已有, app/main.py)                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  API Layer                                      │    │
│  │  - /api/v1/packages/*  (包管理)                 │    │
│  │  - /api/v1/agent/chat  (Test Agent, 已有)        │    │
│  │  - /api/v1/health/*   (健康检测 API, 新增)       │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Service Layer                                  │    │
│  │  - PackageService (已有)                        │    │
│  │  - VersionService (已有)                        │    │
│  │  - AgentChatService (已有, 复用做 LLM 实测)      │    │
│  │  - HealthCheckService (新增)                    │    │
│  └─────────────────────────────────────────────────┘    │
│                        │                                 │
│                        │ 写 needs_check=true             │
│                        │ 读 health_status                │
└────────────────────────┼────────────────────────────────┘
                         │
                         ▼
               ┌──────────────────┐
               │   PostgreSQL     │
               │  (共享数据库)     │
               └────────┬─────────┘
                        │
┌───────────────────────┼─────────────────────────────────┐
│  Worker Process (新增, app/worker.py)                    │
│                       ▼                                  │
│  ┌──────────────────────────────────────────────┐       │
│  │  APScheduler                                  │       │
│  │  - 每日凌晨 2:00 采样巡检 (cron)               │       │
│  │  - 每 30s 轮询 needs_check (interval)          │       │
│  └──────────────────┬───────────────────────────┘       │
│                     ▼                                    │
│  InspectorService                                        │
│  ├─ check_compliance()   A. 静态合规                     │
│  ├─ check_content()      B. 内容可访问                   │
│  ├─ check_functional()   C. LLM 功能实测                 │
│  └─ check_freshness()    E. 版本新鲜度                   │
│                     │                                    │
│                     ▼                                    │
│  → 写 agent_health_check 表                              │
│  → 更新 packages.health_status                           │
│  → 更新 packages.needs_check = false                     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 组件职责

| 组件 | 文件 | 职责 |
|------|------|------|
| Worker 入口 | `app/worker.py` | 独立进程入口，启动 APScheduler + 主循环 |
| Scheduler | `app/inspect/scheduler.py` | APScheduler 配置、任务注册 |
| Inspector | `app/inspect/inspector.py` | 主检测逻辑，编排四个维度 |
| Compliance | `app/inspect/checks/compliance.py` | A. manifest schema 校验 |
| Content | `app/inspect/checks/content.py` | B. MinIO tarball 可下载 + content 可解析 |
| Functional | `app/inspect/checks/functional.py` | C. LLM 功能实测 |
| Freshness | `app/inspect/checks/freshness.py` | E. 版本更新时间检查 |
| Events | `app/inspect/events.py` | 发布/版本更新时标记 needs_check |
| Health API | `app/api/health.py` | 手动触发 + 查询结果 |
| Model | `app/models/health_check.py` | agent_health_check 表 |
| Schema | `app/schemas/health_check.py` | 请求/响应模型 |

### 2.3 进程启动

```bash
# 现有：FastAPI Server
python -m app.main
# 或生产环境：gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker

# 新增：Inspector Worker
python -m app.worker
```

### 2.4 Docker Compose 新增

```yaml
# deploy/docker/docker-compose.yml
worker:
  build:
    context: ./server
    dockerfile: Dockerfile
  restart: unless-stopped
  depends_on:
    db:
      condition: service_healthy
    minio:
      condition: service_healthy
  environment:
    DATABASE_URL: ${DATABASE_URL}
    MINIO_ENDPOINT: ${MINIO_ENDPOINT}
    MINIO_ROOT_USER: ${MINIO_ROOT_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    MINIO_BUCKET: ${MINIO_BUCKET}
    MINIO_SECURE: ${MINIO_SECURE:-false}
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    OPENAI_BASE_URL: ${OPENAI_BASE_URL}
    OPENAI_MODEL: ${OPENAI_MODEL}
    OPENAI_MAX_TOKENS: ${OPENAI_MAX_TOKENS:-500}
    INSPECTOR_SAMPLE_RATE: ${INSPECTOR_SAMPLE_RATE:-0.2}
    INSPECTOR_CRON_HOUR: ${INSPECTOR_CRON_HOUR:-2}
    INSPECTOR_MAX_LLM_PER_RUN: ${INSPECTOR_MAX_LLM_PER_RUN:-50}
    INSPECTOR_POLL_INTERVAL: ${INSPECTOR_POLL_INTERVAL:-30}
  command: python -m app.worker
```

---

## 3. 数据模型

### 3.1 表：`agent_health_check`

```python
class AgentHealthCheck(Base):
    __tablename__ = "agent_health_checks"

    id            = mapped_column(String, primary_key=True)          # UUID
    package_id    = mapped_column(FK("packages.id"), index=True)       # 关联包
    version       = mapped_column(String(50))                         # 检测的版本号

    # 四维检测结果
    compliance_status  = mapped_column(String(10))   # pass / fail / error
    compliance_detail  = mapped_column(JSONB, default={})
    content_status     = mapped_column(String(10))   # pass / fail / error
    content_detail     = mapped_column(JSONB, default={})
    functional_status  = mapped_column(String(10))   # pass / fail / skip / error
    functional_detail  = mapped_column(JSONB, default={})
    freshness_status   = mapped_column(String(10))   # pass / warn / error
    freshness_detail   = mapped_column(JSONB, default={})

    # 综合状态
    overall_status     = mapped_column(String(10), index=True)
    # healthy / degraded / error

    # 触发来源
    trigger_type       = mapped_column(String(20))
    # scheduled / publish / version_update / manual

    # Token 消耗统计
    llm_tokens_used    = mapped_column(Integer, default=0)

    # 时间戳
    created_at         = mapped_column(DateTime, default=func.now(), index=True)
```

### 3.2 包表新增字段

```python
class Package(Base):
    # ... 现有字段不变 ...

    # 巡检状态冗余缓存
    health_status   = mapped_column(String(10), default="pending", index=True)
    # pending / healthy / degraded / error

    needs_check     = mapped_column(Boolean, default=False, index=True)
    last_check_at   = mapped_column(DateTime, nullable=True)
```

### 3.3 触发-拾取流程

```
Server 端 (events.py)                         Worker 端
─────────────────                             ──────────
publish / version_update
  → UPDATE packages
     SET needs_check=true

manual trigger (API)
  → UPDATE packages
     SET needs_check=true

                                          worker 轮询 (每 30s):
                                          SELECT * FROM packages
                                          WHERE needs_check = true
                                            → 执行四维检测
                                            → INSERT agent_health_check
                                            → UPDATE packages
                                               SET health_status = overall,
                                                   needs_check = false,
                                                   last_check_at = now()
```

**设计决策：不用消息队列。** 理由：
- 团队级规模，DB 轮询 30s 延迟足够
- 零额外组件
- `needs_check` 是天然去重队列

---

## 4. 检测逻辑详设

### 4.1 A. 静态合规（`compliance.py`）

```python
async def check_compliance(package, version) -> CheckResult:
    """manifest schema 校验"""
    errors = []

    # 1. 解析 manifest JSON
    try:
        manifest = json.loads(version.manifest)
    except json.JSONDecodeError as e:
        return CheckResult(status="fail", detail={"error": f"manifest JSON 解析失败: {e}"})

    # 2. 必填字段
    for field in ["name", "version", "type"]:
        if field not in manifest:
            errors.append(f"缺少必填字段: {field}")

    # 3. 类型必须是 skill
    if manifest.get("type") != "skill":
        errors.append(f"类型必须是 skill，实际为: {manifest.get('type')}")

    # 4. semver 版本号校验
    if not semver_valid(manifest.get("version", "")):
        errors.append("version 不符合 semver 规范")

    # 5. skill.content 大小限制
    content = manifest.get("skill", {}).get("content", "")
    if len(content) > 50000:
        errors.append(f"skill content 超过 50KB: {len(content)} bytes")

    return CheckResult(
        status="fail" if errors else "pass",
        detail={"errors": errors, "manifest_valid": len(errors) == 0},
    )
```

**成本：** 零 IO，纯内存操作。

### 4.2 B. 内容可访问（`content.py`）

```python
async def check_content(package, version, storage) -> CheckResult:
    """MinIO tarball 可下载 + content 可解析"""

    # 1. tarball 存在性
    tarball_key = f"packages/{package.id}/{version.version}.tar.gz"
    exists = await storage.object_exists(tarball_key)
    if not exists:
        return CheckResult(status="fail", detail={"error": f"tarball 不存在: {tarball_key}"})

    # 2. 复用 VersionService.get_skill_content 解析
    try:
        content, source = await version_service.get_skill_content(
            str(package.id), version.version
        )
    except Exception as e:
        return CheckResult(status="fail", detail={"error": f"content 解析失败: {e}"})

    # 3. content 非空
    if not content or not content.strip():
        return CheckResult(status="fail", detail={"error": "skill content 为空"})

    return CheckResult(status="pass", detail={"source": source, "content_length": len(content)})
```

**成本：** 1 次 MinIO HEAD + 1 次 GET（content < 50KB）。

### 4.3 C. LLM 功能实测（`functional.py`）

```python
_FUNCTIONAL_TEST_PROMPT = "请用一句话说明这个 Skill 能做什么，并给出一个使用示例。"

async def check_functional(package, version, db) -> CheckResult:
    """调 Test Agent 跑标准问答，验证 Skill content 有效"""

    content, _ = await version_service.get_skill_content(str(package.id), version.version)

    # 构造 system prompt（复用 AgentChatService 模板）
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(
        package_name=package.name,
        description=package.description or "-",
        content=content,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": _FUNCTIONAL_TEST_PROMPT},
    ]

    # 非流式调用，收集完整回复
    service = AgentChatService(db)
    full_response = ""

    async for item in service.stream_chat(
        scope=package.scope, name=package.name,
        version=version.version, messages=messages,
    ):
        if item["type"] == "delta":
            full_response += item["text"]

    # 判定
    passed = _evaluate_response(full_response)

    return CheckResult(
        status="pass" if passed else "fail",
        detail={
            "prompt": _FUNCTIONAL_TEST_PROMPT,
            "response": full_response[:500],
            "response_length": len(full_response),
        },
    )

def _evaluate_response(response: str) -> bool:
    """判定 LLM 回复是否有效"""
    if len(response.strip()) < 20:
        return False
    if "超出" in response and "范围" in response:
        return False
    return True
```

**成本控制：**
- `max_tokens=500`（限制输出长度）
- 调度触发时采样（默认 20%）
- 发布/更新触发时全量
- 单次巡检最多 LLM 测试数可配置（默认 50）

### 4.4 E. 版本新鲜度（`freshness.py`）

```python
async def check_freshness(package, version) -> CheckResult:
    """版本更新时间检查"""

    last_update = version.created_at or package.created_at
    days_since = (datetime.utcnow() - last_update).days

    warn_days = 180  # 半年未更新 → warn

    if days_since > warn_days:
        return CheckResult(
            status="warn",
            detail={"last_update_days": days_since, "message": f"{days_since} 天未更新"},
        )

    return CheckResult(status="pass", detail={"last_update_days": days_since})
```

**成本：** 零 IO，纯 DB 读取。

### 4.5 综合判定

```python
def overall_status(results: list[CheckResult]) -> str:
    statuses = [r.status for r in results]
    if "error" in statuses:
        return "error"
    if "fail" in statuses:
        return "degraded"
    if "warn" in statuses:
        return "degraded"
    return "healthy"
```

---

## 5. 调度设计

### 5.1 APScheduler 配置

```python
# app/inspect/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

def create_scheduler(inspector) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()

    # 每日凌晨 2:00 采样巡检
    scheduler.add_job(
        inspector.run_sampled_check,
        trigger=CronTrigger(
            hour=settings.INSPECTOR_CRON_HOUR,
            minute=settings.INSPECTOR_CRON_MINUTE,
        ),
        id="daily_inspection",
        replace_existing=True,
    )

    # 每 30s 轮询 needs_check
    scheduler.add_job(
        inspector.process_pending_checks,
        trigger=IntervalTrigger(seconds=settings.INSPECTOR_POLL_INTERVAL),
        id="pending_check_poller",
        replace_existing=True,
    )

    return scheduler
```

### 5.2 触发矩阵

| 事件 | 触发方式 | 是否 LLM 实测 | 优先级 |
|------|----------|---------------|--------|
| 定时巡检（凌晨 2 点） | APScheduler cron | 采样 20% | 低 |
| 新包发布 | events → needs_check | ✅ 全量 | 高 |
| 版本更新 | events → needs_check | ✅ 全量 | 高 |
| 手动「重新检测」 | API → needs_check | ✅ 全量 | 高 |

### 5.3 采样逻辑

```python
async def run_sampled_check(self):
    """调度触发：采样检测"""
    packages = await self.get_all_skill_packages()
    sample_size = max(1, int(len(packages) * settings.INSPECTOR_SAMPLE_RATE))
    sampled = random.sample(packages, sample_size)

    # 限制单次 LLM 测试数
    llm_count = 0
    for pkg in sampled:
        if llm_count >= settings.INSPECTOR_MAX_LLM_PER_RUN:
            break
        await self.inspect_package(pkg, trigger="scheduled")
        llm_count += 1
```

### 5.4 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `INSPECTOR_SAMPLE_RATE` | 0.2 | 调度触发时采样比例 |
| `INSPECTOR_CRON_HOUR` | 2 | 定时巡检小时（凌晨） |
| `INSPECTOR_CRON_MINUTE` | 0 | 定时巡检分钟 |
| `INSPECTOR_MAX_LLM_PER_RUN` | 50 | 单次巡检最多 LLM 测试数 |
| `INSPECTOR_POLL_INTERVAL` | 30 | needs_check 轮询间隔（秒） |

---

## 6. API 设计

### 6.1 手动触发检测

```
POST /api/v1/health/check/{scope}/{name}
认证：是（包所有者或管理员）

Response 200:
{
  "message": "已加入检测队列",
  "status": "queued"
}
```

### 6.2 获取最新检测结果

```
GET /api/v1/health/check/{scope}/{name}
认证：是

Response 200:
{
  "data": {
    "overall": "healthy",
    "compliance": {"status": "pass", "detail": {"errors": [], "manifest_valid": true}},
    "content": {"status": "pass", "detail": {"source": "inline", "content_length": 1024}},
    "functional": {"status": "pass", "detail": {"prompt": "...", "response": "...", "response_length": 150}},
    "freshness": {"status": "pass", "detail": {"last_update_days": 30}},
    "checked_at": "2026-08-17T02:00:00Z",
    "trigger": "scheduled"
  }
}
```

### 6.3 平台健康概览

```
GET /api/v1/health/overview
认证：是（管理员）

Response 200:
{
  "data": {
    "total": 100,
    "healthy": 85,
    "degraded": 12,
    "error": 3,
    "pending": 5,
    "last_run_at": "2026-08-17T02:00:00Z"
  }
}
```

---

## 7. 前端设计

### 7.1 包详情页健康状态卡片

新增组件 `HealthCheckBadge`，嵌入 `PackageDetail.tsx`：

**健康状态：**
```
┌─────────────────────────────────┐
│  ✅ Skill 健康                   │
│  ├─ 静态合规: ✓ pass            │
│  ├─ 内容可访问: ✓ pass          │
│  ├─ 功能实测: ✓ pass (LLM)      │
│  └─ 版本新鲜度: ✓ 30天前更新     │
│                                 │
│  检测时间: 2026-08-17 02:00     │
│  [🔄 重新检测]                   │
└─────────────────────────────────┘
```

**降级状态：**
```
┌─────────────────────────────────┐
│  ⚠️ Skill 状态异常              │
│  ├─ 静态合规: ✗ content 超 50KB │
│  ├─ 内容可访问: ✓ pass          │
│  ├─ 功能实测: ✗ LLM 拒绝回答    │
│  └─ 版本新鲜度: ⚠ 200天未更新   │
│                                 │
│  [🔄 重新检测]                   │
└─────────────────────────────────┘
```

### 7.2 平台健康概览页

新增页面 `/admin/health`（管理员）：

- 总数 / 健康 / 降级 / 异常 / 待检 统计卡
- 最近检测历史表格
- 筛选：只看异常 / 按 scope

### 7.3 现有页面集成

| 页面 | 集成点 |
|------|--------|
| `PackageDetail.tsx` | 右上角嵌入 `HealthCheckBadge` |
| `Home.tsx` | 管理员可见平台健康概览入口 |
| `Agent.tsx` | degraded 状态顶部提示横幅 |

---

## 8. 错误处理

### 8.1 进程级

```python
# app/worker.py
async def main():
    settings = get_settings()
    inspector = InspectorService(...)
    scheduler = create_scheduler(inspector)
    scheduler.start()
    try:
        await inspector.run_forever()
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("worker crashed")
        raise  # Docker restart 策略接管
    finally:
        scheduler.shutdown()
```

### 8.2 维度级

```python
# 单个维度异常不影响其他维度
async def run_check(package, version) -> list[CheckResult]:
    results = []
    for check_fn in [check_compliance, check_content, check_functional, check_freshness]:
        try:
            result = await asyncio.wait_for(check_fn(package, version), timeout=60)
        except asyncio.TimeoutError:
            result = CheckResult(status="error", detail={"error": "检测超时 (60s)"})
        except Exception as e:
            logger.exception("check failed: %s", check_fn.__name__)
            result = CheckResult(status="error", detail={"error": str(e)})
        results.append(result)
    return results
```

### 8.3 LLM 特殊处理

| 场景 | 处理 |
|------|------|
| OPENAI_API_KEY 未配置 | 跳过 functional 维度，status=skip |
| LLM 上游超时/5xx | 重试 1 次（间隔 5s），仍失败则 status=error |
| Token 超限 | 截断到 max_tokens=500 |
| Agent 拒绝回答 | status=fail（Skill content 无效） |

---

## 9. 测试策略

### 9.1 测试文件组织

```
apps/server/tests/inspect/
├── __init__.py
├── conftest.py              # 共享 fixtures
├── test_compliance.py       # A 维度单元测试
├── test_content.py          # B 维度单元测试
├── test_functional.py       # C 维度单元测试
├── test_freshness.py        # E 维度单元测试
├── test_inspector.py        # 综合判定 + 编排逻辑
├── test_trigger_flow.py     # needs_check 触发 → 拾取 → 写回
├── test_integration.py      # 完整流程（mock LLM）
└── test_api.py              # API 端到端测试
```

### 9.2 Mock 策略

```python
# 复用 AgentChatService 已有的 llm_client 注入模式
@pytest.fixture
def mock_llm_client():
    """模拟 LLM 返回正常回复"""
    client = AsyncMock()
    client.stream.return_value = mock_sse_stream([
        {"choices": [{"delta": {"content": "这是一个搜索 Skill，用于网页搜索。示例：搜索最新新闻。"}}]},
    ])
    return client

@pytest.fixture
def mock_llm_client_refuse():
    """模拟 LLM 拒绝回答"""
    client = AsyncMock()
    client.stream.return_value = mock_sse_stream([
        {"choices": [{"delta": {"content": "这超出了我的能力范围。"}}]},
    ])
    return client
```

### 9.3 覆盖目标

| 测试类型 | 覆盖点 |
|----------|--------|
| 单元测试 | 每个 check 函数的 pass/fail/error 路径 |
| 单元测试 | `overall_status` 综合判定（含 warn → degraded） |
| 集成测试 | 完整巡检流程（mock LLM） |
| 集成测试 | needs_check 触发 → worker 拾取 → 写回 DB |
| API 测试 | 手动触发 + 查询结果 + 权限校验 |

---

## 10. 实施计划概览

> 详细实现计划由 writing-plans skill 生成，此处仅列大纲。

### Phase 1: 基础骨架
- 数据模型（`AgentHealthCheck` + `Package` 新字段）
- Worker 入口 + APScheduler 基础配置
- 空壳 InspectorService

### Phase 2: 检测逻辑
- 四个 check 函数实现
- 综合判定逻辑
- 单元测试

### Phase 3: 触发与调度
- events.py（发布/版本更新触发）
- needs_check 轮询拾取
- 采样逻辑

### Phase 4: API + 前端
- Health API 端点
- HealthCheckBadge 组件
- 平台健康概览页

### Phase 5: 集成与部署
- Docker Compose worker 服务
- 环境变量配置
- 集成测试 + E2E 测试

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM Token 成本过高 | 运营成本 | 采样策略 + max_tokens 限制 + 可配置上限 |
| Worker 进程挂掉 | 检测中断 | Docker restart=unless-stopped + 异常日志 |
| 大量包同时发布 | 队列积压 | needs_check 去重 + 30s 轮询足够快 |
| LLM 服务不稳定 | 误判为 Skill 问题 | 重试 1 次 + status=error 不等于 fail |
| DB 轮询增加负载 | 性能 | needs_check 有索引，只查少量 pending 行 |

---

## 12. 待解决问题

| # | 问题 | 决策 |
|---|------|------|
| 1 | `main.py` 的 merge conflict（webhooks vs agent router）需要先解决 | 实施前修复 |
| 2 | 现有 `AgentChatService` 的 `stream_chat` 是生成器，worker 中需要非流式调用 | 直接消费生成器收集完整文本 |
| 3 | 是否需要 alembic migration 还是继续用 `create_all` | 项目当前用 `create_all`，保持一致 |
