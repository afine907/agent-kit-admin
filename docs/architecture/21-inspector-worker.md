# 21 - Inspector Worker 设计

## 概述

Inspector Worker 是 Agent Kit Admin 的后台巡检服务，独立于 FastAPI Server 进程运行。它定时 + 事件触发检测平台上所有 Skill 包的健康状态，四维检测（静态合规、内容可访问、LLM 功能实测、版本新鲜度），问题包自动标记为 `degraded`。

## 架构

```
FastAPI Server                          Worker Process
┌──────────────────┐                    ┌──────────────────┐
│  API Layer       │                    │  APScheduler     │
│  /api/v1/health/*│                    │  - daily cron    │
│  (手动触发/查询)  │                    │  - poll pending  │
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
         │ 共享 DB + Services                    ▼
         │                              ┌──────────────────┐
         ▼                              │ InspectorService │
┌──────────────────┐                    │ - compliance     │
│   PostgreSQL     │◄───────────────────│ - content        │
│   (共享数据库)    │                    │ - functional     │
└──────────────────┘                    │ - freshness      │
                                        └──────────────────┘
```

## 启动

```bash
# FastAPI Server (现有)
python -m app.main

# Inspector Worker (新增)
python -m app.worker
```

## 触发机制

| 事件 | 触发方式 | LLM 实测 |
|------|----------|----------|
| 定时巡检（凌晨 2 点） | APScheduler cron | 采样 20% |
| 新包发布 | DB `needs_check=true` | ✅ 全量 |
| 版本更新 | DB `needs_check=true` | ✅ 全量 |
| 手动「重新检测」 | API → `needs_check=true` | ✅ 全量 |

## 四维检测

| 维度 | 文件 | 成本 |
|------|------|------|
| A. 静态合规 | `checks/compliance.py` | 零 IO |
| B. 内容可访问 | `checks/content.py` | MinIO HEAD |
| C. LLM 功能实测 | `checks/functional.py` | Token 消耗 |
| E. 版本新鲜度 | `checks/freshness.py` | 零 IO |

## 数据模型

- `agent_health_check` 表：每次检测结果
- `packages.health_status`：冗余缓存最新状态
- `packages.needs_check`：触发队列标记

## 配置

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `INSPECTOR_SAMPLE_RATE` | 0.2 | 调度触发采样比例 |
| `INSPECTOR_CRON_HOUR` | 2 | 定时巡检小时 |
| `INSPECTOR_MAX_LLM_PER_RUN` | 50 | 单次最多 LLM 测试数 |
| `INSPECTOR_POLL_INTERVAL` | 30 | needs_check 轮询间隔(秒) |

## Docker Compose

Worker 作为独立服务部署，使用 `profiles: ["prod"]` 与 server 一起启动：

```yaml
worker:
  profiles: ["prod"]
  build:
    context: ../../apps/server
    dockerfile: Dockerfile
  command: python -m app.worker
```

## 文件结构

```
apps/server/app/
├── worker.py              # 独立进程入口
├── inspect/
│   ├── scheduler.py       # APScheduler 配置
│   ├── inspector.py       # 编排服务
│   ├── events.py          # 触发标记
│   └── checks/
│       ├── compliance.py  # A. 静态合规
│       ├── content.py     # B. 内容可访问
│       ├── functional.py  # C. LLM 实测
│       └── freshness.py   # E. 版本新鲜度
├── api/
│   └── health.py          # 健康检测 API
├── schemas/
│   └── health_check.py    # 响应模型
└── models/
    └── health_check.py    # 检测结果表
```
