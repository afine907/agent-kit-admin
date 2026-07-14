# 复盘记录 2026-07-08

## 1. 事件回顾
- **用户说了什么**: "使用 junction 来创建符号链接"
- **AI 做错了什么**: ①用 `ln -s`（Git Bash）创建链接，实际是副本；②用 `mklink /J` 创建文件级 junction（junction 只能用于目录）
- **正确做法应该是什么**: 目录用 `mklink /J`（junction，无需管理员）；文件用 `mklink`（需管理员或开发者模式）；无权限时直接复制

## 2. 根因分析
- **直接原因**: 不了解 junction 只能用于目录的限制；不清楚 Windows 上文件链接的正确方式
- **根本原因**: `.claude/rules/` 缺少 Windows 平台操作规则

## 3. 修复措施
- **修改了哪个文件**: `.claude/rules/general.md`（新建）
- **新增/修改了什么内容**: 添加 "Windows 链接选择" 规则，区分 junction（目录）和符号链接（文件）的适用范围
- **内容预览**:

  ```markdown
  ### Windows 链接选择
  - **错误**: 混淆 junction 和符号链接的适用范围，用 `mklink /J` 链接单个文件
  - **原因**: `mklink /J`（junction）只能用于目录；`mklink`（符号链接）可用于文件和目录但需管理员权限
  - **正确做法**:
    - 链接目录 → `cmd //c "mklink /J <junction_dir> <target_dir>"`
    - 链接文件 → `cmd //c "mklink <link_file> <target_file>"`（需管理员或开发者模式）
    - 无管理员权限时链接文件 → 直接复制
  - **场景**: Windows 上创建文件/目录链接时
  - **来源**: 2026-07-08
  ```

## 4. 验证
- [x] 未来遇到类似场景时，这条规则会被触发（general.md 始终加载）
- [x] 写入内容简洁可操作（5 行）
