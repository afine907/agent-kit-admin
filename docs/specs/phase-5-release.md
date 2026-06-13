# Phase 5: 正式发布 SPEC

## 目标

生产就绪，可公开发布。

## 时间

Week 14-17 (4 周)

## 前置条件

- Phase 4 完成
- 多 Agent 支持可用

---

## 模块 1: 测试

### 1.1 单元测试

| 组件 | 覆盖目标 | 工具 |
|---|---|---|
| Server | > 80% | pytest |
| CLI | > 80% | vitest |
| Web | > 80% | vitest + testing-library |

### 1.2 集成测试

| 测试类型 | 覆盖范围 |
|---|---|
| API 集成 | 核心端点 |
| CLI 集成 | 核心命令 |
| 数据库集成 | CRUD 操作 |

### 1.3 E2E 测试

| 场景 | 测试步骤 |
|---|---|
| 发布流程 | 登录 → 发布 → Web UI 可见 |
| 安装流程 | 搜索 → 安装 → Agent 可用 |
| 团队流程 | 创建团队 → 邀请 → 发布团队包 |

### 1.4 性能测试

| 指标 | 目标 | 工具 |
|---|---|---|
| API QPS | 50 | k6 |
| P95 延迟 | < 200ms | k6 |
| 并发用户 | 100 | k6 |

---

## 模块 2: 文档

### 2.1 用户文档

- [ ] 安装指南
- [ ] 快速开始
- [ ] CLI 命令参考
- [ ] Web UI 使用指南
- [ ] 常见问题

### 2.2 开发文档

- [ ] 贡献指南
- [ ] 开发环境搭建
- [ ] 架构说明
- [ ] API 文档 (OpenAPI)

### 2.3 部署文档

- [ ] Docker 部署
- [ ] 生产环境配置
- [ ] 备份恢复
- [ ] 监控告警

---

## 模块 3: 安全

### 3.1 依赖扫描

- [ ] GitHub Dependabot 配置
- [ ] 自动安全更新
- [ ] 高危漏洞修复流程

### 3.2 容器扫描

- [ ] Trivy 扫描配置
- [ ] CI 集成
- [ ] 高危漏洞阻断

### 3.3 安全审计

- [ ] 第三方安全审计
- [ ] 漏洞修复
- [ ] 安全报告

---

## 模块 4: 运维

### 4.1 监控集成

```yaml
# Prometheus 指标
- http_requests_total
- http_request_duration_seconds
- db_connections_active
- minio_operations_total
```

### 4.2 日志聚合

```json
{
  "timestamp": "2026-01-01T00:00:00Z",
  "level": "info",
  "request_id": "req_123",
  "method": "POST",
  "path": "/api/v1/packages",
  "status": 200,
  "duration_ms": 45
}
```

### 4.3 自动备份

```bash
# 每日备份
0 2 * * * /scripts/backup.sh

# 备份内容:
- PostgreSQL 数据库
- MinIO 包文件
- 配置文件
```

### 4.4 升级工具

```bash
# 数据库迁移
alembic upgrade head

# 配置迁移
./scripts/migrate-config.sh
```

---

## 模块 5: 国际化

### 5.1 CLI 国际化

```bash
# 设置语言
export AKIT_LANG=en

# 或使用参数
akit --lang en install @scope/name
```

### 5.2 Web UI 国际化

- 语言切换组件
- 中英文支持
- 浏览器语言检测

---

## 验收标准

| 场景 | 验收标准 |
|---|---|
| 测试覆盖 | > 80% |
| 文档完整 | 覆盖所有功能 |
| 安全审计 | 无高危漏洞 |
| 性能达标 | P95 < 200ms |
| 生产稳定 | 稳定运行 1 周 |

---

## 周计划

### Week 14: 测试

- [ ] 单元测试补充
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能测试

### Week 15: 文档

- [ ] 用户文档
- [ ] 开发文档
- [ ] API 文档
- [ ] 部署文档

### Week 16: 安全

- [ ] 依赖扫描
- [ ] 容器扫描
- [ ] 安全审计
- [ ] 漏洞修复

### Week 17: 运维 + 国际化

- [ ] 监控集成
- [ ] 日志聚合
- [ ] 自动备份
- [ ] 国际化支持
