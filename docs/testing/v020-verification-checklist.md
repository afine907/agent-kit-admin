# v0.2.0 功能验证清单

> 本文档为 v0.2.0 发布前的手动验证清单，覆盖所有新功能和关键流程。

## 前置条件

- Server 已启动：`pnpm dev:server`
- Web 已启动：`pnpm dev:web`
- 已有测试账号（admin 和普通用户）

---

## 1. CLI 验证

### 1.1 install 命令

```bash
# 安装一个已发布的包
akit install @scope/package-name

# 验证点：
# ✅ 包下载成功
# ✅ 文件解压到 ~/.akit/packages/@scope/package-name/
# ✅ akit.json 存在于包目录
# ✅ Agent 配置已写入（如 ~/.claude/mcp.json）
```

### 1.2 update 命令

```bash
# 更新已安装的包
akit update @scope/package-name

# 验证点：
# ✅ 检查新版本
# ✅ 下载并解压新版本
# ✅ Agent 配置更新为 manifest 中的实际值
# ✅ 版本记录更新
```

---

## 2. Server API 验证

### 2.1 leave-team 端点

```bash
# 成员退出团队
curl -X POST http://localhost:8000/api/v1/teams/{team_id}/leave \
  -H "Authorization: Bearer {member_token}"

# 验证点：
# ✅ 成员退出成功 (204)
# ✅ Owner 不能退出 (400)
# ✅ 非成员不能退出 (404)
```

### 2.2 uninstall-team-package 端点

```bash
# 卸载团队包安装记录
curl -X DELETE http://localhost:8000/api/v1/teams/{team_id}/packages/{pkg_id}/install \
  -H "Authorization: Bearer {member_token}"

# 验证点：
# ✅ 卸载成功 (204)
# ✅ 未安装的包返回 404
# ✅ 非团队成员返回 403
```

### 2.3 API Key flush

```bash
# 1. 使用 API Key 访问
curl -H "Authorization: Bearer akit_xxx" http://localhost:8000/api/v1/auth/me

# 2. 检查数据库中的 last_used_at
# 验证点：
# ✅ last_used_at 被更新
# ✅ 60 秒后自动 flush 到数据库
```

### 2.4 Download metadata

```bash
# 下载包
curl http://localhost:8000/api/v1/packages/{scope}/{name}/download

# 检查数据库中的 Download 记录
# 验证点：
# ✅ ip_address 已记录
# ✅ user_agent 已记录
```

---

## 3. Web 验证

### 3.1 OAuth 登录流程

1. 点击 OAuth 登录按钮 → 跳转到提供商
2. 完成 OAuth → 服务器重定向到 `/auth/callback?token=...`
3. 验证点：
   - ✅ Token 存储到 localStorage
   - ✅ 重定向到首页
   - ✅ 用户状态显示已登录

### 3.2 Token 自动刷新

1. 正常登录
2. 等待 token 过期（或手动清除 localStorage 中的 token）
3. 执行一个 API 请求
4. 验证点：
   - ✅ 自动触发 token refresh
   - ✅ 原始请求成功重试
   - ✅ 并发请求只触发一次 refresh

### 3.3 TeamPackagesTab 按钮

1. 进入团队详情页 → 包管理 Tab
2. 点击 "发布包" 按钮
3. 验证点：
   - ✅ 导航到发布页面
4. 点击 "删除" 按钮
5. 验证点：
   - ✅ 显示确认对话框
   - ✅ 确认后调用 API 删除
   - ✅ 取消后不调用 API

### 3.4 排序控件

1. 进入首页
2. 使用排序下拉菜单
3. 验证点：
   - ✅ 选择 "最新" → 按创建时间降序
   - ✅ 选择 "最热" → 按下载量降序
   - ✅ 选择 "名称" → 按名称升序

### 3.5 PackageEdit 新字段

1. 进入包编辑页面
2. 验证点：
   - ✅ License 字段存在且可编辑
   - ✅ Repository URL 字段存在且可编辑
   - ✅ Homepage URL 字段存在且可编辑
   - ✅ 保存时包含新字段

### 3.6 i18n 覆盖

1. 切换语言（中文 ↔ 英文）
2. 浏览各页面
3. 验证点：
   - ✅ 所有文本正确翻译
   - ✅ 无硬编码字符串

---

## 4. 跨组件验证

### 4.1 publish → install → update 完整流程

1. 在 Web 上发布一个包
2. 使用 CLI 安装：`akit install @scope/package`
3. 在 Web 上发布新版本
4. 使用 CLI 更新：`akit update @scope/package`
5. 验证点：
   - ✅ 完整流程无错误
   - ✅ Agent 配置正确更新

### 4.2 团队包管理完整流程

1. 创建团队
2. 添加成员
3. 发布团队包
4. 成员安装团队包
5. 成员卸载团队包
6. 成员离开团队
7. 验证点：
   - ✅ 所有操作成功
   - ✅ Owner 不能离开团队

---

## 已知限制

- OAuth 测试需要真实的 OAuth 提供商配置
- Token refresh 需要等待 token 过期或手动干预
- 部分场景需要直接检查数据库

## 问题记录

（在验证过程中发现问题时记录于此）

| 日期 | 问题 | 状态 |
|------|------|------|
| | | |
