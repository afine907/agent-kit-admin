# Ready-to-Use Prompts for PLAN_comprehensive_functional_test

This file contains **copy-paste ready prompts** for working with this specific plan.

**Plan location:** `.dwp/plans/PLAN_comprehensive_functional_test/`

---

## 🚀 Execute This Plan

**Use this to start executing the plan from the beginning:**

```
Execute the plan at: .dwp/plans/PLAN_comprehensive_functional_test/README.md

Work on tasks in order. Run validations. Commit after each task.
```

**With specific requirements:**

```
Execute the plan at: .dwp/plans/PLAN_comprehensive_functional_test/README.md

Important for this plan:
- 每个 task 完成后运行对应的验证命令（Server/CLI/Web 各自的 lint + test）
- 测试遵循 AAA 模式
- Mock 外部依赖，不 mock 内部模块

Work on tasks in order. Run validations. Commit after each task.
```

---

## ⏯️ Resume This Plan (After Interruption)

**Use this when execution was interrupted (internet loss, IDE crash, break, etc.):**

```
RESUME the plan at: .dwp/plans/PLAN_comprehensive_functional_test/README.md

Check task list. Continue from first [ ] task. Review git log.
```

---

## 📊 Resume With Status Report

**Use this when you want to know exactly what's done before resuming:**

```
RESUME the plan at: .dwp/plans/PLAN_comprehensive_functional_test/README.md

Before resuming, report:
1. Which tasks are [x] vs [ ]?
2. What does git log show? (last 10 commits)
3. Any uncommitted changes? (git status)
4. What's in the current task's log?

Then continue from first [ ] task.
```

---

## 📋 Check Plan Status (Without Executing)

**Use this to check progress without continuing execution:**

```
Check status of: .dwp/plans/PLAN_comprehensive_functional_test/README.md

Report:
1. Which tasks are [x] vs [ ] in the plan README?
2. What does git log --oneline -10 show?
3. What does git status show?
4. What's in the last task's Completion & Log section?

Tell me where we are in the plan.
```

---

## 🔧 Modify This Plan

**Use this when you need to add/remove/reorder tasks mid-execution:**

```
PAUSE execution of: .dwp/plans/PLAN_comprehensive_functional_test/README.md

I need to modify the plan:
[Describe what you want to change]

After I manually update the plan files, I'll ask you to resume.
```

---

## 💡 Quick Actions

| Action                      | Prompt to Use             |
| --------------------------- | ------------------------- |
| Start execution             | Execute This Plan         |
| Continue after interruption | Resume This Plan          |
| Need status first           | Resume With Status Report |
| Just check progress         | Check Plan Status         |
| Change plan structure       | Modify This Plan          |
