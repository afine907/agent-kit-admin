# Agent Kit Admin - 图表索引

本目录包含 Agent Kit Admin 项目的所有架构和设计图表。

## 图表列表

| 图表 | 文件 | 说明 |
|------|------|------|
| 完整架构图 | [01-architecture.md](01-architecture.md) | 系统架构、组件职责、部署架构、技术栈分层 |
| 数据流图 | [02-data-flow.md](02-data-flow.md) | 包安装/发布流程、OAuth 认证流程、数据流向 |
| 用户交互图 | [03-user-interaction.md](03-user-interaction.md) | 用户角色权限、Web UI 流程、CLI 交互、错误处理 |
| E-R 图 | [04-er-diagram.md](04-er-diagram.md) | 实体关系、索引策略、可见性控制、软删除模型 |

## 如何查看

这些图表使用 [Mermaid](https://mermaid.js.org/) 语法编写，可以通过以下方式查看：

### 1. VS Code 插件
安装 [Mermaid Markdown Syntax Highlighting](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) 插件，直接在 VS Code 中预览。

### 2. GitHub
GitHub 原生支持 Mermaid 渲染，直接查看 `.md` 文件即可。

### 3. 在线编辑器
访问 [Mermaid Live Editor](https://mermaid.live/)，粘贴代码查看。

### 4. Typora
Typora 原生支持 Mermaid 渲染。

## 图表概览

### 1. 架构图 (01-architecture.md)

- **系统架构总览**: 展示用户层、网关层、应用层、存储层的关系
- **组件详细架构**: 前端、后端、CLI 的内部结构
- **部署架构**: Docker Compose 服务拓扑
- **技术栈分层**: 从表现层到存储层的技术选型

### 2. 数据流图 (02-data-flow.md)

- **包安装流程**: `akit install` 的完整时序
- **包发布流程**: `akit publish` 的完整时序
- **OAuth 认证流程**: CLI 登录的 OAuth 交互
- **数据流向图**: 数据输入、处理、存储、输出的全局视图
- **数据库读写流**: 读写操作分类

### 3. 用户交互图 (03-user-interaction.md)

- **用户角色与权限**: 访客、成员、管理员、所有者的权限矩阵
- **Web UI 页面流程**: 页面导航和路由
- **Web UI 交互流程**: 首页浏览、包详情、仪表盘操作
- **CLI 交互流程**: 登录、安装、发布的命令行交互
- **错误处理交互**: Web UI 和 CLI 的错误处理
- **响应式布局**: 桌面端、平板端、移动端的布局适配

### 4. E-R 图 (04-er-diagram.md)

- **完整实体关系图**: 所有实体及其关系
- **用户与团队关系**: 多对多关系通过 team_members 表
- **包与版本关系**: 一对多关系
- **评分系统关系**: 用户、包、版本的评分关联
- **下载统计关系**: 下载记录和聚合策略
- **API Key 关系**: 用户与 API Key 的关联
- **可见性控制模型**: public/team/private 的访问控制
- **Scope 命名空间模型**: 用户和团队的 scope 命名规则
- **软删除模型**: deleted_at 字段的使用
- **索引策略**: 各表的索引设计
- **分区策略**: downloads 表的分区方案

## 维护说明

当项目架构或数据模型发生变化时，请同步更新对应的图表文件：

1. 修改代码或数据库结构
2. 更新对应的图表文件
3. 确保图表与实际实现保持一致
4. 提交到 Git 仓库

## 相关文档

- [项目概述](../01-project-overview.md)
- [架构设计](../02-architecture.md)
- [数据模型](../04-data-model.md)
- [API 设计](../05-api-design.md)
- [认证设计](../07-auth-design.md)
- [技术栈](../03-tech-stack.md)
