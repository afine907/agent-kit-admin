# Retrospective: Anysearch 搜索优先级

**日期**: 2026-07-08
**触发**: 用户纠正 — WebFetch 失败时应使用 anysearch 而非放弃

## 事件

在执行 DWP init onboarding 时，需要获取 deepworkplan.com 的方法论文档。使用 WebFetch 抓取 3 个 URL 全部失败（域名被安全策略拦截）。AI 直接跳过，没有尝试替代搜索方式。

用户纠正：「web search 用不了应该干嘛？应该使用 /anysearch 啊」

## 根因

1. 全局 CLAUDE.md 明确规定：「需要网络搜索时，优先使用 anysearch 技能」
2. AI 未遵循该规则，将 WebFetch 作为唯一手段
3. WebFetch 失败后没有回退到 anysearch

## 教训

- 全局规则被忽略 ≠ 规则不存在。需要在项目层面加强提醒
- WebFetch 不是搜索工具，是 URL 抓取工具。两者用途不同
- 任何需要外部内容的场景，先 `/anysearch`

## 行动

- [x] 写入 memory: `feedback-anysearch-priority.md`
- [x] 更新 MEMORY.md 索引
