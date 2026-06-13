# Web UI E2E 测试指南

本文档说明如何使用 CDP (Chrome DevTools Protocol) MCP 工具进行 Web UI 端到端测试。

## 前置条件

1. 已安装并配置 CDP MCP 服务器
2. Web 开发服务器正在运行
3. 后端 API 服务器正在运行（可选，用于完整测试）

## 启动测试环境

```bash
# 1. 启动后端服务（可选）
cd apps/server
uvicorn app.main:app --reload --port 8000

# 2. 启动 Web 开发服务器
cd apps/web
pnpm dev
# Web 服务器将在 http://localhost:5173 启动
```

## 测试用例

### 1. 首页测试

#### 1.1 导航到首页

使用 `mcp__chrome-devtools__navigate_page` 访问首页：

```
URL: http://localhost:5173
```

#### 1.2 验证页面标题

使用 `mcp__chrome-devtools__take_snapshot` 获取页面快照，检查是否包含：
- "Agent Kit Registry" 标题

#### 1.3 验证搜索框

在快照中查找：
- `<input>` 元素，placeholder 包含 "搜索"

#### 1.4 验证类型筛选按钮

在快照中查找：
- "全部" 按钮
- "MCP" 按钮
- "Skill" 按钮

#### 1.5 测试搜索功能

1. 使用 `mcp__chrome-devtools__fill` 在搜索框输入 "database"
2. 使用 `mcp__chrome-devtools__wait_for` 等待结果更新
3. 使用 `mcp__chrome-devtools__take_snapshot` 验证结果

#### 1.6 测试类型筛选

1. 使用 `mcp__chrome-devtools__click` 点击 "MCP" 按钮
2. 使用 `mcp__chrome-devtools__take_snapshot` 验证只显示 MCP 类型的包

#### 1.7 测试包点击跳转

1. 使用 `mcp__chrome-devtools__click` 点击第一个包
2. 使用 `mcp__chrome-devtools__take_snapshot` 验证 URL 变为 `/packages/:scope/:name`

### 2. 登录页测试

#### 2.1 导航到登录页

```
URL: http://localhost:5173/login
```

#### 2.2 验证登录选项

在快照中查找：
- "企业微信" 按钮
- "飞书" 按钮
- "钉钉" 按钮

#### 2.3 测试 OAuth 跳转

1. 使用 `mcp__chrome-devtools__click` 点击 "企业微信" 按钮
2. 使用 `mcp__chrome-devtools__take_snapshot` 验证 URL 跳转到 OAuth 页面

### 3. 包详情页测试

#### 3.1 导航到包详情页

```
URL: http://localhost:5173/packages/@team/pg-mcp
```

#### 3.2 验证包信息

在快照中查找：
- 包名 "@team/pg-mcp"
- 类型标签 "MCP"
- 描述信息
- 安装命令 "akit install @team/pg-mcp"

#### 3.3 验证版本列表

在快照中查找：
- 版本列表区域
- 版本号

#### 3.4 测试复制按钮

1. 使用 `mcp__chrome-devtools__click` 点击复制按钮
2. 使用 `mcp__chrome-devtools__wait_for` 等待 "已复制" 提示出现

#### 3.5 测试返回按钮

1. 使用 `mcp__chrome-devtools__click` 点击 "返回包列表"
2. 使用 `mcp__chrome-devtools__take_snapshot` 验证 URL 变为 `/`

## 测试脚本示例

以下是一个完整的测试流程示例：

```bash
# 1. 启动 Web 服务器
cd apps/web
pnpm dev &

# 2. 等待服务器启动
sleep 3

# 3. 在 Claude Code 中执行以下测试步骤
```

### 测试步骤（在 Claude Code 中执行）

```
# 步骤 1: 导航到首页
使用 mcp__chrome-devtools__navigate_page 访问 http://localhost:5173

# 步骤 2: 获取页面快照
使用 mcp__chrome-devtools__take_snapshot 获取页面结构

# 步骤 3: 验证标题
检查快照中是否包含 "Agent Kit Registry"

# 步骤 4: 测试搜索
使用 mcp__chrome-devtools__fill 在搜索框输入 "database"
使用 mcp__chrome-devtools__wait_for 等待 "Found" 或结果更新
使用 mcp__chrome-devtools__take_snapshot 验证结果

# 步骤 5: 测试类型筛选
使用 mcp__chrome-devtools__click 点击 "MCP" 按钮
使用 mcp__chrome-devtools__take_snapshot 验证只显示 MCP 类型

# 步骤 6: 点击包查看详情
使用 mcp__chrome-devtools__click 点击第一个包
使用 mcp__chrome-devtools__take_snapshot 验证 URL 变为 /packages/...

# 步骤 7: 验证详情页
检查快照中是否包含包名、类型、安装命令

# 步骤 8: 测试返回
使用 mcp__chrome-devtools__click 点击 "返回包列表"
使用 mcp__chrome-devtools__take_snapshot 验证 URL 变为 /
```

## 测试报告模板

```
## Web UI E2E 测试报告

**测试日期:** YYYY-MM-DD
**测试人员:** [姓名]
**测试环境:** [浏览器版本]

### 测试结果

| 测试用例 | 状态 | 备注 |
|---------|------|------|
| 首页加载 | ✅/❌ | |
| 搜索功能 | ✅/❌ | |
| 类型筛选 | ✅/❌ | |
| 包详情页 | ✅/❌ | |
| 登录页 | ✅/❌ | |
| OAuth 跳转 | ✅/❌ | |

### 发现的问题

1. [问题描述]
2. [问题描述]

### 建议

1. [建议]
2. [建议]
```

## 故障排除

### 问题：页面加载失败

**解决方案：**
1. 检查 Web 服务器是否正在运行
2. 检查端口 5173 是否被占用
3. 检查浏览器控制台是否有错误

### 问题：元素找不到

**解决方案：**
1. 使用 `mcp__chrome-devtools__take_snapshot` 获取最新页面结构
2. 检查元素是否在 iframe 中
3. 等待页面加载完成后再查找

### 问题：点击无响应

**解决方案：**
1. 使用 `mcp__chrome-devtools__hover` 先悬停在元素上
2. 检查元素是否被其他元素遮挡
3. 使用 `mcp__chrome-devtools__click` 的 `dblClick` 参数尝试双击
