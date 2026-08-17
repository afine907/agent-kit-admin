# Task 4 Report: LLM 功能实测 (Dimension C)

**Status:** ✅ Complete
**Date:** 2026-08-17

## Summary

Created the functional check (Dimension C) — the most complex inspector check that calls an LLM to verify Skill content is meaningful via standard Q&A testing.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `apps/server/app/inspect/checks/functional.py` | 115 | LLM functional check implementation |
| `apps/server/tests/inspect/test_functional.py` | 138 | 7 tests covering all branches |

## Implementation Highlights

- **Dependency injection pattern**: `llm_client` parameter allows injecting mock `httpx.AsyncClient` in tests, avoids module-level `vi.mock` style patching
- **SSE streaming parser**: Parses OpenAI-compatible streaming response line by line, handles `[DONE]` termination and malformed JSON gracefully
- **Smart response evaluation**: `_evaluate_response()` checks both length threshold (≥20 chars) and semantic refusal patterns ("超出...范围")
- **Resource cleanup**: Only closes the client if it was created internally (not injected), preventing test client double-close
- **Config-driven**: Respects `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` from settings

## Test Results

```
7 passed in 0.19s
```

| Test | Coverage |
|------|----------|
| `test_evaluate_response_valid` | Pure function - valid response |
| `test_evaluate_response_too_short` | Pure function - <20 chars |
| `test_evaluate_response_refusal` | Pure function - refusal pattern |
| `test_evaluate_response_empty` | Pure function - empty string |
| `test_functional_pass` | Integration - valid LLM response |
| `test_functional_fail_refusal` | Integration - refusal → fail |
| `test_functional_skip_no_api_key` | Integration - skip without API key |

## Code Quality

- ✅ `ruff check` — All checks passed
- ✅ `ruff format --check` — 2 files already formatted
- ✅ No unused imports, no type errors

## Mock Pattern

Followed the exact pattern from `test_agent_chat.py`:
- `MockTransport(handler)` for HTTP response mocking
- `monkeypatch.setattr(functional_mod.httpx, "AsyncClient", client_factory)` for dependency injection
- SSE-formatted body with `data: {"choices": [{"delta": {"content": "..."}}]}`

## Concerns

None. The implementation matches the plan spec exactly. The `db` parameter is accepted but unused in this check (consistent with other checks that may use it in future enhancements).
