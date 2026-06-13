# Phase 4: 生态扩展 SPEC

## 目标

支持更多 Agent，完善生态。

## 时间

Week 10-13 (4 周)

## 前置条件

- Phase 3 完成
- 团队协作可用

---

## 模块 1: Agent 支持扩展

### 1.1 新增适配器

| Agent | 配置路径 | 格式 |
|---|---|---|
| Windsurf | `~/.windsurf/mcp.json` | JSON (`mcpServers`) |
| Cline | VS Code settings | JSON |
| Aider | `~/.aider.conf.yml` | YAML |

### 1.2 CLI Agent 命令

```bash
# 列出已安装 Agent
akit agent list

# 检测 Agent
akit agent detect
```

---

## 模块 2: 依赖管理 (完整)

### 2.1 依赖解析

```bash
# 解析依赖树
akit deps resolve

# 输出:
@scope/my-mcp@1.0.0
├── @team/util-mcp@^1.0.0 → 1.2.0
└── another-mcp@~2.0.0 → 2.1.0
```

### 2.2 版本约束

| 约束 | 说明 | 示例 |
|---|---|---|
| `^1.0.0` | 兼容更新 | 1.x.x |
| `~1.0.0` | 补丁更新 | 1.0.x |
| `1.0.0` | 精确版本 | 1.0.0 |
| `>=1.0.0` | 最低版本 | 1.0.0+ |

### 2.3 循环依赖检测

- 安装时检测循环依赖
- 报错提示依赖链

### 2.4 自动安装依赖

```bash
# 安装包及其依赖
akit install @scope/my-mcp --with-deps
```

---

## 模块 3: 包管理增强

### 3.1 包废弃标记

```bash
# 标记为 deprecated
akit deprecate @scope/name --message "Use @scope/new-name instead"

# 安装时提示:
⚠ @scope/name is deprecated: Use @scope/new-name instead
```

### 3.2 版本撤回

```bash
# 撤回版本
akit unpublish @scope/name@1.0.0

# 安装时跳过撤回版本
```

### 3.3 包转移

```bash
# 转移所有权
akit transfer @scope/name @new-owner
```

### 3.4 批量操作

```bash
# 批量删除
akit batch delete @scope/name1 @scope/name2

# 批量更新
akit update --all
```

---

## 模块 4: Webhook 通知

### 4.1 事件类型

| 事件 | 说明 |
|---|---|
| `package.published` | 包发布 |
| `package.deleted` | 包删除 |
| `version.published` | 版本发布 |
| `version.yanked` | 版本撤回 |

### 4.2 Webhook API

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/v1/webhooks` | POST | 创建 Webhook |
| `/api/v1/webhooks` | GET | 列出 Webhook |
| `/api/v1/webhooks/:id` | DELETE | 删除 Webhook |

### 4.3 Webhook 格式

```json
{
  "event": "package.published",
  "timestamp": "2026-01-01T00:00:00Z",
  "data": {
    "package": "@scope/name",
    "version": "1.0.0",
    "author": "@username"
  }
}
```

---

## 验收标准

| 场景 | 验收标准 |
|---|---|
| Agent 支持 | 至少 5 种 Agent |
| 依赖解析 | 正确解析依赖树 |
| 循环依赖 | 检测并报错 |
| 包废弃 | 安装时提示 |
| Webhook | 事件触发可用 |

---

## 周计划

### Week 10: Agent 扩展

- [ ] Windsurf 适配器
- [ ] Cline 适配器
- [ ] Aider 适配器
- [ ] Agent 检测命令

### Week 11: 依赖管理

- [ ] 依赖解析
- [ ] 版本约束匹配
- [ ] 循环依赖检测
- [ ] 自动安装依赖

### Week 12: 包管理增强

- [ ] 包废弃标记
- [ ] 版本撤回
- [ ] 包转移
- [ ] 批量操作

### Week 13: Webhook

- [ ] Webhook 创建/删除
- [ ] 事件触发
- [ ] Webhook 测试
