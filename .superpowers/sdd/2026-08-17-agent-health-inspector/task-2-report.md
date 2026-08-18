# Task 2 — CheckResult 类型与合规检测

**Status:** DONE

## 提交记录

- `632a294` feat(server): CheckResult 共享类型与静态合规检测 (Inspector Task 2)

## 新增文件

| 文件 | 说明 |
|---|---|
| `apps/server/app/inspect/__init__.py` | 空模块初始化 |
| `apps/server/app/inspect/checks/__init__.py` | checks 子模块初始化 |
| `apps/server/app/inspect/checks/types.py` | `CheckResult` 数据类 |
| `apps/server/app/inspect/checks/compliance.py` | `check_compliance` 函数 |
| `apps/server/tests/inspect/test_compliance.py` | 5 个单元测试 |

## TDD 流程

1. **红** — 先写测试文件，运行 `pytest tests/inspect/test_compliance.py -v` → `ModuleNotFoundError: No module named 'app.inspect'` (预期失败)
2. **绿** — 创建 `types.py` + `compliance.py` + `__init__.py` → 5 passed

## 测试结果

```
5 passed, 13 warnings in 0.86s
```

覆盖场景:
- ✅ 合法 manifest (pass)
- ✅ 缺少必填字段 (version/type) (fail)
- ✅ 类型不是 skill (fail)
- ✅ version 不符合 semver (fail)
- ✅ skill content 超过 50KB (fail)

## CheckResult 设计

```python
@dataclass
class CheckResult:
    status: str   # pass / fail / warn / error / skip
    detail: dict

    # 工厂方法: pass_() / fail() / warn() / error() / skip()
```

所有检测维度统一使用此类型返回结果，`status` 字段由聚合器统一判定整体健康状态。

## 关注点

无。任务按计划完成，5 个测试全部通过，lint 无报错。
