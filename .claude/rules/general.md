# 通用经验教训

> 自动积累的项目经验，Claude 每次会话会自动读取

### Windows 链接选择
- **错误**: 混淆 junction 和符号链接的适用范围，用 `mklink /J` 链接单个文件
- **原因**: `mklink /J`（junction）只能用于**目录**，不能用于文件；`mklink`（符号链接）可用于文件和目录但需管理员权限
- **正确做法**:
  - 链接**目录** → `cmd //c "mklink /J <junction_dir> <target_dir>"`（无需管理员）
  - 链接**文件** → `cmd //c "mklink <link_file> <target_file>"`（需管理员或开启开发者模式）
  - 无管理员权限时链接文件 → 直接复制，不要用 Git Bash 的 `ln -s`（行为不一致，常创建副本）
- **场景**: Windows 上创建文件/目录链接时
- **来源**: 2026-07-08

---
