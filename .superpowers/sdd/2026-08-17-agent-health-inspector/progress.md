# SDD ledger — plan: docs/superpowers/plans/2026-08-17-agent-health-inspector.md

## Pre-flight Scan

### Cross-task interface check

| Task | Produces | Consumed by | Status |
|------|----------|-------------|--------|
| 1 | AgentHealthCheck model, Package.health_status/needs_check/last_check_at, CheckResult type | Tasks 2-13 | Clean |
| 2 | check_compliance(manifest) -> CheckResult | Task 6 (inspector) | Clean |
| 3 | check_content(package, version, storage) -> CheckResult | Task 6 | Clean |
| 4 | check_functional(package, version, db, llm_client) -> CheckResult | Task 6 | Clean |
| 5 | check_freshness(package, version) -> CheckResult | Task 6 | Clean |
| 6 | InspectorService.run_check/run_sampled_check/process_pending_checks, overall_status() | Tasks 7, 13 | Clean |
| 7 | create_scheduler(inspector), worker entry | Task 12 (docker-compose) | Clean |
| 8 | mark_needs_check(db, package_id), mark_needs_check_by_name(db, scope, name) | Task 9 (API) | Clean |
| 9 | Health API endpoints, HealthCheckResponse schema | Task 10, 11 (frontend) | Clean |
| 10 | HealthCheckBadge component | Task 11 | Clean |
| 11 | PackageDetail integration, api.getHealthCheck/triggerHealthCheck | — | Clean |
| 12 | docker-compose worker service | — | Clean |
| 13 | Integration tests | — | Clean |
| 14 | Architecture docs | — | Clean |

### Self-consistency check

| Task | Test vs Code agreement | Files agreement | Notes |
|------|----------------------|-----------------|-------|
| 1 | Test creates model with all fields; code creates model with all fields | Creates health_check.py, modifies package.py + __init__.py + config.py | Clean |
| 2 | Tests assert pass/fail on various manifests; code implements same logic | Creates types.py + compliance.py | Clean |
| 3 | Tests mock storage and version; code uses same interface | Creates content.py | Clean |
| 4 | Tests mock httpx.AsyncClient; code uses httpx.AsyncClient | Creates functional.py | Clean |
| 5 | Tests use MagicMock for package/version; code uses package.created_at/version.created_at | Creates freshness.py | Clean |
| 6 | Tests for overall_status only; code has more methods | Creates inspector.py | Clean — tests cover the pure function |
| 7 | Test checks scheduler has 2 jobs; code registers 2 jobs | Creates scheduler.py + worker.py | Clean |
| 8 | Tests verify needs_check set to True; code does UPDATE | Creates events.py | Clean |
| 9 | Tests use client fixture; code uses FastAPI deps | Creates health.py + schema | Note: tests need auth — implementer must handle |
| 10 | Tests render component; code exports component | Creates HealthCheckBadge.tsx | Clean |
| 11 | No tests specified (integration only) | Modifies PackageDetail.tsx + api.ts | Clean |
| 12 | No tests (config only) | Modifies docker-compose.yml + .env.example | Clean |
| 13 | Tests full flow end-to-end | Creates test_integration.py | Clean |
| 14 | No tests (docs only) | Modifies architecture docs | Clean |

### Conflicts found

- **Task 9 (API tests)**: The test uses `client` fixture without auth setup. The API endpoints use `get_current_user`. Implementer must either add auth to tests or the tests will fail. This is a plan defect — the implementer needs to create a user and pass auth headers.
  - **Ruling**: Implementer should follow existing test patterns (conftest.py has `_generate_token` helper and user fixtures). Tests must create a user, generate a token, and pass it in the Authorization header. Cost if wrong: tests fail at runtime.

- **Task 1 (config.py)**: The plan adds `INSPECTOR_*` settings but the existing config uses `model_config = {"env_file": ".env"}`. New settings will auto-load from env. No conflict.
  - **Ruling**: No action needed. Settings auto-load via pydantic-settings.

- **Task 7 (worker.py lifespan)**: Worker calls `_ensure_tables()` which imports models. The existing `main.py` lifespan also does `Base.metadata.create_all`. Both can coexist (idempotent).
  - **Ruling**: No action needed. `create_all` is idempotent.

Scan complete. Proceeding to Task 1.
