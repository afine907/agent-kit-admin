# CLI Test Coverage: 34% → 70%

## Goal

Improve CLI test coverage from **34% to 70%** by testing command handler functions directly, without Commander/yargs interception.

## Key Insight

Current tests mock everything, which provides no real coverage. The fix: test command handler functions directly.

- Use `command.configure()` to intercept before the action handler is called
- Test CLI argument parsing logic separately from Commander action handlers
- Utility modules (tarball.ts, config.ts, i18n.ts) have **zero coverage** — add tests there first

## Strategy

1. **Add unit tests for utility functions** (zero coverage currently)
2. **Test CLI argument parsing** logic separately from Commander action handlers
3. **Use `command.configure()`** to intercept before action is called, enabling isolated handler testing

---

## Tasks

### Task 1: tarball.ts utility tests
- **Functions:** `extractArchive`, `getTempDir`, archive helpers
- **Tests:** ~15
- **Coverage gain:** ~8pp

### Task 2: config.ts tests
- **Functions:** `loadConfig`, `saveConfig`, config validation
- **Tests:** ~10
- **Coverage gain:** ~5pp

### Task 3: i18n.ts tests
- **Functions:** `t()` function, translation helpers
- **Tests:** ~8
- **Coverage gain:** ~4pp

### Task 4: Refactor install.test.ts
- **Goal:** Test real install logic instead of mocked behavior
- **Tests:** ~10
- **Coverage gain:** ~8pp

### Task 5: workspace.ts + update.ts tests
- **Functions:** workspace management, update checking
- **Tests:** ~8
- **Coverage gain:** ~5pp

---

## Summary

| Task | Tests | Coverage Gain |
|------|-------|---------------|
| tarball.ts | ~15 | ~8pp |
| config.ts | ~10 | ~5pp |
| i18n.ts | ~8 | ~4pp |
| install.test.ts refactor | ~10 | ~8pp |
| workspace.ts + update.ts | ~8 | ~5pp |
| **Total** | **~51** | **~30pp** |

**Expected coverage: ~64%** (close to 70% target)
