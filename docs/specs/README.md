# Agent Kit Admin - Phase SPECs

分阶段实现规格，每个 SPEC 可独立交给 AI Coding 执行。

## 目录

| Phase | 文件 | 时间 | 说明 |
|---|---|---|---|
| 0 | [phase-0-tech-verification.md](phase-0-tech-verification.md) | Week 0 | 技术验证 POC |
| 1 | [phase-1-mvp.md](phase-1-mvp.md) | Week 1-3 | MVP 最小可用版本 |
| 2 | [phase-2-experience.md](phase-2-experience.md) | Week 4-6 | 完善体验 |
| 3 | [phase-3-team-collaboration.md](phase-3-team-collaboration.md) | Week 7-9 | 团队协作 |
| 4 | [phase-4-ecosystem.md](phase-4-ecosystem.md) | Week 10-13 | 生态扩展 |
| 5 | [phase-5-release.md](phase-5-release.md) | Week 14-17 | 正式发布 |

## 使用方式

1. 选择当前阶段的 SPEC
2. 使用 `/task-loom` 拆分为子任务
3. 按子任务顺序执行
4. 完成后进入下一阶段

## 依赖关系

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

每个 Phase 依赖前一个 Phase 的完成。
