# Testing Guide

> Detailed test architecture: [`docs/testing/test-architecture.md`](testing/test-architecture.md)

## Quick Reference

| Component | Framework | Command | Pattern |
|---|---|---|---|
| Server | pytest + pytest-asyncio | `cd apps/server && pytest -v` | `test_*.py`, AAA |
| CLI | Vitest | `cd apps/cli && pnpm test` | `*.test.ts`, AAA |
| Web | Vitest + @testing-library/react | `cd apps/web && pnpm test` | `*.test.tsx`, AAA |

## Run All Tests

```bash
make test
```

## Coverage Targets

| Metric | Target | Current (2026-07-11) |
|---|---|---|
| Server Statements | ≥ 80% | **80%** ✅ |
| Server Branches | ≥ 70% | — |
| CLI Statements | ≥ 70% | — |
| Web Statements | ≥ 70% | — |

### Run Coverage

```bash
# Server
cd apps/server && .venv/bin/pytest --cov=app --cov-report=term-missing --cov-fail-under=80

# CLI
cd apps/cli && pnpm test -- --coverage

# Web
cd apps/web && pnpm test -- --coverage
```

### Coverage Baselines (established 2026-07-11)

- **Server**: 80% statements (622 missing of 3043 total)
  - Low: `app/services/storage.py` (31%), `app/services/auth.py` (63%), `app/cli.py` (46%)
  - High: `app/schemas/*`, `app/models/*` (93%+)
- **CLI**: config pending (vitest coverage provider issue — Task 1 will resolve)
- **Web**: not yet measured

## Server Tests

- Location: `apps/server/tests/`
- Fixtures: `conftest.py` with shared async fixtures
- Async mode: `asyncio_mode = "auto"`
- Coverage: `pytest --cov=app --cov-report=xml`

### Key test files:
- `test_auth.py` — Authentication flows
- `test_packages.py` — Package CRUD
- `test_teams.py` — Team management
- `test_api_keys.py` — API key operations
- `test_rate_limiting.py` — Rate limit enforcement
- `test_e2e_journeys.py` — End-to-end user flows

## CLI Tests

- Location: `apps/cli/tests/`
- Framework: Vitest
- Pattern: AAA (Arrange-Act-Assert)
- Co-located with source: `commands/`, `agents/`, `utils/`

## Web Tests

- Location: `apps/web/src/__tests__/`
- Framework: Vitest + @testing-library/react
- Utilities: `apps/web/src/test/`

## Test Conventions

1. Each test verifies one behavior
2. Tests are independent — no execution order dependency
3. Use fixtures for shared setup (server) or beforeEach (CLI/Web)
4. Mock external dependencies, not internal modules (use dependency injection)
5. Test the happy path, boundary conditions, error handling, and integration points
