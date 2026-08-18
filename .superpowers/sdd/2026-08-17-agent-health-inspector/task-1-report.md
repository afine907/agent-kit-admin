# Task 1 Report: 数据库模型与配置

**Status:** DONE

## 任务目标

创建 Inspector Worker 子系统所需的数据模型和配置：AgentHealthCheck 模型、Package 健康字段、INSPECTOR_* 配置项。

## 变更文件

### 新增
- `apps/server/app/models/health_check.py` — AgentHealthCheck 模型（表 `agent_health_checks`）
- `apps/server/tests/inspect/__init__.py` — 测试包初始化
- `apps/server/tests/inspect/test_models.py` — 模型测试（2 个用例）

### 修改
- `apps/server/app/models/package.py` — 添加 `Boolean` 导入 + 3 个健康字段（health_status / needs_check / last_check_at）
- `apps/server/app/models/__init__.py` — 导入并导出 AgentHealthCheck
- `apps/server/app/config.py` — 添加 5 个 INSPECTOR_* 配置项

## 提交记录

```
17e432d feat(server): AgentHealthCheck 模型与 Package 健康字段 (Inspector Task 1)
```

## 测试结果

- Task 测试：**2 passed** (tests/inspect/test_models.py)
- 全量套件：**452 passed, 1 skipped**（1 个预存在的 skip，无新增失败）
- 耗时：88.96s

## 质量门禁

- `ruff check`：All checks passed
- `ruff format --check`：4 files already formatted

## 技术决策说明

1. **UUID 主键**：使用 `CompatUUID` + `default=uuid.uuid4` + `server_default=func.gen_random_uuid()`，与现有 Package/Version 模型保持完全一致的双数据库兼容模式。
2. **CompatJSONB detail 字段**：使用 `nullable=False, default=dict`，与现有 `manifest` 字段风格一致（而非 `nullable=True`）。
3. **列顺序**：health 列严格放在 `deleted_at` 之后、`created_at` 之前，符合任务要求。
4. **ForeignKey 处理**：package_id 使用 `ForeignKey("packages.id")` 但**未加 `ondelete="CASCADE"`**，遵循项目软删除策略（删除包不级联删除检查记录，与 docs/architecture/04-data-model.md 中 versions 不级联一致）。

## 关注点

无。所有测试通过，代码风格检查通过，全量套件无回归。
